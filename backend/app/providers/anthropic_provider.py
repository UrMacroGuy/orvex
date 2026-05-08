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

_BASE = "https://api.anthropic.com/v1"
_VERSION = "2023-06-01"


def _finish(value: Optional[str]) -> FinishReason:
    return {
        "end_turn": FinishReason.STOP,
        "stop_sequence": FinishReason.STOP,
        "max_tokens": FinishReason.LENGTH,
    }.get(value or "", FinishReason.UNKNOWN)


class AnthropicProvider(BaseProvider):
    id: ClassVar[str] = "anthropic"
    display_name: ClassVar[str] = "Anthropic"
    capabilities: ClassVar[ProviderCapabilities] = ProviderCapabilities(
        streaming=True, json_mode=False, supports_system_prompt=True
    )

    @staticmethod
    def _headers(api_key: str) -> dict[str, str]:
        return {
            "x-api-key": api_key,
            "anthropic-version": _VERSION,
            "Content-Type": "application/json",
        }

    @staticmethod
    def _payload(req: ProviderRequest, *, stream: bool) -> dict[str, Any]:
        body: dict[str, Any] = {
            "model": req.model_id,
            "messages": [{"role": "user", "content": req.prompt}],
            "max_tokens": req.max_tokens or 1024,
            "temperature": req.temperature,
            "stream": stream,
        }
        if req.system:
            body["system"] = req.system
        body.update(req.extra or {})
        return body

    async def generate(self, request: ProviderRequest) -> ProviderResponse:
        started = time.perf_counter()
        data = await post_json(
            f"{_BASE}/messages",
            headers=self._headers(request.api_key),
            payload=self._payload(request, stream=False),
            timeout_s=request.timeout_s,
            provider=self.id,
        )
        latency = int((time.perf_counter() - started) * 1000)
        text = "".join(
            block.get("text", "")
            for block in (data.get("content") or [])
            if block.get("type") == "text"
        )
        usage = data.get("usage") or {}
        return ProviderResponse(
            text=text,
            model_id=data.get("model", request.model_id),
            latency_ms=latency,
            usage=TokenUsage(
                input_tokens=int(usage.get("input_tokens", 0) or 0),
                output_tokens=int(usage.get("output_tokens", 0) or 0),
            ),
            finish_reason=_finish(data.get("stop_reason")),
        )

    async def stream(self, request: ProviderRequest) -> AsyncIterator[StreamChunk]:
        idx = 0
        async for line in stream_lines(
            f"{_BASE}/messages",
            headers=self._headers(request.api_key),
            payload=self._payload(request, stream=True),
            timeout_s=request.timeout_s,
            provider=self.id,
        ):
            if not line or not line.startswith("data:"):
                continue
            data_str = line[5:].strip()
            if not data_str:
                continue
            try:
                payload = json.loads(data_str)
            except Exception:
                continue
            t = payload.get("type")
            if t == "content_block_delta":
                delta = (payload.get("delta") or {}).get("text") or ""
                if delta:
                    yield StreamChunk(delta=delta, index=idx)
                    idx += 1
            elif t == "message_stop":
                yield StreamChunk(delta="", index=idx, done=True)
                return

    async def validate_key(self, api_key: str) -> bool:
        status, _ = await get_json(
            f"{_BASE}/models",
            headers=self._headers(api_key),
            timeout_s=10.0,
        )
        return status == 200
