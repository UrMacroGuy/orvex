from __future__ import annotations

from typing import Iterable

from app.schemas.synthesis import (
    Citation,
    ConsensusClaim,
    Disagreement,
    UniqueInsight,
    WebSource,
)

from .text import content_tokens, jaccard

_LINK_OVERLAP = 0.2


class CitationMerger:
    def __init__(self, *, link_threshold: float = _LINK_OVERLAP) -> None:
        self._t = link_threshold

    def merge(
        self,
        *,
        sources: Iterable[WebSource],
        consensus: list[ConsensusClaim],
        disagreements: list[Disagreement],
        insights: list[UniqueInsight],
    ) -> list[Citation]:
        out: list[Citation] = []
        for i, src in enumerate(sources):
            src_tokens = content_tokens(f"{src.title} {src.snippet or ''}")
            if not src_tokens:
                out.append(
                    Citation(
                        id=f"s{i}",
                        url=src.url,
                        title=src.title,
                        snippet=src.snippet,
                        claim_ids=[],
                    )
                )
                continue
            claim_ids: list[str] = []
            for c in consensus:
                if jaccard(src_tokens, content_tokens(c.claim)) >= self._t:
                    claim_ids.append(c.id)
            for d in disagreements:
                if jaccard(src_tokens, content_tokens(d.topic)) >= self._t:
                    claim_ids.append(d.id)
            for u in insights:
                if jaccard(src_tokens, content_tokens(u.insight)) >= self._t:
                    claim_ids.append(u.id)
            out.append(
                Citation(
                    id=f"s{i}",
                    url=src.url,
                    title=src.title,
                    snippet=src.snippet,
                    claim_ids=claim_ids,
                )
            )
        return out
