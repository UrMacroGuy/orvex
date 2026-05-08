from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Iterable, Optional, Protocol
from uuid import UUID

from app.providers import ProviderRequest
from app.providers.errors import ProviderError
from app.providers.registry import ProviderRegistry
from app.schemas.finance import ResearchType
from app.schemas.query import ModelSelection, QueryOptions

log = logging.getLogger(__name__)

DEFAULT_TIMEOUT_S = 60.0

_FINANCE_SYSTEM_PROMPTS: dict[ResearchType, str] = {
    ResearchType.STOCK: (
        "You are an elite equity research analyst at a top-tier investment bank. Analyze the given stock "
        "with rigorous fundamental and technical analysis. Provide clear bullish and bearish signals, "
        "valuation perspective, key risks, and an investment thesis. Use precise financial terminology "
        "and support claims with logical reasoning. Distinguish between facts and estimates."
    ),
    ResearchType.EARNINGS: (
        "You are a senior financial analyst specializing in earnings analysis. Evaluate earnings results "
        "against consensus estimates, analyze EPS beats/misses, revenue trends, margin dynamics, and "
        "management guidance. Assess forward-looking statements critically and identify key post-earnings "
        "catalysts and risks. Quantify beats and misses where possible."
    ),
    ResearchType.MACRO: (
        "You are a macroeconomic strategist at a global asset manager. Analyze macro trends including "
        "central bank policy, inflation dynamics, interest rate trajectory, GDP growth, labor markets, "
        "and geopolitical factors. Assess their impact on financial markets, asset allocation, and sector "
        "rotation. Support analysis with data and historical precedents."
    ),
    ResearchType.SECTOR: (
        "You are an industry and sector research analyst. Provide deep sector analysis covering competitive "
        "dynamics, structural growth trends, regulatory environment, supply chain dynamics, and valuation "
        "multiples. Identify sector leaders and laggards, and highlight sector rotation signals. "
        "Compare sector performance against benchmarks."
    ),
    ResearchType.COMPANY: (
        "You are a fundamental equity analyst conducting deep company research. Analyze business model "
        "quality, competitive moat, management track record, balance sheet health, cash flow generation, "
        "growth catalysts, and valuation. Provide an objective bull and bear case with supporting evidence."
    ),
    ResearchType.CRYPTO: (
        "You are a digital asset research analyst. Analyze the given cryptocurrency or protocol with focus "
        "on tokenomics, on-chain metrics, network adoption, protocol fundamentals, competitive positioning, "
        "regulatory environment, and market structure. Distinguish between short-term speculation and "
        "long-term fundamental value drivers."
    ),
}

_DEFAULT_FINANCE_PROMPT = (
    "You are a professional financial research analyst. Provide rigorous, data-driven analysis. "
    "Clearly distinguish between confirmed facts, analyst estimates, and model opinions. "
    "Identify key risks and opportunities with supporting reasoning."
)


class KeyResolver(Protocol):
    async def resolve(self, user_id: UUID, provider_id: str) -> str: ...


@dataclass(slots=True)
class RoutedCall:
    provider_id: str
    model_id: str
    request: ProviderRequest


class QueryRouter:
    def __init__(
        self,
        registry: ProviderRegistry,
        key_resolver: KeyResolver,
        *,
        timeout_s: float = DEFAULT_TIMEOUT_S,
    ) -> None:
        self._registry = registry
        self._keys = key_resolver
        self._timeout = timeout_s

    async def route(
        self,
        *,
        user_id: UUID,
        prompt: str,
        selected: Iterable[ModelSelection],
        options: QueryOptions,
    ) -> list[RoutedCall]:
        system = options.system_prompt or self._resolve_system_prompt(options)
        calls: list[RoutedCall] = []
        for sel in selected:
            provider_id = sel.provider_id.value
            if not self._registry.has(provider_id):
                raise ProviderError(f"unknown provider: {provider_id!r}")
            api_key = await self._keys.resolve(user_id, provider_id)
            calls.append(
                RoutedCall(
                    provider_id=provider_id,
                    model_id=sel.model_id,
                    request=ProviderRequest(
                        model_id=sel.model_id,
                        prompt=prompt,
                        api_key=api_key,
                        system=system,
                        temperature=options.temperature,
                        max_tokens=options.max_tokens,
                        timeout_s=self._timeout,
                    ),
                )
            )
        log.info(
            "router_built_calls",
            extra={"user_id": str(user_id), "n_calls": len(calls)},
        )
        return calls

    @staticmethod
    def _resolve_system_prompt(options: QueryOptions) -> Optional[str]:
        if options.research_type is None:
            return None
        return _FINANCE_SYSTEM_PROMPTS.get(options.research_type, _DEFAULT_FINANCE_PROMPT)
