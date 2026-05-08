from __future__ import annotations

import re
import unicodedata

_SENTENCE_SPLIT = re.compile(r"(?<=[.!?])\s+(?=[A-Z\"'(\[])")
_WORD = re.compile(r"[A-Za-z0-9']+")

_STOPWORDS = frozenset(
    """
    a an and are as at be because been being but by can could did do does
    doing done for from had has have having he her here hers him his how i
    if in into is it its itself just may might more most must my no nor not
    of off on once only or other our ours out over own same she should so
    some such than that the their them themselves then there these they this
    those through to too under up very was we were what when where which
    while who whom why will with would you your yours
    """.split()
)

_NEGATIONS = frozenset(
    {
        "not",
        "no",
        "never",
        "cannot",
        "cant",
        "wont",
        "isnt",
        "doesnt",
        "arent",
        "wasnt",
        "werent",
        "shouldnt",
        "couldnt",
        "wouldnt",
    }
)


def normalize(text: str) -> str:
    if not text:
        return ""
    t = unicodedata.normalize("NFKC", text).strip()
    return re.sub(r"\s+", " ", t)


def sentences(text: str) -> list[str]:
    t = normalize(text)
    if not t:
        return []
    parts = _SENTENCE_SPLIT.split(t)
    return [p.strip() for p in parts if p.strip()]


def tokens(text: str) -> list[str]:
    return [m.group(0).lower() for m in _WORD.finditer(text or "")]


def content_tokens(text: str) -> set[str]:
    return {t for t in tokens(text) if t not in _STOPWORDS and len(t) > 2}


def jaccard(a: set[str], b: set[str]) -> float:
    if not a or not b:
        return 0.0
    inter = len(a & b)
    union = len(a | b)
    return inter / union if union else 0.0


def has_negation(text: str) -> bool:
    return any(t.replace("'", "") in _NEGATIONS for t in tokens(text))


def topic_label(token_set: set[str], *, max_words: int = 5) -> str:
    if not token_set:
        return "general"
    return " ".join(sorted(token_set, key=lambda w: (-len(w), w))[:max_words])
