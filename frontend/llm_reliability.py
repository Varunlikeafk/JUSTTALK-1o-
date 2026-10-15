"""Reliable Groq calls: timeout on every call, retry only retryable errors with backoff,
then fall back to the next model. Put this file next to app.py."""
import logging
import os
import random
import time

import groq

log = logging.getLogger("llm")

RETRYABLE_STATUS = {429, 500, 502, 503, 504, 529}
PER_CALL_TIMEOUT = float(os.getenv("LLM_TIMEOUT", "25"))      # seconds, each attempt
RETRIES_PER_MODEL = int(os.getenv("LLM_RETRIES", "2"))        # retries after the first try
TOTAL_DEADLINE = float(os.getenv("LLM_DEADLINE", "50"))       # seconds, whole request
BACKOFF_BASE, BACKOFF_CAP = 0.6, 6.0
MAX_WAIT_FOR_RETRY_AFTER = 8.0   # longer than this (e.g. daily limit): skip to next model instead of waiting


def models_from_env(primary):
    """primary + optional comma-separated GROQ_FALLBACK_MODELS (empty = no fallback)."""
    extra = [m.strip() for m in os.getenv("GROQ_FALLBACK_MODELS", "").split(",") if m.strip()]
    return [primary] + [m for m in extra if m != primary]


def is_retryable(err):
    if isinstance(err, groq.APIConnectionError):          # includes APITimeoutError
        return True
    return isinstance(err, groq.APIStatusError) and err.status_code in RETRYABLE_STATUS


def _retry_after(err):
    try:
        v = err.response.headers.get("retry-after")
        return float(v) if v else None
    except Exception:
        return None


def _params_for(model, params):
    """Reasoning options only exist on reasoning models; other models would reject them with a 400."""
    p = dict(params)
    if "gpt-oss" in model:
        p.setdefault("reasoning_effort", "low")
        p.setdefault("reasoning_format", "parsed")
    return p


def chat_completion(client, models, messages, *, sleep=time.sleep, clock=time.monotonic, **params):
    """Return the first successful completion. Raises the last error if everything fails."""
    start, last = clock(), None
    for mi, model in enumerate(models):
        for attempt in range(RETRIES_PER_MODEL + 1):
            remaining = TOTAL_DEADLINE - (clock() - start)
            if remaining <= 1:
                log.warning("llm deadline reached before model=%s", model)
                raise last or TimeoutError("LLM deadline exceeded")
            try:
                res = client.chat.completions.create(
                    model=model, messages=messages,
                    timeout=min(PER_CALL_TIMEOUT, remaining), **_params_for(model, params))
                if mi or attempt:
                    log.info("llm answered model=%s attempt=%d fallback=%s", model, attempt + 1, bool(mi))
                return res
            except Exception as e:                          # noqa: BLE001
                last = e
                status = getattr(e, "status_code", type(e).__name__)
                if not is_retryable(e):                     # 400/401/403/validation: retrying cannot help
                    log.error("llm non-retryable model=%s status=%s", model, status)
                    raise
                ra = _retry_after(e)
                if attempt == RETRIES_PER_MODEL or (ra and ra > MAX_WAIT_FOR_RETRY_AFTER):
                    nxt = models[mi + 1] if mi + 1 < len(models) else None
                    log.warning("llm giving up on model=%s status=%s retry_after=%s next=%s", model, status, ra, nxt)
                    break
                wait = ra if ra else min(BACKOFF_CAP, BACKOFF_BASE * 2 ** attempt) * random.uniform(0.5, 1.0)
                if wait >= TOTAL_DEADLINE - (clock() - start):
                    break
                log.info("llm retry model=%s status=%s attempt=%d wait=%.1fs", model, status, attempt + 1, wait)
                sleep(wait)
    raise last
