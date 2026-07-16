"""Document OCR / structural extraction pipeline.

Sends an uploaded document straight to Gemini's multimodal endpoint and asks
for the financial vectors back as strict JSON. There is deliberately no local
OCR step: Gemini reads PDFs and images natively, which avoids shipping a
system binary (tesseract) and one lossy text-conversion hop.
"""

from __future__ import annotations

import json
import logging
import time
from typing import Any, Dict, Tuple

from app.engine.llm_clients import (
    SUPPORTED_VISION_MIME_TYPES,
    LLMResponse,
    VisionUnavailableError,
    call_gemini_vision,
)
from app.schemas.databank import ExtractedInvoice

logger = logging.getLogger(__name__)

#: Substrings identifying a failure that is worth retrying. The free tier
#: returns 503 UNAVAILABLE ("high demand") and 429 RESOURCE_EXHAUSTED often
#: enough that a single blip should not permanently fail an upload.
_TRANSIENT_MARKERS = (
    "503",
    "UNAVAILABLE",
    "429",
    "RESOURCE_EXHAUSTED",
    "500",
    "INTERNAL",
    "deadline",
    "timeout",
)

MAX_ATTEMPTS = 3
_BACKOFF_BASE_SECONDS = 2.0


def _is_transient(exc: Exception) -> bool:
    """Whether ``exc`` looks like a temporary upstream condition."""
    text = str(exc).lower()
    return any(marker.lower() in text for marker in _TRANSIENT_MARKERS)


EXTRACTION_SYSTEM_PROMPT = """You are a precise document data-extraction engine \
for an enterprise finance system.

You will be given a single document — typically an invoice — as an image or PDF.
Read it and return ONLY the structured financial data it actually contains.

Rules you must follow:
- Transcribe values exactly as printed. Never invent, infer, or "tidy up" a value.
- If a field is absent, unreadable, or you are not confident, return null for it.
  A null is correct and useful; a guess is a data-integrity bug.
- total_amount must be the final payable total (after tax/discounts), as a plain
  number with no currency symbol or thousands separators.
- currency must be the ISO-4217 code (USD, SGD, IDR, VND, MYR, ...). Infer it
  from an unambiguous symbol only (e.g. "$" alone is ambiguous — prefer null
  unless the document states the code or context is explicit).
- issue_date must be ISO-8601 (YYYY-MM-DD). If only a partial date is legible,
  return null rather than padding it.
- line_items must contain one entry per billed row actually present. If the
  document has no itemised rows, return an empty list.
"""

EXTRACTION_PROMPT = (
    "Extract the financial data from this document and return it as JSON "
    "matching the required schema. Use null for anything not clearly present."
)


class UnsupportedDocumentError(ValueError):
    """Raised when the uploaded MIME type cannot be read by the vision model."""


def _call_with_retry(file_bytes: bytes, mime_type: str) -> LLMResponse:
    """Call the vision model, retrying transient upstream failures.

    Runs on a worker thread (the caller wraps it in ``asyncio.to_thread``), so
    the blocking sleep here does not stall the event loop.

    A misconfiguration or a permanently retired model fails immediately —
    only conditions that might clear on their own are retried.
    """
    last_exc: Exception = RuntimeError("extraction never ran")

    for attempt in range(1, MAX_ATTEMPTS + 1):
        try:
            return call_gemini_vision(
                file_bytes=file_bytes,
                mime_type=mime_type,
                prompt=EXTRACTION_PROMPT,
                system_prompt=EXTRACTION_SYSTEM_PROMPT,
                response_schema=ExtractedInvoice,
            )
        except VisionUnavailableError:
            raise  # No API key — retrying cannot help.
        except Exception as exc:  # noqa: BLE001 — classified immediately below
            last_exc = exc
            if attempt == MAX_ATTEMPTS or not _is_transient(exc):
                raise
            delay = _BACKOFF_BASE_SECONDS * (2 ** (attempt - 1))
            logger.warning(
                "Vision call attempt %d/%d failed transiently (%s) — retrying in %.0fs",
                attempt,
                MAX_ATTEMPTS,
                exc,
                delay,
            )
            time.sleep(delay)

    raise last_exc


def extract_document_fields(
    file_bytes: bytes,
    mime_type: str,
) -> Tuple[Dict[str, Any], LLMResponse]:
    """Extract structured invoice fields from a document.

    Returns the parsed payload alongside the raw :class:`LLMResponse` so the
    caller can record cost/token telemetry if it wants to.

    Raises:
        UnsupportedDocumentError: if ``mime_type`` is not vision-readable.
        ValueError: if the model returns something that is not usable JSON.
    """
    if mime_type not in SUPPORTED_VISION_MIME_TYPES:
        raise UnsupportedDocumentError(
            f"{mime_type!r} cannot be read. Supported: "
            f"{', '.join(sorted(SUPPORTED_VISION_MIME_TYPES))}"
        )

    response = _call_with_retry(file_bytes, mime_type)

    text = (response.text or "").strip()
    if not text:
        raise ValueError("Extraction model returned an empty response.")

    try:
        payload = json.loads(text)
    except json.JSONDecodeError as exc:
        logger.warning("Extraction returned non-JSON: %s", text[:200])
        raise ValueError(f"Extraction model returned malformed JSON: {exc}") from exc

    # Round-trip through the schema so the stored shape is always consistent,
    # even if the model omits keys.
    validated = ExtractedInvoice.model_validate(payload)
    return validated.model_dump(mode="json"), response
