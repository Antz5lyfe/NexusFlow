"""Agent node functions for the LangGraph orchestration graph.

Each agent calls a real LLM via the provider clients in ``llm_clients.py``,
then parses the structured response.  Deterministic fallback parsers are
kept as a safety net in case the LLM returns unparseable output.

Every agent attaches a ``cost_entry`` to its step log and appends to the
shared ``cost_entries`` list in the workflow state so the route can
aggregate total savings.
"""

from __future__ import annotations

import hashlib
import json
import logging
import re
import time
import traceback
from datetime import datetime, timezone
from typing import Any, Dict, List

from app.engine.llm_clients import (
    CostEntry,
    LLMResponse,
    calculate_cost,
    call_github_models,
)
from langgraph.types import interrupt

logger = logging.getLogger(__name__)

# ── System Prompts ────────────────────────────────────────────────────

SALES_SYSTEM_PROMPT = """You are a Sales Lead Qualifier Agent for NexusFlow Orchestrator.

Given a user message describing an inbound lead or sales opportunity, extract the following information and return it as a JSON object with NO markdown formatting:

{
  "company": "<company name>",
  "deal_value": <numeric value in USD>,
  "contact_email": "<email if mentioned, otherwise generate one from company name>",
  "lead_score": "<A if deal >= 10000, B if >= 5000, C otherwise>",
  "source": "inbound_prompt",
  "qualification_notes": "<brief 1-2 sentence qualification summary>"
}

Rules:
- If no company name is mentioned, use "Unknown Corp"
- If no deal value is mentioned, default to 5000.00
- Always return valid JSON only, no markdown code blocks
- Be concise in qualification_notes"""

FINANCE_SYSTEM_PROMPT = """You are a Finance Invoice Generator Agent for NexusFlow Orchestrator.

Given lead data as input, generate an invoice and return it as a JSON object with NO markdown formatting:

{
  "invoice_number": "<generate a unique invoice ID like INV-XXXXXXXX>",
  "client_company": "<from lead data>",
  "contact_email": "<from lead data>",
  "line_items": [
    {
      "description": "Professional Services",
      "quantity": 1,
      "unit_price": <deal value>,
      "amount": <deal value>
    }
  ],
  "subtotal_usd": <deal value>,
  "tax_usd": <8% of subtotal>,
  "tax_rate_pct": 8.0,
  "total_usd": <subtotal + tax>,
  "currency": "USD",
  "due_date": "NET-30",
  "status": "ISSUED"
}

Rules:
- Tax rate is always 8%
- Always return valid JSON only, no markdown code blocks
- Invoice numbers should use format INV-XXXXXXXX"""


# ── Sales Agent ───────────────────────────────────────────────────────


def sales_agent_node(state: Dict[str, Any]) -> Dict[str, Any]:
    """Sales Lead Qualifier Agent — calls GitHub Models LLM.

    Sends the user prompt to the LLM with a sales qualification system
    prompt, parses the JSON response into ``lead_data``, and calculates
    the theoretical cost entry.
    """
    step_log: List[Dict[str, Any]] = list(state.get("step_log", []))
    cost_entries: List[Dict[str, Any]] = list(state.get("cost_entries", []))
    start = time.monotonic()

    try:
        prompt: str = state.get("input_prompt", "")

        # ── Call the LLM ──────────────────────────────────────────────
        llm_response: LLMResponse = call_github_models(
            prompt=prompt,
            system_prompt=SALES_SYSTEM_PROMPT,
            model="openai/gpt-4o-mini",
        )

        # ── Parse response ────────────────────────────────────────────
        lead_data = _parse_json_response(llm_response.text)
        if not lead_data or "company" not in lead_data:
            # Fallback to deterministic extraction.
            logger.warning("LLM response not parseable, using fallback extractor")
            lead_data = _extract_fallback_lead(prompt)
            lead_data["_llm_raw"] = llm_response.text[:500]

        # ── Calculate cost ────────────────────────────────────────────
        cost_entry: CostEntry = calculate_cost(llm_response)

        elapsed_ms = round((time.monotonic() - start) * 1000, 2)

        step_log.append(
            {
                "agent_name": "Sales Lead Qualifier",
                "department": "Sales",
                "input_summary": prompt[:200],
                "output_summary": (
                    f"Qualified lead: {lead_data.get('company', 'N/A')} — "
                    f"${lead_data.get('deal_value', 0):,.2f} deal"
                ),
                "duration_ms": elapsed_ms,
                "error": None,
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "cost_entry": cost_entry.to_dict(),
            }
        )
        cost_entries.append(cost_entry.to_dict())

        return {
            "lead_data": lead_data,
            "current_department": "Finance",
            "step_log": step_log,
            "cost_entries": cost_entries,
            "status": "RUNNING",
        }

    except Exception:
        elapsed_ms = round((time.monotonic() - start) * 1000, 2)
        err_msg = traceback.format_exc()
        step_log.append(
            {
                "agent_name": "Sales Lead Qualifier",
                "department": "Sales",
                "input_summary": state.get("input_prompt", "")[:200],
                "output_summary": "FAILED — see error field",
                "duration_ms": elapsed_ms,
                "error": err_msg,
                "timestamp": datetime.now(timezone.utc).isoformat(),
            }
        )
        return {
            "lead_data": {},
            "step_log": step_log,
            "cost_entries": cost_entries,
            "status": "FAILED",
            "error": f"Sales agent failed: {err_msg}",
        }


