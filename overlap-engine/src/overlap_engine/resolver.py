"""Institution resolution: map a messy case reference to a registry institution.

Resolution order (first decisive hit wins):
  1. institution_id supplied and known                      -> confidence 1.00
  2. AICTE Permanent ID supplied and known                  -> confidence 1.00
  3. exact normalised name / alias match (unique)           -> 0.98
  4. acronym match (e.g. "VJTI")                            -> 0.90
  5. fuzzy token-alignment match with blocking              -> score, capped 0.97

Anything not decisive is returned as AMBIGUOUS or UNRESOLVED with candidates so
a human can review it. The engine never guesses between close candidates.
"""
from __future__ import annotations

import math
from collections import Counter, defaultdict
from dataclasses import dataclass
from functools import lru_cache
from typing import Dict, Iterable, List, Optional, Sequence, Set, Tuple

from .config import EngineConfig
from .models import Institution, as_institutions
from .similarity import token_similarity, trigrams
from .textnorm import (GENERIC_TOKENS, institution_key, institution_tokens,
                       normalize_permanent_id)

RESOLVED, AMBIGUOUS, UNRESOLVED = "RESOLVED", "AMBIGUOUS", "UNRESOLVED"

_tsim = lru_cache(maxsize=500_000)(token_similarity)


@dataclass(frozen=True)
class Resolution:
    status: str
    institution_id: Optional[str]
    confidence: float
    method: str
    candidates: Tuple[Tuple[str, float], ...] = ()
    warnings: Tuple[str, ...] = ()

    @property
    def resolved(self) -> bool:
        return self.status == RESOLVED

    def to_dict(self) -> dict:
        return {"status": self.status, "institution_id": self.institution_id,
                "confidence": round(self.confidence, 4), "method": self.method,
                "candidates": [{"institution_id": i, "score": round(s, 4)} for i, s in self.candidates],
                "warnings": list(self.warnings)}


