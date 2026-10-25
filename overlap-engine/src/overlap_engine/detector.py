"""Cross-bureau overlap detection.

Pipeline (see README for the rationale):
  ingest/validate -> resolve institutions -> group by institution (blocking)
  -> bucket by cell -> cross-cell pairs only -> suppression rules
  -> weighted confidence -> tier + one-line explanation.

Complexity: let n = cases, g_k = cases for institution k, c_k = cells in it.
  * ingest + resolve + tokenise: O(n * text_len) (+ resolver cost per distinct reference, cached)
  * pair evaluation: sum_k (pairs across different cells)  <=  sum_k g_k^2 / 2
    worst case O(n^2) only if every case belongs to one institution; typical data is
    dominated by many small groups.  max_pairs_per_institution bounds the worst case.
"""
from __future__ import annotations

import hashlib
import math
import time
from collections import Counter, defaultdict
from typing import Any, Dict, Iterable, List, Optional, Sequence, Set, Tuple

from .config import EngineConfig
from .explain import build_reason
from .models import Case, DetectionResult, OverlapAlert
from .resolver import AMBIGUOUS, RESOLVED, InstitutionResolver, Resolution
from .similarity import TfidfModel, cosine, shared_terms
from .textnorm import text_tokens

Pair = frozenset


def _cell_key(cell: str) -> str:
    return " ".join(cell.casefold().split())


def _pair_key(a: str, b: str) -> Pair:
    return frozenset((a, b))


def make_alert_id(institution_id: str, id_a: str, id_b: str) -> str:
    lo, hi = sorted((id_a, id_b))
    digest = hashlib.sha1(f"{institution_id}|{lo}|{hi}".encode()).hexdigest()
    return "OV-" + digest[:12].upper()


