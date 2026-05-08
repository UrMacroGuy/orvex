from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Optional
from uuid import UUID

from app.orchestration.normalizer import NormalizedResponse
from app.orchestration.pipeline import OrchestrationPipeline
from app.providers.registry import ProviderRegistry
from app.providers.registry import registry as default_registry
from app.schemas.financial import (
    CompanyProfile,
    FinancialQueryCreate,
    FinancialSynthesis,
)
from app.schemas.query import ModelSelection, QueryOptions

from .bearish_agent import BearishThesisAgent
from .bullish_agent import BullishThesisAgent
from .consensus_engine import ConsensusEngine
from .contradiction_engine import ContradictionEngine
from .market_research_agent import FinancialContext, MarketResearchAgent

log = logging.getLogger(__name__)


@dataclass
class FinancialPipelineResult:
    synthesis: FinancialSynthesis
    raw_responses: list[NormalizedResponse]


class FinancialOrchestrationPipeline:
    """Orchestrates financial research analysis across multiple models."""

    def __init__(
        self,
        *,
        key_resolver,
        registry: Optional[ProviderRegistry] = None,
        attempts: int = 2,
        timeout_s: float = 60.0,
    ) -> None:
        self._pipeline = OrchestrationPipeline(
            key_resolver=key_resolver,
            registry=registry or default_registry,
            attempts=attempts,
            timeout_s=timeout_s,
        )

        self._market_research = MarketResearchAgent()
        self._bullish = BullishThesisAgent()
        self._bearish = BearishThesisAgent()
        self._consensus = ConsensusEngine()
        self._contradiction = ContradictionEngine()

    async def run(
        self,
        *,
        user_id: UUID,
        payload: FinancialQueryCreate,
    ) -> FinancialPipelineResult:
        """Execute full financial research pipeline."""

        selected_models = [
            ModelSelection(provider_id=provider_id, model_id=model_id)
            for provider_id, model_id in payload.selected_models
        ]

        options = QueryOptions(
            web_research=payload.include_web_research,
            system_prompt=self._build_financial_prompt(payload.ticker),
        )

        log.info(
            "financial_pipeline_start",
            extra={"ticker": payload.ticker, "user_id": str(user_id)},
        )

        pipe_result = await self._pipeline.run(
            user_id=user_id,
            prompt=payload.query,
            selected_models=selected_models,
            options=options,
        )

        company = CompanyProfile(
            symbol=payload.ticker,
            name=payload.ticker,
            description="",
        )

        context = FinancialContext(
            ticker=payload.ticker,
            company_info=company,
            responses=pipe_result.responses,
        )

        market_research = self._market_research.analyze(context)
        bullish_theses = self._bullish.extract(pipe_result.responses)
        bearish_theses = self._bearish.extract(pipe_result.responses)
        consensus_points = self._consensus.detect(
            pipe_result.responses, focus_areas=payload.focus_areas
        )
        contradictions = self._contradiction.extract(
            pipe_result.responses, focus_areas=payload.focus_areas
        )

        investment_score = self._calculate_investment_score(
            bullish_theses, bearish_theses, consensus_points
        )

        synthesis = FinancialSynthesis(
            ticker=payload.ticker,
            company=company,
            bullish_theses=bullish_theses,
            bearish_theses=bearish_theses,
            consensus_points=consensus_points,
            contradictions=contradictions,
            investment_score=investment_score,
            key_questions=self._generate_key_questions(
                payload.ticker, contradictions, payload.focus_areas
            ),
            next_research_areas=self._suggest_research_areas(contradictions),
        )

        log.info(
            "financial_pipeline_complete",
            extra={
                "ticker": payload.ticker,
                "bullish": len(bullish_theses),
                "bearish": len(bearish_theses),
                "consensus": len(consensus_points),
                "contradictions": len(contradictions),
                "investment_score": investment_score,
            },
        )

        return FinancialPipelineResult(
            synthesis=synthesis,
            raw_responses=pipe_result.responses,
        )

    @staticmethod
    def _build_financial_prompt(ticker: str) -> str:
        """Build specialized financial analysis prompt."""
        return f"""You are a professional financial analyst. Provide a comprehensive investment analysis for {ticker}.

Structure your response to include:
1. Company Analysis: Business model, competitive position, key metrics
2. Sector Analysis: Industry trends, competitive landscape
3. Macro Analysis: Economic factors, interest rates, industry headwinds
4. Bullish Case: Growth catalysts, valuation opportunities, competitive advantages
5. Bearish Case: Risks, valuation concerns, macro threats
6. Investment Thesis: Overall assessment and key takeaways

Be specific, data-driven, and distinguish between facts and opinions."""

    @staticmethod
    def _calculate_investment_score(
        bullish: list,
        bearish: list,
        consensus: list,
    ) -> float:
        """Calculate overall investment score from theses."""
        if not bullish and not bearish:
            return 0.0

        bullish_score = sum(t.confidence for t in bullish) / max(1, len(bullish))
        bearish_score = sum(t.confidence for t in bearish) / max(1, len(bearish))

        raw_score = bullish_score - bearish_score
        consensus_factor = min(1.0, len(consensus) * 0.1)

        final_score = raw_score * (1.0 + consensus_factor)
        return max(-1.0, min(1.0, final_score))

    @staticmethod
    def _generate_key_questions(
        ticker: str, contradictions: list, focus_areas: Optional[list[str]] = None
    ) -> list[str]:
        """Generate key questions from contradictions."""
        questions: list[str] = []

        if contradictions:
            for contradiction in contradictions[:3]:
                question = f"On {contradiction.topic}, do the models agree? {contradiction.topic.title()} assessment varies."
                questions.append(question)

        default_questions = [
            f"What is the long-term sustainable competitive advantage of {ticker}?",
            f"How vulnerable is {ticker} to macro headwinds?",
            f"What catalyst could significantly change the investment case?",
        ]

        return questions[:3] or default_questions[:3]

    @staticmethod
    def _suggest_research_areas(contradictions: list) -> list[str]:
        """Suggest areas for deeper research."""
        areas: list[str] = []

        for contradiction in contradictions[:3]:
            areas.append(f"Deeper analysis on {contradiction.topic}")

        if not areas:
            areas = [
                "Management team track record",
                "Detailed financial projections",
                "Competitive positioning",
            ]

        return areas[:3]
