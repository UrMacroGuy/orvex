from __future__ import annotations

from typing import Optional

from app.providers.registry import ProviderRegistry
from app.providers.registry import registry as default_registry
from app.schemas.provider import (
    ProviderCapabilities,
    ProviderId,
    ProviderInfo,
    ProviderModelInfo,
)

# Finance-optimized model catalog — ordered by capability for financial research
_MODELS: dict[str, list[tuple[str, str]]] = {
    "openai": [
        ("gpt-4o", "GPT-4o — Deep financial analysis"),
        ("gpt-4o-mini", "GPT-4o Mini — Fast market intelligence"),
        ("o3-mini", "o3-mini — Quantitative reasoning"),
    ],
    "anthropic": [
        ("claude-opus-4-5", "Claude Opus 4.5 — Comprehensive research"),
        ("claude-sonnet-4-5", "Claude Sonnet 4.5 — Balanced analysis"),
        ("claude-haiku-4-5", "Claude Haiku 4.5 — Rapid screening"),
    ],
    "gemini": [
        ("gemini-2.0-flash", "Gemini 2.0 Flash — Real-time intelligence"),
        ("gemini-2.0-pro", "Gemini 2.0 Pro — Macro & sector depth"),
    ],
    "openrouter": [
        ("openrouter/auto", "OpenRouter Auto — Best available model"),
        ("meta-llama/llama-3.3-70b-instruct", "Llama 3.3 70B — Open-source research"),
        ("mistralai/mixtral-8x22b-instruct", "Mixtral 8x22B — European market focus"),
        ("deepseek/deepseek-r1", "DeepSeek R1 — Quantitative analysis"),
    ],
}


class ProviderService:
    def __init__(self, registry: Optional[ProviderRegistry] = None) -> None:
        self._registry = registry or default_registry

    async def list(self) -> list[ProviderInfo]:
        out: list[ProviderInfo] = []
        for p in self._registry.all():
            caps = ProviderCapabilities(
                streaming=p.capabilities.streaming,
                json_mode=p.capabilities.json_mode,
                supports_system_prompt=p.capabilities.supports_system_prompt,
                max_input_tokens=p.capabilities.max_input_tokens,
                max_output_tokens=p.capabilities.max_output_tokens,
            )
            models = [
                ProviderModelInfo(
                    model_id=mid,
                    display_name=disp,
                    capabilities=caps,
                )
                for mid, disp in _MODELS.get(p.id, [])
            ]
            out.append(
                ProviderInfo(
                    provider_id=ProviderId(p.id),
                    display_name=p.display_name,
                    models=models,
                    requires_byok=True,
                )
            )
        return out