class OverlapEngine:
    def __init__(self, institutions: Iterable, config: Optional[EngineConfig] = None) -> None:
        self.cfg = (config or EngineConfig()).validate()
        self.resolver = InstitutionResolver(institutions, self.cfg)

    # ------------------------------------------------------------------ public
    def detect(self, cases: Iterable[Any], *, linked_pairs: Iterable[Sequence[str]] = (),
               dismissed_pairs: Iterable[Sequence[str]] = (),
               focus_case_id: Optional[str] = None) -> DetectionResult:
        """Batch detection over ``cases`` (Case objects or dicts).

        linked_pairs     -- (case_id, case_id) pairs already linked via the dashboard
        dismissed_pairs  -- pairs an officer marked "not an overlap"
        focus_case_id    -- only report pairs involving this case (incremental mode)
        """
        t0 = time.perf_counter()
        cfg, res = self.cfg, DetectionResult()
        valid = self._ingest(cases, res)

        linked: Set[Pair] = {_pair_key(a, b) for a, b in linked_pairs}
        for c in valid:
            linked.update(_pair_key(c.case_id, o) for o in c.linked_case_ids)
        dismissed: Set[Pair] = {_pair_key(a, b) for a, b in dismissed_pairs}

        # -- resolve institutions, group (blocking key = institution_id)
        groups: Dict[str, List[Tuple[Case, Resolution]]] = defaultdict(list)
        status_counts: Counter = Counter()
        for c in valid:
            r = self.resolver.resolve(institution_id=c.institution_id,
                                      permanent_id=c.aicte_permanent_id,
                                      name=c.institution_name, state=c.institution_state)
            status_counts[r.status] += 1
            if r.warnings:
                res.warnings.append({"case_id": c.case_id, "warnings": list(r.warnings)})
            if r.resolved:
                groups[r.institution_id].append((c, r))
            else:
                res.unresolved.append({"case_id": c.case_id, "status": r.status, "method": r.method,
                                       "candidates": [{"institution_id": i, "score": round(s, 4)}
                                                      for i, s in r.candidates]})

        t_resolved = time.perf_counter()
        # -- text model over every valid case (IDF needs the whole corpus)
        tokens = {c.case_id: text_tokens(f"{c.title} {c.title} {c.description}") for c in valid}
        model = TfidfModel().fit(tokens.values())
        vec_cache: Dict[str, dict] = {}

        def vec(cid: str) -> dict:
            v = vec_cache.get(cid)
            if v is None:
                v = vec_cache[cid] = model.vectorize(tokens[cid])
            return v

        pairs_evaluated = 0
        suppressed_counts: Counter = Counter()
        multi_cell_groups = 0
        for inst_id in sorted(groups):
            members = sorted(groups[inst_id], key=lambda cr: cr[0].case_id)
            buckets: Dict[str, List[Tuple[Case, Resolution]]] = defaultdict(list)
            for cr in members:
                buckets[_cell_key(cr[0].source_cell)].append(cr)
            if len(buckets) >= 2:
                multi_cell_groups += 1
            if focus_case_id and not any(c.case_id == focus_case_id for c, _ in members):
                continue
            inst_name = self.resolver.institution(inst_id).name
            n_pairs = 0
            capped = False
            for a, ra, b, rb in self._pairs(members, buckets):
                if focus_case_id and focus_case_id not in (a.case_id, b.case_id):
                    continue
                if n_pairs >= cfg.max_pairs_per_institution:
                    capped = True
                    break
                n_pairs += 1
                outcome = self._evaluate(a, ra, b, rb, inst_id, inst_name, vec, linked, dismissed)
                if isinstance(outcome, OverlapAlert):
                    res.alerts.append(outcome)
                else:
                    suppressed_counts[outcome["reason"]] += 1
                    if cfg.record_suppressed:
                        res.suppressed.append(outcome)
            pairs_evaluated += n_pairs
            if capped:
                res.warnings.append({"institution_id": inst_id,
                                     "warnings": [f"pair_cap_reached({cfg.max_pairs_per_institution})"]})

        res.alerts.sort(key=lambda al: (-al.confidence, al.alert_id))
        res.stats = {
            "cases_received": len(valid) + len(res.errors),
            "cases_valid": len(valid),
            "institutions_resolved_cases": status_counts[RESOLVED],
            "ambiguous_cases": status_counts[AMBIGUOUS],
            "unresolved_cases": len(res.unresolved),
            "institutions_with_multiple_cells": multi_cell_groups,
            "pairs_evaluated": pairs_evaluated,
            "alerts": len(res.alerts),
            "alerts_by_tier": dict(Counter(a.tier for a in res.alerts)),
            "suppressed_by_reason": dict(suppressed_counts),
            "resolve_ms": round((t_resolved - t0) * 1000, 2),
            "scoring_ms": round((time.perf_counter() - t_resolved) * 1000, 2),
            "runtime_ms": round((time.perf_counter() - t0) * 1000, 2),
        }
        return res

    def detect_for_case(self, new_case: Any, existing_cases: Iterable[Any], **kw) -> DetectionResult:
        """Incremental mode: alerts involving ``new_case`` against ``existing_cases``.

        Note: TF-IDF statistics are re-fitted on the cases passed in, so callers
        should pass the full active case set for consistent scores.
        """
        nc = new_case if isinstance(new_case, Case) else Case.from_dict(new_case)
        existing = [c for c in existing_cases
                    if (c.case_id if isinstance(c, Case) else c.get("case_id")) != nc.case_id]
        return self.detect([*existing, nc], focus_case_id=nc.case_id, **kw)

    # ----------------------------------------------------------------- helpers
    def _ingest(self, cases: Iterable[Any], res: DetectionResult) -> List[Case]:
        seen: Set[str] = set()
        out: List[Case] = []
        for raw in cases:
            try:
                c = raw if isinstance(raw, Case) else Case.from_dict(raw)
            except (ValueError, TypeError, AttributeError) as exc:
                cid = raw.get("case_id") if isinstance(raw, dict) else None
                res.errors.append({"case_id": cid, "error": str(exc)})
                continue
            if c.case_id in seen:
                res.errors.append({"case_id": c.case_id, "error": "duplicate_case_id (first occurrence kept)"})
                continue
            seen.add(c.case_id)
            out.append(c)
        return out

    def _pairs(self, members, buckets):
        keys = sorted(buckets)
        for i, ki in enumerate(keys):
            for kj in keys[i + 1:]:
                for a, ra in buckets[ki]:
                    for b, rb in buckets[kj]:
                        yield a, ra, b, rb
            if self.cfg.include_same_cell:
                bucket = buckets[ki]
                for x in range(len(bucket)):
                    for y in range(x + 1, len(bucket)):
                        yield bucket[x][0], bucket[x][1], bucket[y][0], bucket[y][1]

    def _is_terminal(self, c: Case) -> bool:
        return c.status.casefold() in self.cfg.terminal_statuses

    def _category_signal(self, a: Case, b: Case) -> Tuple[Optional[float], str]:
        if not a.category or not b.category:
            return None, "unknown"
        ca, cb = a.category.casefold().strip(), b.category.casefold().strip()
        if ca == cb:
            return 1.0, "same"
        for members in self.cfg.category_groups.values():
            m = {x.casefold().strip() for x in members}
            if ca in m and cb in m:
                return 0.5, "related"
        return 0.0, "different"

    def _evaluate(self, a: Case, ra: Resolution, b: Case, rb: Resolution, inst_id: str,
                  inst_name: str, vec, linked: Set[Pair], dismissed: Set[Pair]):
        cfg = self.cfg
        # stable ordering: earlier received first, then id
        def order(c: Case):
            return (c.received_at.timestamp() if c.received_at else math.inf, c.case_id)
        a, ra, b, rb = (a, ra, b, rb) if order(a) <= order(b) else (b, rb, a, ra)
        pk = _pair_key(a.case_id, b.case_id)

        def sup(reason: str) -> dict:
            return {"case_a_id": a.case_id, "case_b_id": b.case_id,
                    "institution_id": inst_id, "reason": reason}

        is_linked = pk in linked
        if is_linked and cfg.explicit_link_policy == "suppress":
            return sup("already_linked")
        if pk in dismissed:
            return sup("dismissed_by_officer")
        if not cfg.include_closed and (self._is_terminal(a) or self._is_terminal(b)):
            return sup("closed_case")

        days = None
        if a.received_at and b.received_at:
            days = abs((b.received_at - a.received_at).total_seconds()) / 86400.0
            if cfg.max_gap_days is not None and days > cfg.max_gap_days:
                return sup("outside_time_window")

        # ---- signals
        va, vb = vec(a.case_id), vec(b.case_id)
        text = cosine(va, vb) if va and vb else None
        cat, cat_kind = self._category_signal(a, b)
        time_s = math.exp(-days / cfg.time_decay_days) if days is not None else None
        signals = {"text": text, "category": cat, "time": time_s}
        w = cfg.weights
        num, den = w["base"], w["base"]
        for name, val in signals.items():
            if val is not None and w.get(name, 0) > 0:
                num += w[name] * val
                den += w[name]
        inst_conf = min(ra.confidence, rb.confidence)
        conf = inst_conf * num / den
        if is_linked:                       # policy == "boost"
            conf = 1.0
        if conf < cfg.min_confidence:
            return sup("below_min_confidence")
        tier = "HIGH" if conf >= cfg.high_threshold else "MEDIUM" if conf >= cfg.medium_threshold else "LOW"

        terms = shared_terms(va, vb) if text else []
        reason = build_reason(inst_name=inst_name, a=a, b=b, inst_method=min((ra, rb), key=lambda r: r.confidence).method,
                              inst_conf=inst_conf, text=text, terms=terms, cat_kind=cat_kind,
                              days=days, explicit_link=is_linked)
        return OverlapAlert(
            alert_id=make_alert_id(inst_id, a.case_id, b.case_id),
            case_a_id=a.case_id, case_b_id=b.case_id, cell_a=a.source_cell, cell_b=b.source_cell,
            institution_id=inst_id, institution_name=inst_name,
            confidence=conf, tier=tier, reason=reason,
            signals={"institution_confidence": round(inst_conf, 4),
                     "text_similarity": None if text is None else round(text, 4),
                     "category_match": cat_kind,
                     "days_apart": None if days is None else round(days, 1),
                     "shared_terms": terms, "explicitly_linked": is_linked})
