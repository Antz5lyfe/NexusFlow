"""LLM provider clients and cost calculation engine.

Three thin wrappers for the free-tier LLM providers specified in the PRD:

1. **Google AI Studio** (``google-genai`` SDK) → ``gemini-2.5-flash``
2. **GitHub Models** (``openai`` SDK) → ``meta/llama-3.3-70b-instruct`` / ``openai/gpt-4o-mini``
3. **HuggingFace Serverless** (``httpx``) → ASEAN models

Each client returns a uniform ``LLMResponse`` so agents don't care which
provider they're talking to.  A static cost-rate table converts token
counts into synthetic USD costs for the ROI dashboard (PRD §3.2 FR-2.1).
"""

from __future__ import annotations

import json
import logging
from dataclasses import asdict, dataclass, field
from typing import Any, Dict, Optional

import httpx

from app.config import get_settings

logger = logging.getLogger(__name__)

_settings = get_settings()


# ── Uniform Response ──────────────────────────────────────────────────


@dataclass
class LLMResponse:
    """Normalised response from any LLM provider."""

    text: str
    model_used: str
    prompt_tokens: int = 0
    completion_tokens: int = 0
    routing_strategy: str = "DEFAULT"

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


# ── Cost Rate Table (USD per 1 M tokens) ──────────────────────────────
#
# These are *market* rates used to calculate theoretical costs even
# though the developer-tier calls are free.  The ``baseline_model``
# (gpt-4o) rate is used to compute ``estimated_savings_usd``.

COST_PER_1M_TOKENS: Dict[str, Dict[str, float]] = {
    # Google AI Studio — free tier
    "gemini-2.5-flash": {"input": 0.15, "output": 0.60},
    "gemini-3.5-flash": {"input": 0.15, "output": 0.60},
    # GitHub Models — free tier
    "meta/llama-3.3-70b-instruct": {"input": 0.60, "output": 0.60},
    "openai/gpt-4o-mini": {"input": 0.15, "output": 0.60},
    # HuggingFace Serverless — free tier
    "aisglab/Gemma-7B-Sea-Lion": {"input": 0.20, "output": 0.20},
    # Baseline for savings calculation (premium model)
    "openai/gpt-4o": {"input": 2.50, "output": 10.00},
}

BASELINE_MODEL = "openai/gpt-4o"


# ── Cost Calculator ───────────────────────────────────────────────────


@dataclass
class CostEntry:
    """Token cost breakdown for a single LLM call."""

    model_used: str = ""
    prompt_tokens: int = 0
    completion_tokens: int = 0
    raw_cost_usd: float = 0.0
    estimated_savings_usd: float = 0.0
    routing_strategy: str = "DEFAULT"

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


def calculate_cost(
    response: LLMResponse,
    baseline_model: str = BASELINE_MODEL,
) -> CostEntry:
    """Compute theoretical cost and savings for an LLM call.

    ``raw_cost_usd`` = what it *would* cost at market rates.
    ``estimated_savings_usd`` = baseline_cost − raw_cost (≥ 0).
    """
    rates = COST_PER_1M_TOKENS.get(
        response.model_used,
        {"input": 0.50, "output": 1.00},  # conservative fallback
    )
    baseline_rates = COST_PER_1M_TOKENS.get(
        baseline_model,
        {"input": 2.50, "output": 10.00},
    )

    raw_cost = (
        response.prompt_tokens * rates["input"]
        + response.completion_tokens * rates["output"]
    ) / 1_000_000

    baseline_cost = (
        response.prompt_tokens * baseline_rates["input"]
        + response.completion_tokens * baseline_rates["output"]
    ) / 1_000_000

    savings = max(baseline_cost - raw_cost, 0.0)

    return CostEntry(
        model_used=response.model_used,
        prompt_tokens=response.prompt_tokens,
        completion_tokens=response.completion_tokens,
        raw_cost_usd=round(raw_cost, 8),
        estimated_savings_usd=round(savings, 8),
        routing_strategy=response.routing_strategy,
    )


# ── 1. Google AI Studio (Gemini) ──────────────────────────────────────


