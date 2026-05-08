from __future__ import annotations

from app.orchestration.normalizer import NormalizedResponse
from app.orchestration.synthesis.engine import SynthesisEngine
from app.schemas.financial import ConfidenceScore, FinancialSynthesisData


class FinancialSynthesisEngine(SynthesisEngine):
    def run(
        self, responses: list[NormalizedResponse]
    ) -> FinancialSynthesisData:
        base_synthesis = super().run(responses)

        bullish_count = sum(
            1 for r in responses if any("bullish" in s.lower() for s in r.text.split()[:20])
        )
        bearish_count = sum(
            1 for r in responses if any("bearish" in s.lower() for s in r.text.split()[:20])
        )
        total = len(responses)

        confidence = ConfidenceScore(
            consensus_agreement=min(1.0, max(bullish_count, bearish_count) / max(total, 1)),
            bullish_confidence=bullish_count / max(total, 1),
            bearish_confidence=bearish_count / max(total, 1),
        )

        return FinancialSynthesisData(
            summary=base_synthesis.summary,
            consensus=base_synthesis.consensus,
            disagreements=base_synthesis.disagreements,
            unique_insights=base_synthesis.unique_insights,
            citations=base_synthesis.citations,
            confidence_score=confidence,
            investment_thesis=base_synthesis.summary[:200] if base_synthesis.summary else "",
            key_risks=[d.topic for d in base_synthesis.disagreements[:3]],
            news_items=[],
        )