# ── Finance Agent ─────────────────────────────────────────────────────


def finance_agent_node(state: Dict[str, Any]) -> Dict[str, Any]:
    """Finance Invoice Generator Agent — calls GitHub Models LLM.

    Reads ``lead_data`` from the state, sends it to the LLM with a
    finance system prompt, and parses the structured invoice response.
    """
    step_log: List[Dict[str, Any]] = list(state.get("step_log", []))
    cost_entries: List[Dict[str, Any]] = list(state.get("cost_entries", []))
    start = time.monotonic()

    try:
        lead_data: Dict[str, Any] = state.get("lead_data", {})
        if not lead_data:
            raise ValueError(
                "No lead_data found in state — cannot generate invoice."
            )

        # ── Call the LLM ──────────────────────────────────────────────
        finance_prompt = (
            f"Generate an invoice for this qualified lead:\n\n"
            f"Company: {lead_data.get('company', 'Unknown')}\n"
            f"Deal Value: ${lead_data.get('deal_value', 0):,.2f}\n"
            f"Contact: {lead_data.get('contact_email', 'N/A')}\n"
            f"Lead Score: {lead_data.get('lead_score', 'B')}"
        )

        llm_response: LLMResponse = call_github_models(
            prompt=finance_prompt,
            system_prompt=FINANCE_SYSTEM_PROMPT,
            model="openai/gpt-4o-mini",
        )

        # ── Parse response ────────────────────────────────────────────
        invoice_data = _parse_json_response(llm_response.text)
        if not invoice_data or "invoice_number" not in invoice_data:
            logger.warning("LLM response not parseable, using fallback invoice")
            invoice_data = _generate_fallback_invoice(lead_data)
            invoice_data["_llm_raw"] = llm_response.text[:500]

        # ── Calculate cost ────────────────────────────────────────────
        cost_entry: CostEntry = calculate_cost(llm_response)

        elapsed_ms = round((time.monotonic() - start) * 1000, 2)

        step_log.append(
            {
                "agent_name": "Finance Invoice Generator",
                "department": "Finance",
                "input_summary": (
                    f"Lead: {lead_data.get('company', 'N/A')} — "
                    f"${lead_data.get('deal_value', 0):,.2f}"
                ),
                "output_summary": (
                    f"Invoice {invoice_data.get('invoice_number', 'N/A')} created — "
                    f"total ${invoice_data.get('total_usd', 0):,.2f}"
                ),
                "duration_ms": elapsed_ms,
                "error": None,
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "cost_entry": cost_entry.to_dict(),
            }
        )
        cost_entries.append(cost_entry.to_dict())

        # ── HITL Gate (Module 4) ───────────────────────────────────
        # If the transaction total exceeds $1,000 we suspend and ask for
        # human approval before finalising the invoice.
        total_usd: float = invoice_data.get("total_usd", 0.0)
        HITL_THRESHOLD = 1_000.0

        if total_usd > HITL_THRESHOLD:
            hitl_context = {
                "reason": "high_value_transaction",
                "amount_usd": total_usd,
                "company": invoice_data.get("client_company", lead_data.get("company", "Unknown")),
                "invoice_number": invoice_data.get("invoice_number", "N/A"),
                "threshold_usd": HITL_THRESHOLD,
            }
            logger.info(
                "HITL gate triggered: total_usd=%.2f > threshold=%.2f for %s",
                total_usd,
                HITL_THRESHOLD,
                hitl_context["company"],
            )

            # interrupt() suspends the graph here.  LangGraph raises
            # GraphInterrupt; the engine catches it, marks the DB row
            # PENDING_APPROVAL, and returns a 202.  When the operator
            # calls /approve the graph re-enters this node and
            # interrupt() returns the resume value supplied via
            # Command(resume={...}).
            resume_value: dict = interrupt(hitl_context)

            # ── Resumed ────────────────────────────────────────────────
            # At this point the human has responded.  Check their decision.
            if not resume_value.get("approved", False):
                operator_note = resume_value.get("operator_note", "No reason given.")
                rejection_msg = (
                    f"Invoice {invoice_data.get('invoice_number', 'N/A')} REJECTED "
                    f"by operator. Note: {operator_note}"
                )
                step_log.append(
                    {
                        "agent_name": "Finance Invoice Generator",
                        "department": "Finance",
                        "input_summary": (
                            f"HITL resume — REJECTED by operator"
                        ),
                        "output_summary": rejection_msg,
                        "duration_ms": round((time.monotonic() - start) * 1000, 2),
                        "error": None,
                        "timestamp": datetime.now(timezone.utc).isoformat(),
                    }
                )
                return {
                    "invoice_data": invoice_data,
                    "step_log": step_log,
                    "cost_entries": cost_entries,
                    "status": "REJECTED",
                    "error": rejection_msg,
                }

            # Approved — fall through to normal completion below.
            step_log.append(
                {
                    "agent_name": "Finance Invoice Generator",
                    "department": "Finance",
                    "input_summary": "HITL resume — APPROVED by operator",
                    "output_summary": (
                        f"Invoice {invoice_data.get('invoice_number', 'N/A')} approved — "
                        f"proceeding to completion."
                    ),
                    "duration_ms": round((time.monotonic() - start) * 1000, 2),
                    "error": None,
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                }
            )

        return {
            "invoice_data": invoice_data,
            "current_department": "Finance",
            "step_log": step_log,
            "cost_entries": cost_entries,
            "status": "COMPLETED",
        }

    except BaseException as _exc:
        # GraphInterrupt is a BaseException (not Exception) raised by
        # interrupt() to signal the graph checkpoint.  It MUST propagate
        # to the LangGraph engine — never catch it here.
        from langgraph.errors import GraphInterrupt as _GI
        if isinstance(_exc, _GI):
            raise

        elapsed_ms = round((time.monotonic() - start) * 1000, 2)
        err_msg = traceback.format_exc()
        step_log.append(
            {
                "agent_name": "Finance Invoice Generator",
                "department": "Finance",
                "input_summary": str(state.get("lead_data", {}))[:200],
                "output_summary": "FAILED — see error field",
                "duration_ms": elapsed_ms,
                "error": err_msg,
                "timestamp": datetime.now(timezone.utc).isoformat(),
            }
        )
        return {
            "invoice_data": {},
            "step_log": step_log,
            "cost_entries": cost_entries,
            "status": "FAILED",
            "error": f"Finance agent failed: {err_msg}",
        }


