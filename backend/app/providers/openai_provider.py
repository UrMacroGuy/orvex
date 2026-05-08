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

_BASE = "https://api.openai.com/v1"


def _finish(value: Optional[str]) -> FinishReason:
    return {
        "stop": FinishReason.STOP,
        "length": FinishReason.LENGTH,
        "content_filter": FinishReason.CONTENT_FILTER,
    }.get(value or "", FinishReason.UNKNOWN)


class OpenAIProvider(BaseProvider):
    id: ClassVar[str] = "openai"
    display_name: ClassVar[str] = "OpenAI"
    capabilities: ClassVar[ProviderCapabilities] = ProviderCapabilities(
        streaming=True, json_mode=True, supports_system_prompt=True
    )

    @staticmethod
    def _headers(api_key: str) -> dict[str, str]:
        return {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        }

    @staticmethod
    def _payload(req: ProviderRequest, *, stream: bool) -> dict[str, Any]:
        messages: list[dict[str, str]] = []
        if req.system:
            messages.append({"role": "system", "content": req.system})
        messages.append({"role": "user", "content": req.prompt})
        body: dict[str, Any] = {
            "model": req.model_id,
            "messages": messages,
            "temperature": req.temperature,
            "stream": stream,
        }
        if req.max_tokens:
            body["max_tokens"] = req.max_tokens
        body.update(req.extra or {})
        return body

    async def generate(self, request: ProviderRequest) -> ProviderResponse:
        started = time.perf_counter()
        data = await post_json(
            f"{_BASE}/chat/completions",
            headers=self._headers(request.api_key),
            payload=self._payload(request, stream=False),
            timeout_s=request.timeout_s,
            provider=self.id,
        )
        latency = int((time.perf_counter() - started) * 1000)
        choice = (data.get("choices") or [{}])[0]
        msg = (choice.get("message") or {}).get("content") or ""
        usage = data.get("usage") or {}
        return ProviderResponse(
            text=msg,
            model_id=data.get("model", request.model_id),
            latency_ms=latency,
            usage=TokenUsage(
                input_tokens=int(usage.get("prompt_tokens", 0) or 0),
                output_tokens=int(usage.get("completion_tokens", 0) or 0),
            ),
            finish_reason=_finish(choice.get("finish_reason")),
        )

    async def stream(self, request: ProviderRequest) -> AsyncIterator[StreamChunk]:
        idx = 0
        async for line in stream_lines(
            f"{_BASE}/chat/completions",
            headers=self._headers(request.api_key),
            payload=self._payload(request, stream=True),
            timeout_s=request.timeout_s,
            provider=self.id,
        ):
            if not line or not line.startswith("data:"):
                continue
            data = line[5:].strip()
            if data == "[DONE]":
                yield StreamChunk(delta="", index=idx, done=True)
                return
            try:
                payload = json.loads(data)
            except Exception:
                continue
            choices = payload.get("choices") or []
            if not choices:
                continue
            delta = (choices[0].get("delta") or {}).get("content") or ""
            if delta:
                yield StreamChunk(delta=delta, index=idx)
                idx += 1

    async def validate_key(self, api_key: str) -> bool:
        status, _ = await get_json(
            f"{_BASE}/models",
            headers=self._headers(api_key),
            timeout_s=10.0,
        )
        return status == 200
