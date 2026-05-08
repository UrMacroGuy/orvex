from __future__ import annotations

from abc import ABC, abstractmethod
from typing import AsyncIterator, ClassVar

from .types import ProviderCapabilities, ProviderRequest, ProviderResponse, StreamChunk


class BaseProvider(ABC):
    id: ClassVar[str]
    display_name: ClassVar[str]
    capabilities: ClassVar[ProviderCapabilities]

    @abstractmethod
    async def generate(self, request: ProviderRequest) -> ProviderResponse:
        ...

    @abstractmethod
    def stream(self, request: ProviderRequest) -> AsyncIterator[StreamChunk]:
        ...

    @abstractmethod
    async def validate_key(self, api_key: str) -> bool:
        ...
