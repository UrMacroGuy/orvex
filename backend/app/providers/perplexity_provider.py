from __future__ import annotations
from typing import Any, AsyncIterator, ClassVar
from .base import BaseProvider
from .types import ProviderCapabilities, ProviderRequest, ProviderResponse, TokenUsage, FinishReason

class PerplexityProvider(BaseProvider):
    id: ClassVar[str] = "perplexity"
    display_name: ClassVar[str] = "Perplexity"
    capabilities: ClassVar[ProviderCapabilities] = ProviderCapabilities(
        streaming=True, json_mode=True, supports_system_prompt=True
    )

    async def generate(self, request: ProviderRequest) -> ProviderResponse:
        return ProviderResponse(text="Perplexity response", model_id=request.model_id, latency_ms=0, usage=TokenUsage(input_tokens=0, output_tokens=0), finish_reason=FinishReason.STOP)

    async def stream(self, request: ProviderRequest) -> AsyncIterator:
        yield None

    async def validate_key(self, api_key: str) -> bool:
        return True
