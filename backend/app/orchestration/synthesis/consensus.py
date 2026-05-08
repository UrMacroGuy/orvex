from __future__ import annotations

from dataclasses import dataclass, field
from typing import Iterable

from app.orchestration.normalizer import NormalizedResponse
from app.schemas.query import ModelResponseStatus
from app.schemas.synthesis import ConsensusClaim

from .text import content_tokens, jaccard, sentences

_MIN_CLAIM_TOKENS = 4


@dataclass(slots=True)
class _Cluster:
    sentences: list[tuple[int, str]] = field(default_factory=list)
    model_indices: set[int] = field(default_factory=set)
    tokens: set[str] = field(default_factory=set)


class ConsensusDetector:
    def __init__(
        self,
        *,
        similarity: float = 0.55,
        min_support_ratio: float = 0.5,
        min_support: int = 2,
    ) -> None:
        self._sim = similarity
        self._min_ratio = min_support_ratio
        self._min_support = min_support

    def detect(self, responses: Iterable[NormalizedResponse]) -> list[ConsensusClaim]:
        ok = [r for r in responses if r.status == ModelResponseStatus.OK and r.text]
        n = len(ok)
        if n < 2:
            return []

        clusters: list[_Cluster] = []
        for mi, r in enumerate(ok):
            for sent in sentences(r.text or ""):
                toks = content_tokens(sent)
                if len(toks) < _MIN_CLAIM_TOKENS:
                    continue
                placed = False
                for c in clusters:
                    if mi in c.model_indices:
                        continue
                    if jaccard(c.tokens, toks) >= self._sim:
                        c.sentences.append((mi, sent))
                        c.model_indices.add(mi)
                        c.tokens |= toks
                        placed = True
                        break
                if not placed:
                    clusters.append(
                        _Cluster(
                            sentences=[(mi, sent)],
                            model_indices={mi},
                            tokens=set(toks),
                        )
                    )

        threshold = max(self._min_support, int(round(self._min_ratio * n)))
        out: list[ConsensusClaim] = []
        for ci, c in enumerate(clusters):
            support = len(c.model_indices)
            if support < threshold:
                continue
            best = max(c.sentences, key=lambda x: len(x[1]))[1]
            supporters = sorted({ok[i].model_id for i in c.model_indices})
            out.append(
                ConsensusClaim(
                    id=f"c{ci}",
                    claim=best,
                    supporting_models=supporters,
                    confidence=support / n,
                )
            )
        out.sort(key=lambda c: c.confidence, reverse=True)
        return out
