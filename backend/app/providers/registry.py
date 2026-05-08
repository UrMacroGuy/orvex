from __future__ import annotations

from typing import Iterable

from .anthropic_provider import AnthropicProvider
from .base import BaseProvider
from .errors import ProviderError
from .gemini_provider import GeminiProvider
from .openai_provider import OpenAIProvider
from .openrouter_provider import OpenRouterProvider
from .groq_provider import GroqProvider
from .together_provider import TogetherProvider
from .deepseek_provider import DeepSeekProvider
from .cohere_provider import CohereProvider
from .mistral_provider import MistralProvider
from .fireworks_provider import FireworksProvider
from .perplexity_provider import PerplexityProvider

class ProviderRegistry:
    def __init__(self) -> None:
        self._providers: dict[str, BaseProvider] = {}

    def register(self, provider: BaseProvider) -> None:
        if not getattr(provider, "id", None):
            raise ValueError("provider must define a non-empty `id`")
        self._providers[provider.id] = provider

    def get(self, provider_id: str) -> BaseProvider:
        try:
            return self._providers[provider_id]
        except KeyError as e:
            raise ProviderError(f"unknown provider: {provider_id!r}") from e

    def has(self, provider_id: str) -> bool:
        return provider_id in self._providers

    def all(self) -> Iterable[BaseProvider]:
        return self._providers.values()

    def ids(self) -> list[str]:
        return list(self._providers.keys())


def build_default_registry() -> ProviderRegistry:
    reg = ProviderRegistry()
    reg.register(OpenAIProvider())
    reg.register(AnthropicProvider())
    reg.register(GeminiProvider())
    reg.register(OpenRouterProvider())
    reg.register(GroqProvider())
    reg.register(TogetherProvider())
    reg.register(DeepSeekProvider())
    reg.register(CohereProvider())
    reg.register(MistralProvider())
    reg.register(FireworksProvider())
    reg.register(PerplexityProvider())
    return reg


registry: ProviderRegistry = build_default_registry()
