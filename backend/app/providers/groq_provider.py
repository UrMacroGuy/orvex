from __future__ import annotations

from typing import Any, AsyncIterator, ClassVar, Optional

from ._http import post_json, stream_lines
from .base import BaseProvider
from .types import (
    FinishReason,
    ProviderCapabilities,
    ProviderRequest,
    ProviderResponse,
    StreamChunk,
    TokenUsage,
)

_BASE = "https://api.groq.com/openai/v1"


class GroqProvider(BaseProvider):
    id: ClassVar[str] = "groq"
    display_name: ClassVar[str] = "Groq"
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
        return body

    async def generate(self, request: ProviderRequest) -> ProviderResponse:
        # Simplified implementation based on OpenAI
        data = await post_json(
            f"{_BASE}/chat/completions",
            headers=self._headers(request.api_key),
            payload=self._payload(request, stream=False),
            timeout_s=request.timeout_s,
            provider=self.id,
        )
        choice = (data.get("choices") or [{}])[0]
        return ProviderResponse(
            text=(choice.get("message") or {}).get("content") or "",
            model_id=data.get("model", request.model_id),
            latency_ms=0, # Need latency tracking implementation
            usage=TokenUsage(input_tokens=0, output_tokens=0),
            finish_reason=FinishReason.STOP,
        )

    async def stream(self, request: ProviderRequest) -> AsyncIterator[StreamChunk]:
        # Stream implementation similarly mirrors OpenAI
        pass

    async def validate_key(self, api_key: str) -> bool:
        # Implement key validation
        return True
