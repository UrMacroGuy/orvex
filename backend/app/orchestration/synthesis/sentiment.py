from __future__ import annotations

import re
from typing import Iterable

from app.orchestration.normalizer import NormalizedResponse
from app.schemas.finance import MarketSentiment
from app.schemas.query import ModelResponseStatus
from app.schemas.synthesis import BullishBearishAnalysis, SentimentPosition

from .text import sentences

_BULLISH = frozenset({
    "bullish", "upside", "outperform", "buy", "overweight",
    "rally", "surge", "gain", "positive", "favorable",
    "opportunity", "uptrend", "upgrade", "beat", "strong",
    "momentum", "breakout", "accumulate", "attractive", "undervalued",
    "catalyst", "expansion", "robust", "accelerating", "tailwind",
    "record high", "above consensus", "raise guidance", "top line growth",
    "margin expansion", "market share gain", "demand recovery",
})

_BEARISH = frozenset({
    "bearish", "downside", "underperform", "sell", "underweight",
    "decline", "fall", "drop", "negative", "unfavorable",
    "downtrend", "downgrade", "miss", "weak", "deteriorate",
    "headwind", "overvalued", "reduce", "caution", "warning",
    "slowdown", "contraction", "pressure", "loss", "miss expectations",
    "below consensus", "cut guidance", "margin compression",
    "market share loss", "demand destruction", "credit risk",
})

_NEGATION = re.compile(
    r"\b(not|no|never|cannot|won't|isn't|doesn't|aren't|wasn't|weren't|"
    r"shouldn't|couldn't|wouldn't|hardly|barely|seldom)\b",
    re.IGNORECASE,
)


def _score(text: str) -> tuple[int, int]:
    lower = text.lower()
    negated = bool(_NEGATION.search(text))
    bull = sum(1 for kw in _BULLISH if kw in lower)
    bear = sum(1 for kw in _BEARISH if kw in lower)
    if negated:
        bull, bear = bear, bull
    return bull, bear


class SentimentExtractor:
    def __init__(self, *, min_signal_score: int = 1) -> None:
        self._min = min_signal_score

    def extract(self, responses: Iterable[NormalizedResponse]) -> BullishBearishAnalysis:
        bull_signals: list[SentimentPosition] = []
        bear_signals: list[SentimentPosition] = []

        for r in responses:
            if r.status != ModelResponseStatus.OK or not r.text:
                continue
            for sent in sentences(r.text):
                b, br = _score(sent)
                if b >= self._min and b > br:
                    bull_signals.append(
                        SentimentPosition(
                            model_id=r.model_id,
                            provider_id=r.provider_id,
                            sentiment=MarketSentiment.BULLISH,
                            signal=sent,
                            confidence=min(1.0, b / (b + br + 1)),
                        )
                    )
                elif br >= self._min and br > b:
                    bear_signals.append(
                        SentimentPosition(
                            model_id=r.model_id,
                            provider_id=r.provider_id,
                            sentiment=MarketSentiment.BEARISH,
                            signal=sent,
                            confidence=min(1.0, br / (b + br + 1)),
                        )
                    )

        total_bull = sum(s.confidence for s in bull_signals)
        total_bear = sum(s.confidence for s in bear_signals)

        if total_bull == 0 and total_bear == 0:
            overall = MarketSentiment.NEUTRAL
        elif total_bull > total_bear * 1.5:
            overall = MarketSentiment.BULLISH
        elif total_bear > total_bull * 1.5:
            overall = MarketSentiment.BEARISH
        else:
            overall = MarketSentiment.MIXED

        bull_signals.sort(key=lambda s: s.confidence, reverse=True)
        bear_signals.sort(key=lambda s: s.confidence, reverse=True)

        return BullishBearishAnalysis(
            overall_sentiment=overall,
            bullish_signals=bull_signals[:10],
            bearish_signals=bear_signals[:10],
            bull_count=len(bull_signals),
            bear_count=len(bear_signals),
        )
