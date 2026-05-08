from __future__ import annotations

import json
import time
from typing import Any, AsyncIterator, ClassVar, Optional

from ._http import post_json, stream_lines, get_json
from .base import BaseProvider
from .types import (
    FinishReason,
    ProviderCapabilities,
    ProviderRequest,
    ProviderResponse,
    StreamChunk,
    TokenUsage,
)

_BASE = "https://generativelanguage.googleapis.com/v1beta"


def _finish(value: Optional[str]) -> FinishReason:
    return {
        "STOP": FinishReason.STOP,
        "MAX_TOKENS": FinishReason.LENGTH,
        "SAFETY": FinishReason.CONTENT_FILTER,
        "RECITATION": FinishReason.CONTENT_FILTER,
    }.get(value or "", FinishReason.UNKNOWN)


def _extract_text(payload: dict[str, Any]) -> str:
    out: list[str] = []
    for cand in payload.get("candidates") or []:
        for part in (cand.get("content") or {}).get("parts") or []:
            t = part.get("text")
            if t:
                out.append(t)
    return "".join(out)


class GeminiProvider(BaseProvider):
    id: ClassVar[str] = "gemini"
    display_name: ClassVar[str] = "Google Gemini"
    capabilities: ClassVar[ProviderCapabilities] = ProviderCapabilities(
        streaming=True, json_mode=True, supports_system_prompt=True
    )

    @staticmethod
    def _headers() -> dict[str, str]:
        return {"Content-Type": "application/json"}

    @staticmethod
    def _payload(req: ProviderRequest) -> dict[str, Any]:
        body: dict[str, Any] = {
            "contents": [{"role": "user", "parts": [{"text": req.prompt}]}],
            "generationConfig": {"temperature": req.temperature},
        }
        if req.max_tokens:
            body["generationConfig"]["maxOutputTokens"] = req.max_tokens
        if req.system:
            body["systemInstruction"] = {"parts": [{"text": req.system}]}
        body.update(req.extra or {})
        return body

    async def generate(self, request: ProviderRequest) -> ProviderResponse:
        started = time.perf_counter()
        url = f"{_BASE}/models/{request.model_id}:generateContent?key={request.api_key}"
        data = await post_json(
            url,
            headers=self._headers(),
            payload=self._payload(request),
            timeout_s=request.timeout_s,
            provider=self.id,
        )
        latency = int((time.perf_counter() - started) * 1000)
        text = _extract_text(data)
        usage = data.get("usageMetadata") or {}
        cand = (data.get("candidates") or [{}])[0]
        return ProviderResponse(
            text=text,
            model_id=request.model_id,
            latency_ms=latency,
            usage=TokenUsage(
                input_tokens=int(usage.get("promptTokenCount", 0) or 0),
                output_tokens=int(usage.get("candidatesTokenCount", 0) or 0),
            ),
            finish_reason=_finish(cand.get("finishReason")),
        )

    async def stream(self, request: ProviderRequest) -> AsyncIterator[StreamChunk]:
        idx = 0
        url = f"{_BASE}/models/{request.model_id}:streamGenerateContent?alt=sse&key={request.api_key}"
        async for line in stream_lines(
            url,
            headers=self._headers(),
            payload=self._payload(request),
            timeout_s=request.timeout_s,
            provider=self.id,
        ):
            if not line or not line.startswith("data:"):
                continue
            raw = line[5:].strip()
            if not raw:
                continue
            try:
                payload = json.loads(raw)
            except Exception:
                continue
            text = _extract_text(payload)
            if text:
                yield StreamChunk(delta=text, index=idx)
                idx += 1
            cands = payload.get("candidates") or []
            if cands and cands[0].get("finishReason"):
                yield StreamChunk(delta="", index=idx, done=True)
                return

    async def validate_key(self, api_key: str) -> bool:
        status, _ = await get_json(
            f"{_BASE}/models?key={api_key}",
            headers=self._headers(),
            timeout_s=10.0,
        )
        return status == 200