# ── Response Parsing ──────────────────────────────────────────────────


def _parse_json_response(text: str) -> Dict[str, Any]:
    """Try to extract a JSON object from the LLM response text.

    Handles cases where the LLM wraps JSON in markdown code blocks
    or includes extra text around it.
    """
    if not text:
        return {}

    # Strip markdown code blocks if present.
    cleaned = re.sub(r"```(?:json)?\s*", "", text)
    cleaned = cleaned.strip()

    # Try direct parse first.
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        pass

    # Try to find a JSON object in the text.
    match = re.search(r"\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}", cleaned, re.DOTALL)
    if match:
        try:
            return json.loads(match.group())
        except json.JSONDecodeError:
            pass

    return {}


# ── Deterministic Fallbacks ───────────────────────────────────────────


def _extract_fallback_lead(prompt: str) -> Dict[str, Any]:
    """Deterministic fallback: parse keywords from prompt."""
    deal_value = 5000.00
    for token in prompt.split():
        cleaned = token.replace(",", "").replace("$", "")
        try:
            val = float(cleaned)
            if val > 0:
                deal_value = val
                break
        except ValueError:
            continue

    words = prompt.split()
    company = "Unknown Corp"
    for i, w in enumerate(words):
        if w[0:1].isupper() and len(w) > 1:
            parts = [w]
            for nw in words[i + 1:]:
                if nw[0:1].isupper() and len(nw) > 1:
                    parts.append(nw)
                else:
                    break
            if parts:
                company = " ".join(parts)
                break

    slug = company.lower().replace(" ", "")
    email = f"contact@{slug}.com"

    return {
        "company": company,
        "deal_value": deal_value,
        "contact_email": email,
        "lead_score": "A" if deal_value >= 10000 else ("B" if deal_value >= 5000 else "C"),
        "source": "inbound_prompt",
    }


def _generate_fallback_invoice(lead_data: Dict[str, Any]) -> Dict[str, Any]:
    """Deterministic fallback invoice from lead data."""
    company = lead_data.get("company", "Unknown")
    deal_value = lead_data.get("deal_value", 0.0)

    hash_input = f"{company}:{deal_value}".encode()
    inv_hash = hashlib.sha256(hash_input).hexdigest()[:8].upper()
    invoice_number = f"INV-{inv_hash}"

    tax_rate = 0.08
    subtotal = deal_value
    tax = round(subtotal * tax_rate, 2)
    total = round(subtotal + tax, 2)

    return {
        "invoice_number": invoice_number,
        "client_company": company,
        "contact_email": lead_data.get("contact_email", ""),
        "line_items": [
            {
                "description": f"Professional Services — {company}",
                "quantity": 1,
                "unit_price": subtotal,
                "amount": subtotal,
            }
        ],
        "subtotal_usd": subtotal,
        "tax_usd": tax,
        "tax_rate_pct": tax_rate * 100,
        "total_usd": total,
        "currency": "USD",
        "due_date": "NET-30",
        "status": "ISSUED",
    }
