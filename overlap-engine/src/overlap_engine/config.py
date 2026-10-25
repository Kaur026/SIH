"""Engine configuration.

Every threshold/weight below is a *proposed default*, not a value derived from
AICTE data. They are exposed here so they can be tuned without touching
algorithm code. See README "Assumptions" for how they were chosen.
"""
from __future__ import annotations

from dataclasses import dataclass, field, fields
from typing import Any, Mapping, Optional


@dataclass
class EngineConfig:
    # ---- institution resolution -------------------------------------------
    resolve_threshold: float = 0.85     # min name-match score to auto-resolve
    resolve_margin: float = 0.05        # min gap between best and 2nd-best candidate
    review_floor: float = 0.60          # below this, no candidates are even suggested
    fuzzy_confidence_cap: float = 0.97  # fuzzy matches never reach 1.0 (IDs do)
    exact_name_confidence: float = 0.98
    acronym_score: float = 0.90
    generic_token_discount: float = 0.4  # weight multiplier for words like "college"
    state_mismatch_penalty: float = 0.6  # score multiplier when both states known and differ
    max_candidates: int = 50            # blocking cap per query (fuzzy stage)

    # ---- overlap scoring ---------------------------------------------------
    # confidence = inst_conf * sum(w_i * s_i) / sum(w_i) over *available* signals
    weights: dict = field(default_factory=lambda: {
        "base": 0.40,      # same institution, different cell (problem-statement definition)
        "text": 0.30,      # complaint text similarity (TF-IDF cosine)
        "category": 0.20,  # same / related complaint category
        "time": 0.10,      # received close together
    })
    time_decay_days: float = 90.0
    high_threshold: float = 0.70
    medium_threshold: float = 0.50
    min_confidence: float = 0.30        # alerts below this are not emitted

    # ---- suppression rules -------------------------------------------------
    include_same_cell: bool = False     # problem statement is about cross-bureau overlap
    include_closed: bool = False        # suppress pairs where either case is terminal
    terminal_statuses: tuple = ("resolved", "closed", "disposed")
    max_gap_days: Optional[float] = None   # suppress pairs received > N days apart (None = off)
    explicit_link_policy: str = "suppress"   # "suppress" | "boost"
    record_suppressed: bool = True
    max_pairs_per_institution: int = 20000   # safety cap (warning emitted when hit)

    # ---- category relations (taxonomy not documented -> empty by default) --
    category_groups: dict = field(default_factory=dict)  # {"group": ["cat a", "cat b"]}

    def validate(self) -> "EngineConfig":
        if not (0 < self.review_floor <= self.resolve_threshold <= 1):
            raise ValueError("require 0 < review_floor <= resolve_threshold <= 1")
        if not (0 <= self.min_confidence <= self.medium_threshold <= self.high_threshold <= 1):
            raise ValueError("require 0 <= min_confidence <= medium <= high <= 1")
        if self.explicit_link_policy not in ("suppress", "boost"):
            raise ValueError("explicit_link_policy must be 'suppress' or 'boost'")
        if "base" not in self.weights or any(w < 0 for w in self.weights.values()):
            raise ValueError("weights must include 'base' and be non-negative")
        if self.weights["base"] <= 0:
            raise ValueError("weights['base'] must be > 0")
        if self.time_decay_days <= 0 or self.max_pairs_per_institution < 1:
            raise ValueError("time_decay_days and max_pairs_per_institution must be positive")
        return self

    @classmethod
    def from_dict(cls, data: Mapping[str, Any]) -> "EngineConfig":
        known = {f.name for f in fields(cls)}
        unknown = set(data) - known
        if unknown:
            raise ValueError(f"Unknown config keys: {sorted(unknown)}")
        cfg = cls(**dict(data))
        cfg.terminal_statuses = tuple(s.lower() for s in cfg.terminal_statuses)
        return cfg.validate()
