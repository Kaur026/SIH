"""Deterministic extractive summary: the (up to) two most informative sentences."""
from __future__ import annotations

import math
import re
from collections import Counter
from typing import List

from .textnorm import text_tokens

_SENT_SPLIT = re.compile(r"(?<=[.!?])\s+|\n+")


def _trim(sentence: str, limit: int) -> str:
    sentence = " ".join(sentence.split())
    if len(sentence) <= limit:
        return sentence
    cut = sentence[:limit].rsplit(" ", 1)[0].rstrip(",;:- ")
    return cut + "…"


def summarize(text: str, max_sentences: int = 2, max_chars_per_sentence: int = 160) -> str:
    sentences: List[str] = [s.strip() for s in _SENT_SPLIT.split(text or "") if s and s.strip()]
    if not sentences:
        return ""
    if len(sentences) <= max_sentences:
        return " ".join(_trim(s, max_chars_per_sentence) for s in sentences)
    toks = [text_tokens(s) for s in sentences]
    tf = Counter(t for ts in toks for t in ts)
    scored = []
    for i, ts in enumerate(toks):
        if len(ts) < 3:
            continue
        # frequent terms in the document are salient; sqrt-length avoids favouring long sentences
        score = sum(1.0 + math.log(tf[t]) for t in set(ts)) / math.sqrt(len(ts))
        score *= 1.3 if i == 0 else 1.0           # complaints usually open with the core issue
        scored.append((score, i))
    if not scored:
        return _trim(sentences[0], max_chars_per_sentence)
    top = sorted(sorted(scored, key=lambda x: (-x[0], x[1]))[:max_sentences], key=lambda x: x[1])
    return " ".join(_trim(sentences[i], max_chars_per_sentence) for _, i in top)
