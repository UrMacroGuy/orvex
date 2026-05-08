from __future__ import annotations

import logging
from typing import Iterable, Optional

from app.orchestration.normalizer import NormalizedResponse
from app.schemas.query import ModelResponseStatus
from app.schemas.synthesis import (
    ConsensusClaim,
    Disagreement,
    SynthesisData,
    WebSource,
)

from .citation_merger import CitationMerger
from .consensus import ConsensusDetector
from .deduplicator import Deduplicator
from .disagreement import DisagreementExtractor
from .sentiment import SentimentExtractor
from .text import content_tokens

log = logging.getLogger(__name__)


class SynthesisEngine:
    def __init__(
        self,
        *,
        consensus: Optional[ConsensusDetector] = None,
        disagreement: Optional[DisagreementExtractor] = None,
        deduplicator: Optional[Deduplicator] = None,
        citations: Optional[CitationMerger] = None,
    ) -> None:
        self._consensus = consensus or ConsensusDetector()
        self._disagreement = disagreement or DisagreementExtractor()
        self._dedup = deduplicator or Deduplicator()
        self._citations = citations or CitationMerger()

    def run(
        self,
        *,
        responses: Iterable[NormalizedResponse],
        sources: Optional[Iterable[WebSource]] = None,
    ) -> SynthesisData:
        ok = [r for r in responses if r.status == ModelResponseStatus.OK and r.text]
        consensus = self._consensus.detect(ok)
        consensus_tokens = [content_tokens(c.claim) for c in consensus]
        disagreements = self._disagreement.extract(
            ok, consensus_token_sets=consensus_tokens
        )
        disagreement_tokens = [content_tokens(d.topic) for d in disagreements]
        insights = self._dedup.unique_insights(
            ok, covered_token_sets=consensus_tokens + disagreement_tokens
        )
        citations = (
            self._citations.merge(
                sources=sources or [],
                consensus=consensus,
                disagreements=disagreements,
                insights=insights,
            )
            if sources
            else []
        )
        summary = self._summary(ok, consensus, disagreements)
        log.info(
            "synthesis_done",
            extra={
                "responses": len(ok),
                "consensus": len(consensus),
                "disagreements": len(disagreements),
                "insights": len(insights),
                "citations": len(citations),
            },
        )
        return SynthesisData(
            summary=summary,
            consensus=consensus,
            disagreements=disagreements,
            unique_insights=insights,
            citations=citations,
        )

    @staticmethod
    def _summary(
        responses: list[NormalizedResponse],
        consensus: list[ConsensusClaim],
        disagreements: list[Disagreement],
    ) -> str:
        n = len(responses)
        if n == 0:
            return "No successful model responses to synthesize."
        if not consensus and not disagreements:
            return f"No clear consensus or disagreement detected across {n} model responses."
        parts: list[str] = []
        if consensus:
            parts.append(f"{len(consensus)} consensus claim(s) supported across models.")
        if disagreements:
            parts.append(f"{len(disagreements)} topic(s) of disagreement detected.")
        return " ".join(parts)


class FinancialSynthesisEngine(SynthesisEngine):
    """Extends SynthesisEngine with financial intelligence: bullish/bearish sentiment extraction."""

    def __init__(
        self,
        *,
        consensus: Optional[ConsensusDetector] = None,
        disagreement: Optional[DisagreementExtractor] = None,
        deduplicator: Optional[Deduplicator] = None,
        citations: Optional[CitationMerger] = None,
        sentiment: Optional[SentimentExtractor] = None,
    ) -> None:
        super().__init__(
            consensus=consensus,
            disagreement=disagreement,
            deduplicator=deduplicator,
            citations=citations,
        )
        self._sentiment = sentiment or SentimentExtractor()

    def run(
        self,
        *,
        responses: Iterable[NormalizedResponse],
        sources: Optional[Iterable[WebSource]] = None,
    ) -> SynthesisData:
        resp_list = list(responses)
        result = super().run(responses=resp_list, sources=sources)
        result.sentiment = self._sentiment.extract(resp_list)
        log.info(
            "financial_synthesis_done",
            extra={
                "overall_sentiment": result.sentiment.overall_sentiment.value,
                "bull_signals": result.sentiment.bull_count,
                "bear_signals": result.sentiment.bear_count,
            },
        )
        return result