def call_gemini(
    prompt: str,
    system_prompt: str = "",
    model: str = "gemini-2.5-flash",
) -> LLMResponse:
    """Call Google AI Studio via the ``google-genai`` SDK.

    Falls back to a stub response if the API key is missing or the call
    fails, so the workflow never crashes on configuration issues.
    """
    api_key = _settings.GEMINI_API_KEY
    if not api_key:
        logger.warning("GEMINI_API_KEY not set — returning stub response")
        return _stub_response(model, prompt, "DYNAMIC_ROUTING")

    try:
        from google import genai

        client = genai.Client(api_key=api_key)

        contents = prompt
        config = None
        if system_prompt:
            config = genai.types.GenerateContentConfig(
                system_instruction=system_prompt,
            )

        response = client.models.generate_content(
            model=model,
            contents=contents,
            config=config,
        )

        text = response.text or ""

        # Extract token counts from usage metadata.
        prompt_tokens = 0
        completion_tokens = 0
        if hasattr(response, "usage_metadata") and response.usage_metadata:
            prompt_tokens = getattr(response.usage_metadata, "prompt_token_count", 0) or 0
            completion_tokens = getattr(response.usage_metadata, "candidates_token_count", 0) or 0

        return LLMResponse(
            text=text,
            model_used=model,
            prompt_tokens=prompt_tokens,
            completion_tokens=completion_tokens,
            routing_strategy="DYNAMIC_ROUTING",
        )

    except Exception as exc:
        logger.exception("Gemini call failed: %s", exc)
        return _stub_response(model, prompt, "DYNAMIC_ROUTING")


# ── 1b. Google AI Studio — Vision / document understanding ────────────


#: MIME types Gemini can read natively. PDFs and images go straight to the
#: model, so no local OCR binary (tesseract et al.) is involved.
SUPPORTED_VISION_MIME_TYPES = frozenset(
    {
        "application/pdf",
        "image/png",
        "image/jpeg",
        "image/jpg",
        "image/webp",
        "image/heic",
        "image/heif",
    }
)

#: Default model for document understanding. Note that ``gemini-2.5-flash``
#: (still the default elsewhere in this module) now 404s with "no longer
#: available to new users", so vision pins a current model explicitly.
VISION_MODEL = "gemini-3.5-flash"


class VisionUnavailableError(RuntimeError):
    """Raised when the vision model cannot be reached or is misconfigured."""


def call_gemini_vision(
    file_bytes: bytes,
    mime_type: str,
    prompt: str,
    system_prompt: str = "",
    model: str = VISION_MODEL,
    response_schema: Optional[Any] = None,
) -> LLMResponse:
    """Send a document (PDF/image) to Gemini and get text or JSON back.

    Gemini is natively multimodal, so the raw file bytes are passed through
    rather than being pre-OCR'd locally.

    When ``response_schema`` is supplied the model is constrained to emit
    JSON matching it, which is far more dependable than asking for JSON in
    the prompt and hoping.

    Unlike the other clients in this module, this one **raises** instead of
    degrading to a stub. The workflow agents return stubs so a graph run
    survives a bad API key; extraction is the opposite case — its whole job
    is to report an outcome, and a stub would be recorded as a successful
    parse containing fabricated data. The caller persists the real error.

    Raises:
        VisionUnavailableError: no API key configured.
        Exception: whatever the SDK raised (404 retired model, 429 quota, …),
            propagated verbatim so the true cause reaches the operator.
    """
    api_key = _settings.GEMINI_API_KEY
    if not api_key:
        raise VisionUnavailableError(
            "GEMINI_API_KEY is not configured — document extraction is unavailable."
        )

    from google import genai
    from google.genai import types

    client = genai.Client(api_key=api_key)

    config_kwargs: Dict[str, Any] = {}
    if system_prompt:
        config_kwargs["system_instruction"] = system_prompt
    if response_schema is not None:
        config_kwargs["response_mime_type"] = "application/json"
        config_kwargs["response_schema"] = response_schema

    response = client.models.generate_content(
        model=model,
        contents=[
            types.Part.from_bytes(data=file_bytes, mime_type=mime_type),
            prompt,
        ],
        config=types.GenerateContentConfig(**config_kwargs) if config_kwargs else None,
    )

    prompt_tokens = 0
    completion_tokens = 0
    if getattr(response, "usage_metadata", None):
        prompt_tokens = getattr(response.usage_metadata, "prompt_token_count", 0) or 0
        completion_tokens = getattr(response.usage_metadata, "candidates_token_count", 0) or 0

    return LLMResponse(
        text=response.text or "",
        model_used=model,
        prompt_tokens=prompt_tokens,
        completion_tokens=completion_tokens,
        routing_strategy="VISION_OCR",
    )


