from __future__ import annotations

import hashlib
import logging
from typing import Optional

from app.orchestration.normalizer import NormalizedResponse
from app.schemas.financial import Contradiction
from app.schemas.provider import ProviderId

log = logging.getLogger(__name__)


class ContradictionEngine:
    """Detects disagreements and conflicting assumptions across models."""

    def extract(
        self, responses: list[NormalizedResponse], focus_areas: Optional[list[str]] = None
    ) -> list[Contradiction]:
        """Extract disagreements where models diverge significantly."""
        if len(responses) < 2:
            return []

        contradictions: list[Contradiction] = []

        contradiction_topics = {
            "valuation": {
                "bullish_signals": ["cheap", "undervalued", "discount", "opportunity"],
                "bearish_signals": ["expensive", "overvalued", "premium"],
            },
            "growth": {
                "bullish_signals": ["growth", "expand", "accelerate", "catalyst"],
                "bearish_signals": ["slow", "stagnant", "decline", "mature"],
            },
            "management": {
                "bullish_signals": ["strong team", "proven track record", "visionary"],
                "bearish_signals": ["inexperienced", "turnover", "weak governance"],
            },
            "competition": {
                "bullish_signals": ["moat", "defensible", "competitive advantage"],
                "bearish_signals": ["commoditized", "intense", "losing share"],
            },
        }

        if focus_areas:
            contradiction_topics = {
                k: v
                for k, v in contradiction_topics.items()
                if any(area.lower() in k for area in focus_areas)
            }

        for topic, signals in contradiction_topics.items():
            contradiction = self._detect_topic_contradiction(
                topic, signals, responses
            )
            if contradiction:
                contradictions.append(contradiction)

        log.info(
            "contradiction_detection_complete",
            extra={
                "contradictions": len(contradictions),
                "total_responses": len(responses),
            },
        )
        return contradictions

    @staticmethod
    def _detect_topic_contradiction(
        topic: str,
        signals: dict[str, list[str]],
        responses: list[NormalizedResponse],
    ) -> Contradiction | None:
        """Detect if responses diverge on a specific topic."""
        bullish_responses = []
        bearish_responses = []

        for response in responses:
            if not response.text:
                continue

            text_lower = response.text.lower()
            bullish_count = sum(1 for s in signals["bullish_signals"] if s in text_lower)
            bearish_count = sum(1 for s in signals["bearish_signals"] if s in text_lower)

            if bullish_count > bearish_count:
                bullish_responses.append(response)
            elif bearish_count > bullish_count:
                bearish_responses.append(response)

        if bullish_responses and bearish_responses:
            positions: dict[ProviderId, str] = {}

            for r in bullish_responses:
                positions[ProviderId(r.provider_id)] = "Bullish"

            for r in bearish_responses:
                positions[ProviderId(r.provider_id)] = "Bearish"

            assumption_conflicts = ContradictionEngine._extract_assumption_conflicts(
                topic, signals, responses
            )

            return Contradiction(
                id=ContradictionEngine._gen_id(topic),
                topic=topic,
                positions=positions,
                assumption_conflicts=assumption_conflicts,
                risk_disagreements=ContradictionEngine._extract_risk_disagreements(
                    topic, responses
                ),
            )

        return None

    @staticmethod
    def _extract_assumption_conflicts(
        topic: str, signals: dict[str, list[str]], responses: list[NormalizedResponse]
    ) -> list[str]:
        """Extract conflicting assumptions."""
        conflicts: list[str] = []

        for response in responses:
            if not response.text:
                continue

            text_lower = response.text.lower()
            for signal in signals["bullish_signals"] + signals["bearish_signals"]:
                if signal in text_lower:
                    conflicts.append(f"{topic.title()}: {signal.title()}")

        return list(set(conflicts))[:3]

    @staticmethod
    def _extract_risk_disagreements(
        topic: str, responses: list[NormalizedResponse]
    ) -> list[str]:
        """Extract differing risk assessments."""
        disagreements: list[str] = []

        risk_keywords = ["risk", "threat", "danger", "concern", "issue"]

        for response in responses:
            if not response.text:
                continue

            text_lower = response.text.lower()
            if any(kw in text_lower for kw in risk_keywords):
                sentences = response.text.split(".")
                for sent in sentences:
                    if any(kw in sent.lower() for kw in risk_keywords):
                        clean = sent.strip()[:100]
                        if clean:
                            disagreements.append(clean)

        return list(set(disagreements))[:3]

    @staticmethod
    def _gen_id(topic: str) -> str:
        """Generate deterministic ID for contradiction."""
        return hashlib.md5(topic.encode()).hexdigest()[:16]
