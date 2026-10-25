"""String / text similarity primitives (standard library only)."""
from __future__ import annotations

import math
from collections import Counter
from typing import Dict, Iterable, List, Sequence, Tuple

Vector = Dict[str, float]


def osa_distance(a: str, b: str, max_dist: int | None = None) -> int:
    """Optimal-string-alignment (restricted Damerau-Levenshtein) distance.

    Counts insert/delete/substitute/adjacent-transposition. Returns max_dist+1
    early when the distance is guaranteed to exceed ``max_dist``.
    """
    if a == b:
        return 0
    la, lb = len(a), len(b)
    if max_dist is not None and abs(la - lb) > max_dist:
        return max_dist + 1
    if la == 0 or lb == 0:
        return max(la, lb)
    prev2: List[int] = []
    prev = list(range(lb + 1))
    for i in range(1, la + 1):
        cur = [i] + [0] * lb
        for j in range(1, lb + 1):
            cost = 0 if a[i - 1] == b[j - 1] else 1
            v = min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost)
            if i > 1 and j > 1 and a[i - 1] == b[j - 2] and a[i - 2] == b[j - 1]:
                v = min(v, prev2[j - 2] + 1)
            cur[j] = v
        if max_dist is not None and min(cur) > max_dist:
            return max_dist + 1
        prev2, prev = prev, cur
    return prev[lb]


def token_similarity(a: str, b: str) -> float:
    """Typo-tolerant similarity of two normalized name tokens, in [0, 1].

    Policy (to avoid merging genuinely different short names such as KIT / KIIT):
      * equal -> 1.0
      * either token shorter than 5 chars, or numeric -> exact only
      * otherwise allow 1 edit (2 edits when the longer token has >= 9 chars)
    """
    if a == b:
        return 1.0
    la, lb = len(a), len(b)
    if min(la, lb) < 5 or a.isdigit() or b.isdigit():
        return 0.0
    longest = max(la, lb)
    limit = 1 if longest < 9 else 2
    d = osa_distance(a, b, limit)
    return 0.0 if d > limit else 1.0 - d / longest


def trigrams(token: str) -> set:
    padded = f"^{token}$"
    return {padded[i:i + 3] for i in range(len(padded) - 2)}


class TfidfModel:
    """Sparse TF-IDF over unigrams (optionally + bigrams); sublinear tf, L2-normalised."""

    def __init__(self, use_bigrams: bool = False) -> None:
        # Bigrams are OFF by default: on paraphrased complaints (the common case
        # across bureaus) they dilute cosine similarity. See README, "Design notes".
        self.use_bigrams = use_bigrams
        self.n_docs = 0
        self._df: Counter = Counter()

    def _features(self, tokens: Sequence[str]) -> Counter:
        feats: Counter = Counter(tokens)
        if self.use_bigrams:
            feats.update(f"{x} {y}" for x, y in zip(tokens, tokens[1:]))
        return feats

    def fit(self, docs: Iterable[Sequence[str]]) -> "TfidfModel":
        self.n_docs = 0
        self._df = Counter()
        for toks in docs:
            self.n_docs += 1
            self._df.update(self._features(toks).keys())
        return self

    def idf(self, feature: str) -> float:
        return math.log((1 + self.n_docs) / (1 + self._df.get(feature, 0))) + 1.0

    def vectorize(self, tokens: Sequence[str]) -> Vector:
        feats = self._features(tokens)
        vec = {f: (1.0 + math.log(c)) * self.idf(f) for f, c in feats.items()}
        norm = math.sqrt(sum(v * v for v in vec.values()))
        return {f: v / norm for f, v in vec.items()} if norm else {}


def cosine(u: Vector, v: Vector) -> float:
    if not u or not v:
        return 0.0
    if len(u) > len(v):
        u, v = v, u
    return min(1.0, sum(w * v.get(f, 0.0) for f, w in u.items()))


def shared_terms(u: Vector, v: Vector, k: int = 3) -> List[str]:
    """Top-k shared *unigram* terms ranked by joint weight (for explanations)."""
    scored: List[Tuple[float, str]] = [
        (w * v[f], f) for f, w in u.items() if f in v and " " not in f
    ]
    scored.sort(key=lambda x: (-x[0], x[1]))
    return [f for _, f in scored[:k]]