class InstitutionResolver:
    def __init__(self, institutions: Iterable, config: Optional[EngineConfig] = None) -> None:
        self.cfg = (config or EngineConfig()).validate()
        self._insts: List[Institution] = as_institutions(institutions)
        self._by_id: Dict[str, int] = {}
        self._by_perm: Dict[str, int] = {}
        self._entries: List[Tuple[int, Tuple[str, ...]]] = []
        self._inst_entries: Dict[int, List[Tuple[str, ...]]] = defaultdict(list)
        self._exact: Dict[str, Set[int]] = defaultdict(set)
        self._acronyms: Dict[str, Set[int]] = defaultdict(set)
        self._tok_entries: Dict[str, List[int]] = defaultdict(list)
        self._df: Counter = Counter()
        self._vocab_tri: Dict[str, Set[str]] = defaultdict(set)
        self._near_cache: Dict[str, Dict[str, float]] = {}
        self._cache: Dict[tuple, Resolution] = {}
        self._ign: List[Set[str]] = []
        self._state_key: List[str] = []
        self._build()

    # ------------------------------------------------------------------ build
    def _build(self) -> None:
        for idx, inst in enumerate(self._insts):
            if inst.institution_id in self._by_id:
                raise ValueError(f"duplicate institution_id {inst.institution_id!r}")
            self._by_id[inst.institution_id] = idx
            ign: Set[str] = set()
            for v in (inst.state, inst.city):
                if v:
                    ign.update(institution_tokens(v))
            self._ign.append(ign)
            self._state_key.append(institution_key(inst.state) if inst.state else "")
            if inst.aicte_permanent_id:
                pid = normalize_permanent_id(inst.aicte_permanent_id)
                if pid in self._by_perm:
                    raise ValueError(f"duplicate AICTE permanent id {inst.aicte_permanent_id!r}")
                self._by_perm[pid] = idx
            seen: Set[Tuple[str, ...]] = set()
            for name in (inst.name, *inst.aliases):
                toks = tuple(institution_tokens(name))
                if not toks or toks in seen:
                    continue
                seen.add(toks)
                eid = len(self._entries)
                self._entries.append((idx, toks))
                self._inst_entries[idx].append(toks)
                self._exact[" ".join(toks)].add(idx)
                for t in set(toks):
                    self._tok_entries[t].append(eid)
                    self._df[t] += 1
                for ac in self._acronyms_of(toks):
                    self._acronyms[ac].add(idx)
        for tok in self._tok_entries:
            if len(tok) >= 5:
                for g in trigrams(tok):
                    self._vocab_tri[g].add(tok)

    @staticmethod
    def _acronyms_of(toks: Sequence[str]) -> Set[str]:
        out = set()
        if len(toks) >= 2:
            out.add("".join(t[0] for t in toks))
        distinct = [t for t in toks if t not in GENERIC_TOKENS]
        if len(distinct) >= 2:
            out.add("".join(t[0] for t in distinct))
        return out

    # ---------------------------------------------------------------- weights
    def _w(self, tok: str) -> float:
        n = len(self._entries)
        idf = math.log((1 + n) / (1 + self._df.get(tok, 0))) + 1.0
        return idf * (self.cfg.generic_token_discount if tok in GENERIC_TOKENS else 1.0)

    def _ignorable(self, inst_idx: int) -> Set[str]:
        return self._ign[inst_idx]

    def _score(self, q: Sequence[str], inst_idx: int, e: Sequence[str]) -> float:
        eset, ign = set(e), self._ign[inst_idx]
        q = [t for t in q if t in eset or t not in ign]   # query's city/state words are not penalised

        def cov(src: Sequence[str], dst: Sequence[str], dset: Set[str], contradict: bool) -> float:
            # contradict=True (query side): a query word absent from the registry name is
            # evidence AGAINST the match, so unmatched generic words are not discounted
            # ("Kavari Engineering College" must not match "Kavari Institute of Technology").
            # contradict=False (registry side): omitted words are merely a shorter reference.
            num = den = 0.0
            for t in src:
                w = self._w(t)
                best = 1.0 if t in dset else max((_tsim(t, u) for u in dst), default=0.0)
                num += w * best
                den += w if (best > 0 or not contradict) else w / (self.cfg.generic_token_discount if t in GENERIC_TOKENS else 1.0)
            return num / den if den else 0.0

        return 0.65 * cov(q, e, eset, True) + 0.35 * cov(e, q, set(q), False)

    def _state_mismatch(self, inst_idx: int, state_key: str) -> bool:
        sk = self._state_key[inst_idx]
        return bool(state_key and sk and state_key != sk)

    # --------------------------------------------------------------- blocking
    def _near_tokens(self, tok: str) -> Dict[str, float]:
        """Vocabulary tokens that are typo-variants of ``tok`` (trigram-filtered)."""
        hit = self._near_cache.get(tok)
        if hit is not None:
            return hit
        near: Dict[str, float] = {}
        if tok in self._tok_entries:
            near[tok] = 1.0
        elif len(tok) >= 5:
            counts: Counter = Counter()
            for g in trigrams(tok):
                counts.update(self._vocab_tri.get(g, ()))
            for cand, c in counts.items():
                if c >= 2:
                    s = _tsim(tok, cand)
                    if s > 0:
                        near[cand] = s
        self._near_cache[tok] = near
        return near

    def _candidate_entries(self, q: Sequence[str]) -> List[int]:
        distinct = [t for t in q if t not in GENERIC_TOKENS] or list(q)
        hits: Counter = Counter()
        for t in set(distinct):
            for vt in self._near_tokens(t):
                w = self._w(vt)
                for eid in self._tok_entries[vt]:
                    hits[eid] += w
        return [eid for eid, _ in hits.most_common(self.cfg.max_candidates)]

    # ---------------------------------------------------------------- resolve
    def resolve(self, *, institution_id: Optional[str] = None,
                permanent_id: Optional[str] = None, name: Optional[str] = None,
                state: Optional[str] = None) -> Resolution:
        key = (institution_id, permanent_id, name, state)
        res = self._cache.get(key)
        if res is None:
            res = self._resolve(institution_id, permanent_id, name, state)
            self._cache[key] = res
        return res

    def _resolve(self, institution_id, permanent_id, name, state) -> Resolution:
        warnings: List[str] = []
        q = institution_tokens(name) if name else []
        skey = institution_key(state) if state else ""

        if institution_id:
            if institution_id in self._by_id:
                return Resolution(RESOLVED, institution_id, 1.0, "institution_id")
            warnings.append("unknown_institution_id")
        if permanent_id:
            idx = self._by_perm.get(normalize_permanent_id(permanent_id))
            if idx is not None:
                inst = self._insts[idx]
                if q and max(self._score(q, idx, toks) for toks in self._inst_entries[idx]) < 0.5:
                    warnings.append("name_conflicts_with_permanent_id")
                return Resolution(RESOLVED, inst.institution_id, 1.0, "aicte_permanent_id",
                                  warnings=tuple(warnings))
            warnings.append("unknown_permanent_id")

        if not q:
            return Resolution(UNRESOLVED, None, 0.0, "no_usable_reference", warnings=tuple(warnings))

        # 3. exact normalised name / alias
        ids = self._exact.get(" ".join(q))
        if ids:
            if len(ids) == 1:
                return Resolution(RESOLVED, self._insts[next(iter(ids))].institution_id,
                                  self.cfg.exact_name_confidence, "exact_name", warnings=tuple(warnings))
            kept = [i for i in ids if not self._state_mismatch(i, skey)] if state else list(ids)
            if len(kept) == 1 and state:
                return Resolution(RESOLVED, self._insts[kept[0]].institution_id, 0.95,
                                  "exact_name+state", warnings=tuple(warnings))
            cands = tuple(sorted((self._insts[i].institution_id, self.cfg.exact_name_confidence) for i in ids))
            return Resolution(AMBIGUOUS, None, 0.0, "exact_name_shared_by_multiple",
                              cands[:3], tuple(warnings))

        scores: Dict[int, float] = {}
        via_acronym: Set[int] = set()
        # 4. acronym (optionally with a location word, e.g. "VJTI Mumbai")
        for pos, t in enumerate(q):
            if t in self._acronyms:
                rest = q[:pos] + q[pos + 1:]
                for i in self._acronyms[t]:
                    loc = self._ign[i]
                    if all(r in loc or any(r in toks for toks in self._inst_entries[i]) for r in rest):
                        scores[i] = max(scores.get(i, 0.0), self.cfg.acronym_score)
                        via_acronym.add(i)

        # 5. fuzzy with blocking
        for eid in self._candidate_entries(q):
            i, toks = self._entries[eid]
            s = self._score(q, i, toks)
            if self._state_mismatch(i, skey):
                s *= self.cfg.state_mismatch_penalty
            if s > scores.get(i, 0.0):
                scores[i] = s
                via_acronym.discard(i)

        ranked = sorted(scores.items(), key=lambda kv: (-kv[1], self._insts[kv[0]].institution_id))
        ranked = [(i, s) for i, s in ranked if s >= self.cfg.review_floor]
        if not ranked:
            return Resolution(UNRESOLVED, None, 0.0, "no_candidate", warnings=tuple(warnings))
        cands = tuple((self._insts[i].institution_id, s) for i, s in ranked[:3])
        top_i, top_s = ranked[0]
        gap = top_s - ranked[1][1] if len(ranked) > 1 else 1.0
        if top_s >= self.cfg.resolve_threshold and gap >= self.cfg.resolve_margin:
            method = "acronym" if top_i in via_acronym else "fuzzy_name"
            return Resolution(RESOLVED, self._insts[top_i].institution_id,
                              min(top_s, self.cfg.fuzzy_confidence_cap), method, cands, tuple(warnings))
        if len(ranked) > 1 and gap < self.cfg.resolve_margin:
            return Resolution(AMBIGUOUS, None, 0.0, "close_candidates", cands, tuple(warnings))
        return Resolution(UNRESOLVED, None, 0.0, "low_confidence", cands, tuple(warnings))

    # ---------------------------------------------------------------- helpers
    def institution(self, institution_id: str) -> Institution:
        return self._insts[self._by_id[institution_id]]

    def __len__(self) -> int:
        return len(self._insts)
