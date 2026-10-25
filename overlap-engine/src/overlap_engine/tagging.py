"""Rule-based category tagging (explainable keyword scoring).

Taxonomy lives in data/taxonomy.json (PROPOSED; replace with AICTE's real list).
Terms are normalised with the same pipeline as complaint text, so "salaries",
"teachers" etc. match. Multi-word terms match as contiguous token sequences.
"""
from __future__ import annotations

import json
from dataclasses import dataclass
from importlib import resources
from typing import Dict, List, Optional, Sequence, Tuple

from .textnorm import text_tokens

UNCATEGORIZED = "Uncategorized"


@dataclass(frozen=True)
class Tagging:
    category: str
    confidence: float                       # 0..1 (share of total score x saturation)
    tags: Tuple[str, ...]                   # all categories with a match, best first
    matched_terms: Tuple[str, ...]          # terms that fired for the top category

    def to_dict(self) -> dict:
        return {"category": self.category, "confidence": round(self.confidence, 3),
                "tags": list(self.tags), "matched_terms": list(self.matched_terms)}


def load_default_taxonomy() -> Dict[str, Dict[str, float]]:
    with resources.files("overlap_engine").joinpath("data/taxonomy.json").open(encoding="utf-8") as fh:
        raw = json.load(fh)
    return {k: v for k, v in raw.items() if not k.startswith("_")}


class CategoryTagger:
    def __init__(self, taxonomy: Optional[Dict[str, Dict[str, float]]] = None,
                 saturation: float = 3.0) -> None:
        tax = taxonomy if taxonomy is not None else load_default_taxonomy()
        self.saturation = saturation
        self._rules: Dict[str, List[Tuple[Tuple[str, ...], float, str]]] = {}
        for cat, terms in tax.items():
            rules = []
            for term, weight in terms.items():
                toks = tuple(text_tokens(term))
                if toks:
                    rules.append((toks, float(weight), term))
            self._rules[cat] = rules

    @staticmethod
    def _contains(tokens: Sequence[str], pat: Tuple[str, ...]) -> bool:
        n = len(pat)
        return any(tuple(tokens[i:i + n]) == pat for i in range(len(tokens) - n + 1))

    def tag(self, title: str = "", description: str = "") -> Tagging:
        # title is weighted by being included twice
        tokens = text_tokens(f"{title} {title} {description}")
        scores: Dict[str, float] = {}
        matched: Dict[str, List[str]] = {}
        for cat, rules in self._rules.items():
            for pat, weight, term in rules:
                if self._contains(tokens, pat):
                    scores[cat] = scores.get(cat, 0.0) + weight
                    matched.setdefault(cat, []).append(term)
        if not scores:
            return Tagging(UNCATEGORIZED, 0.0, (), ())
        ranked = sorted(scores.items(), key=lambda kv: (-kv[1], kv[0]))
        top_cat, top = ranked[0]
        conf = (top / sum(scores.values())) * min(1.0, top / self.saturation)
        return Tagging(top_cat, conf, tuple(c for c, _ in ranked), tuple(sorted(matched[top_cat])))
