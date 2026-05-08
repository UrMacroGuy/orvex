from __future__ import annotations

from dataclasses import dataclass, field
from typing import Iterable

from app.orchestration.normalizer import NormalizedResponse
from app.schemas.provider import ProviderId
from app.schemas.query import ModelResponseStatus
from app.schemas.synthesis import Disagreement, DisagreementPosition

from .text import content_tokens, has_negation, jaccard, sentences, topic_label

_MIN_CLAIM_TOKENS = 4


@dataclass(slots=True)
class _PositionItem:
    provider_id: str
    model_id: str
    sentence: str
    tokens: set[str]


@dataclass(slots=True)
class _Cluster:
    positions: list[_PositionItem] = field(default_factory=list)
    tokens: set[str] = field(default_factory=set)


class DisagreementExtractor:
    def __init__(
        self,
        *,
        topic_overlap: float = 0.4,
        max_internal_similarity: float = 0.5,
        consensus_exclusion: float = 0.55,
    ) -> None:
        self._topic = topic_overlap
        self._distance = max_internal_similarity
        self._consensus_exclusion = consensus_exclusion

    def extract(
        self,
        responses: Iterable[NormalizedResponse],
        *,
        consensus_token_sets: list[set[str]],
    ) -> list[Disagreement]:
        items: list[_PositionItem] = []
        for r in responses:
            if r.status != ModelResponseStatus.OK or not r.text:
                continue
            for sent in sentences(r.text):
                toks = content_tokens(sent)
                if len(toks) < _MIN_CLAIM_TOKENS:
                    continue
                if any(jaccard(toks, c) >= self._consensus_exclusion for c in consensus_token_sets):
                    continue
                items.append(
                    _PositionItem(
                        provider_id=r.provider_id,
                        model_id=r.model_id,
                        sentence=sent,
                        tokens=toks,
                    )
                )

        clusters: list[_Cluster] = []
        for item in items:
            placed = False
            for c in clusters:
                if jaccard(c.tokens, item.tokens) >= self._topic:
                    c.positions.append(item)
                    c.tokens |= item.tokens
                    placed = True
                    break
            if not placed:
                clusters.append(_Cluster(positions=[item], tokens=set(item.tokens)))

        out: list[Disagreement] = []
        for ci, c in enumerate(clusters):
            distinct_models = {p.model_id for p in c.positions}
            if len(distinct_models) < 2:
                continue
            sims = [
                jaccard(c.positions[i].tokens, c.positions[j].tokens)
                for i in range(len(c.positions))
                for j in range(i + 1, len(c.positions))
            ]
            avg = sum(sims) / len(sims) if sims else 1.0
            negation_present = any(has_negation(p.sentence) for p in c.positions)
            if avg > self._distance and not negation_present:
                continue

            seen: set[str] = set()
            positions: list[DisagreementPosition] = []
            for p in c.positions:
                if p.model_id in seen:
                    continue
                seen.add(p.model_id)
                positions.append(
                    DisagreementPosition(
                        provider_id=ProviderId(p.provider_id),
                        model_id=p.model_id,
                        position=p.sentence,
                    )
                )
            if len(positions) < 2:
                continue
            out.append(
                Disagreement(
                    id=f"d{ci}",
                    topic=topic_label(c.tokens),
                    positions=positions,
                )
            )
        return out
