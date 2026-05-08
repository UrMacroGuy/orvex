from __future__ import annotations

from typing import Iterable

from app.orchestration.normalizer import NormalizedResponse
from app.schemas.provider import ProviderId
from app.schemas.query import ModelResponseStatus
from app.schemas.synthesis import UniqueInsight

from .text import content_tokens, jaccard, sentences

_MIN_INSIGHT_TOKENS = 5


class Deduplicator:
    def __init__(
        self,
        *,
        intra_threshold: float = 0.85,
        cross_response_threshold: float = 0.75,
        covered_overlap: float = 0.4,
    ) -> None:
        self._intra = intra_threshold
        self._cross = cross_response_threshold
        self._covered = covered_overlap

    def dedupe_text(self, text: str) -> str:
        seen: list[set[str]] = []
        kept: list[str] = []
        for s in sentences(text):
            toks = content_tokens(s)
            if any(jaccard(toks, prev) >= self._intra for prev in seen):
                continue
            seen.append(toks)
            kept.append(s)
        return " ".join(kept)

    def unique_insights(
        self,
        responses: Iterable[NormalizedResponse],
        *,
        covered_token_sets: list[set[str]],
    ) -> list[UniqueInsight]:
        out: list[UniqueInsight] = []
        seen: list[set[str]] = []
        idx = 0
        for r in responses:
            if r.status != ModelResponseStatus.OK or not r.text:
                continue
            for s in sentences(r.text):
                toks = content_tokens(s)
                if len(toks) < _MIN_INSIGHT_TOKENS:
                    continue
                if any(jaccard(toks, c) >= self._covered for c in covered_token_sets):
                    continue
                if any(jaccard(toks, prev) >= self._cross for prev in seen):
                    continue
                seen.append(toks)
                out.append(
                    UniqueInsight(
                        id=f"u{idx}",
                        insight=s,
                        provider_id=ProviderId(r.provider_id),
                        model_id=r.model_id,
                    )
                )
                idx += 1
        return out
