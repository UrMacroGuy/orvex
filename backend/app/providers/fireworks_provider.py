from __future__ import annotations
from typing import Any, AsyncIterator, ClassVar
from .base import BaseProvider
from .types import ProviderCapabilities, ProviderRequest, ProviderResponse, TokenUsage, FinishReason

class FireworksProvider(BaseProvider):
    id: ClassVar[str] = "fireworks"
    display_name: ClassVar[str] = "Fireworks AI"
    capabilities: ClassVar[ProviderCapabilities] = ProviderCapabilities(
        streaming=True, json_mode=True, supports_system_prompt=True
    )

    async def generate(self, request: ProviderRequest) -> ProviderResponse:
        return ProviderResponse(text="Fireworks AI response", model_id=request.model_id, latency_ms=0, usage=TokenUsage(input_tokens=0, output_tokens=0), finish_reason=FinishReason.STOP)

    async def stream(self, request: ProviderRequest) -> AsyncIterator:
        yield None

    async def validate_key(self, api_key: str) -> bool:
        return True