# ── 2. GitHub Models (OpenAI SDK) ─────────────────────────────────────


def call_github_models(
    prompt: str,
    system_prompt: str = "",
    model: str = "openai/gpt-4o-mini",
) -> LLMResponse:
    """Call GitHub Models via the OpenAI Python client.

    Base URL: https://models.github.ai/inference
    Auth:     GITHUB_MODELS_TOKEN
    """
    token = _settings.GITHUB_MODELS_TOKEN
    if not token:
        logger.warning("GITHUB_MODELS_TOKEN not set — returning stub response")
        return _stub_response(model, prompt, "DEFAULT")

    try:
        from openai import OpenAI

        client = OpenAI(
            base_url="https://models.github.ai/inference",
            api_key=token,
        )

        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": prompt})

        response = client.chat.completions.create(
            model=model,
            messages=messages,
            temperature=0.3,
        )

        text = response.choices[0].message.content or ""
        usage = response.usage

        return LLMResponse(
            text=text,
            model_used=model,
            prompt_tokens=usage.prompt_tokens if usage else 0,
            completion_tokens=usage.completion_tokens if usage else 0,
            routing_strategy="DEFAULT",
        )

    except Exception as exc:
        logger.exception("GitHub Models call failed: %s", exc)
        return _stub_response(model, prompt, "DEFAULT")


# ── 3. HuggingFace Serverless Inference ───────────────────────────────


def call_huggingface(
    prompt: str,
    system_prompt: str = "",
    model: str = "aisglab/Gemma-7B-Sea-Lion",
) -> LLMResponse:
    """Call HuggingFace Serverless Inference API via httpx.

    This is used for regional ASEAN models. The endpoint format is:
    ``https://router.huggingface.co/hf-inference/models/{model}/v1/chat/completions``
    """
    api_key = _settings.HF_API_KEY
    if not api_key:
        logger.warning("HF_API_KEY not set — returning stub response")
        return _stub_response(model, prompt, "DYNAMIC_ROUTING")

    try:
        url = f"https://router.huggingface.co/hf-inference/models/{model}/v1/chat/completions"

        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": prompt})

        payload = {
            "model": model,
            "messages": messages,
            "temperature": 0.3,
            "max_tokens": 1024,
        }

        with httpx.Client(timeout=60.0) as client:
            resp = client.post(
                url,
                json=payload,
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json",
                },
            )
            resp.raise_for_status()
            data = resp.json()

        text = data.get("choices", [{}])[0].get("message", {}).get("content", "")
        usage = data.get("usage", {})

        return LLMResponse(
            text=text,
            model_used=model,
            prompt_tokens=usage.get("prompt_tokens", 0),
            completion_tokens=usage.get("completion_tokens", 0),
            routing_strategy="DYNAMIC_ROUTING",
        )

    except Exception as exc:
        logger.exception("HuggingFace call failed: %s", exc)
        return _stub_response(model, prompt, "DYNAMIC_ROUTING")


# ── Stub Fallback ─────────────────────────────────────────────────────


def _stub_response(
    model: str,
    prompt: str,
    routing_strategy: str,
) -> LLMResponse:
    """Return a synthetic response when no API key is configured.

    Estimates token counts from character length so cost calculations
    still produce meaningful numbers for the dashboard.
    """
    # Rough estimate: ~4 chars per token.
    est_prompt_tokens = max(len(prompt) // 4, 10)
    est_completion_tokens = max(est_prompt_tokens // 2, 10)

    return LLMResponse(
        text="[STUB] No API key configured — returning synthetic response for cost tracking.",
        model_used=model,
        prompt_tokens=est_prompt_tokens,
        completion_tokens=est_completion_tokens,
        routing_strategy=routing_strategy,
    )
