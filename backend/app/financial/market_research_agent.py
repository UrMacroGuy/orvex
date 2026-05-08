from __future__ import annotations

import logging
from dataclasses import dataclass

from app.orchestration.normalizer import NormalizedResponse
from app.schemas.financial import CompanyProfile, MarketResearchResult
from app.schemas.provider import ProviderId

log = logging.getLogger(__name__)


@dataclass
class FinancialContext:
    ticker: str
    company_info: CompanyProfile
    responses: list[NormalizedResponse]


class MarketResearchAgent:
    """Analyzes company, sector, and macro factors from model responses."""

    def analyze(self, context: FinancialContext) -> list[MarketResearchResult]:
        """Extract market research insights from all responses."""
        results: list[MarketResearchResult] = []

        for response in context.responses:
            if not response.text:
                continue

            result = self._extract_research(
                response=response,
                ticker=context.ticker,
                company=context.company_info,
            )
            if result:
                results.append(result)

        log.info(
            "market_research_complete",
            extra={
                "ticker": context.ticker,
                "count": len(results),
            },
        )
        return results

    @staticmethod
    def _extract_research(
        response: NormalizedResponse,
        ticker: str,
        company: CompanyProfile,
    ) -> MarketResearchResult | None:
        """Parse response for company, sector, and macro analysis."""
        if not response.text:
            return None

        text = response.text.lower()

        company_analysis = MarketResearchAgent._find_section(
            text,
            ["company analysis", "business model", "competitive position"],
            response.text,
        )
        sector_analysis = MarketResearchAgent._find_section(
            text,
            ["sector analysis", "industry outlook", "market dynamics"],
            response.text,
        )
        macro_analysis = MarketResearchAgent._find_section(
            text,
            ["macro", "economic", "interest rate", "inflation"],
            response.text,
        )

        key_factors = []
        for pattern in ["growth", "risk", "opportunity", "threat", "advantage"]:
            if pattern in text:
                key_factors.append(pattern.title())

        return MarketResearchResult(
            company_analysis=company_analysis or response.text[:500],
            sector_analysis=sector_analysis or "Not analyzed",
            macro_analysis=macro_analysis or "Not analyzed",
            key_factors=list(set(key_factors))[:5],
            provider_id=ProviderId(response.provider_id),
            model_id=response.model_id,
        )

    @staticmethod
    def _find_section(text_lower: str, patterns: list[str], full_text: str) -> str:
        """Find relevant section in text based on keywords."""
        for pattern in patterns:
            if pattern in text_lower:
                idx = full_text.lower().find(pattern)
                if idx != -1:
                    section = full_text[idx : idx + 300]
                    return section.strip()
        return ""
