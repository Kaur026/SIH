import json, math
import pytest
from conftest import mk
from overlap_engine import EngineConfig, OverlapEngine, HEADLINE, make_alert_id

def pairs(res):
    return {frozenset((a.case_a_id, a.case_b_id)) for a in res.alerts}

# ---------------------------------------------------------------- known answers
def test_planted_overlaps_found_and_traps_avoided(engine, sample_cases):
    res = engine.detect(sample_cases)
    found = pairs(res)
    planted = [("RB-2025-014", "PGRC-2025-088"), ("RB-2025-014", "RO-W-2025-007"),
               ("PGRC-2025-088", "RO-W-2025-007"), ("RB-2025-021", "PGRC-2025-101"),
               ("RB-2025-030", "PGRC-2025-120")]
    for a, b in planted:
        assert frozenset((a, b)) in found, (a, b)
    assert len(found) == len(planted)                      # nothing else flagged
    sup = {(frozenset((s["case_a_id"], s["case_b_id"])), s["reason"]) for s in res.suppressed}
    assert (frozenset(("RB-2025-050", "PGRC-2025-140")), "already_linked") in sup
    assert (frozenset(("RB-2024-077", "PGRC-2025-130")), "closed_case") in sup
    assert not any("RB-2025-041" in p and "RB-2025-042" in p for p in found)   # same cell
    assert {u["case_id"] for u in res.unresolved} == {"PGRC-2025-110", "PGRC-2025-160"}
    assert {e["case_id"] for e in res.errors} == {"BAD-1", "RB-2025-014"}      # invalid + duplicate

def test_confidence_ordering_matches_similarity(engine, sample_cases):
    res = {frozenset((a.case_a_id, a.case_b_id)): a for a in engine.detect(sample_cases).alerts}
    strong = res[frozenset(("RB-2025-014", "PGRC-2025-088"))]
    weak = res[frozenset(("RB-2025-030", "PGRC-2025-120"))]
    assert strong.confidence > weak.confidence and strong.tier == "HIGH" and weak.tier == "LOW"

# ---------------------------------------------------------------- suppression
def test_same_cell_not_flagged_unless_enabled(institutions):
    cases = [mk("A", "RB"), mk("B", "RB")]
    assert OverlapEngine(institutions).detect(cases).alerts == []
    on = OverlapEngine(institutions, EngineConfig(include_same_cell=True)).detect(cases)
    assert len(on.alerts) == 1

def test_cell_name_case_and_whitespace_insensitive(institutions):
    assert OverlapEngine(institutions).detect([mk("A", "RB"), mk("B", " rb ")]).alerts == []

@pytest.mark.parametrize("status", ["Closed", "resolved", "DISPOSED"])
def test_terminal_status_suppressed(engine, status):
    res = engine.detect([mk("A", "RB", status=status), mk("B", "PGRC")])
    assert res.alerts == [] and res.suppressed[0]["reason"] == "closed_case"

def test_include_closed_option(institutions):
    res = OverlapEngine(institutions, EngineConfig(include_closed=True)).detect(
        [mk("A", "RB", status="Closed"), mk("B", "PGRC")])
    assert len(res.alerts) == 1

def test_on_hold_and_transferred_are_active(engine):
    assert len(engine.detect([mk("A", "RB", status="On Hold"), mk("B", "PGRC", status="Transferred")]).alerts) == 1

def test_linked_via_case_field_param_either_direction(engine):
    base = [mk("A", "RB"), mk("B", "PGRC")]
    assert engine.detect([mk("A", "RB", linked_case_ids=["B"]), mk("B", "PGRC")]).alerts == []
    assert engine.detect([mk("A", "RB"), mk("B", "PGRC", linked_case_ids="A")]).alerts == []
    assert engine.detect(base, linked_pairs=[("B", "A")]).alerts == []

def test_link_boost_policy(institutions):
    eng = OverlapEngine(institutions, EngineConfig(explicit_link_policy="boost"))
    res = eng.detect([mk("A", "RB", linked_case_ids=["B"]), mk("B", "PGRC")])
    assert res.alerts[0].confidence == 1.0 and "explicitly linked" in res.alerts[0].reason

def test_dismissed_pair(engine):
    res = engine.detect([mk("A", "RB"), mk("B", "PGRC")], dismissed_pairs=[("A", "B")])
    assert res.alerts == [] and res.suppressed[0]["reason"] == "dismissed_by_officer"

def test_time_window(institutions):
    eng = OverlapEngine(institutions, EngineConfig(max_gap_days=30))
    res = eng.detect([mk("A", "RB", received_at="2025-01-01"), mk("B", "PGRC", received_at="2025-06-01")])
    assert res.alerts == [] and res.suppressed[0]["reason"] == "outside_time_window"

def test_different_institutions_never_flagged(engine):
    res = engine.detect([mk("A", "RB"), mk("B", "PGRC", name="Greenfield Polytechnic")])
    assert res.alerts == [] and res.suppressed == []

def test_unresolved_and_ambiguous_never_alert(engine):
    res = engine.detect([mk("A", "RB", name="Sunrise Institute of Technology"),
                         mk("B", "PGRC", name="Sunrise Institute of Technology")])
    assert res.alerts == [] and len(res.unresolved) == 2

def test_state_resolves_ambiguous_name(engine):
    res = engine.detect([mk("A", "RB", name="Sunrise Institute of Technology", institution_state="Maharashtra"),
                         mk("B", "PGRC", name="SIT Nashik")])
    assert len(res.alerts) == 1 and res.alerts[0].institution_id == "INST-002"

# ---------------------------------------------------------------- scoring
def test_identical_text_same_category_near_in_time_scores_high(engine):
    kw = dict(title="Unpaid faculty salary", description="Faculty salary unpaid for months", category="Faculty")
    a = engine.detect([mk("A", "RB", **kw), mk("B", "PGRC", **kw)]).alerts[0]
    assert a.confidence > 0.9 and a.tier == "HIGH"

def test_missing_signals_do_not_penalise_unfairly(engine):
    a = engine.detect([mk("A", "RB", title="", description="", received_at=None),
                       mk("B", "PGRC", title="", description="", received_at=None)]).alerts[0]
    assert abs(a.confidence - 0.98) < 1e-9          # only base signal available -> inst_conf

def test_confidence_bounds_and_below_min(institutions):
    eng = OverlapEngine(institutions, EngineConfig(min_confidence=0.9, medium_threshold=0.9, high_threshold=0.95))
    res = eng.detect([mk("A", "RB", title="x y", description="alpha beta", category="c1"),
                      mk("B", "PGRC", title="z w", description="gamma delta", category="c2", received_at="2030-01-01")])
    assert res.alerts == [] and res.suppressed[0]["reason"] == "below_min_confidence"

def test_category_groups_give_partial_credit(institutions):
    cfg = EngineConfig(category_groups={"fees": ["Fee Irregularity", "Admission Irregularity"]})
    same = OverlapEngine(institutions, cfg).detect([mk("A", "RB", category="Fee Irregularity"), mk("B", "PGRC", category="Admission Irregularity")]).alerts[0]
    diff = OverlapEngine(institutions).detect([mk("A", "RB", category="Fee Irregularity"), mk("B", "PGRC", category="Admission Irregularity")]).alerts[0]
    assert same.signals["category_match"] == "related" and same.confidence > diff.confidence

# ---------------------------------------------------------------- contract / robustness
def test_alert_contract_and_json_serialisable(engine, sample_cases):
    d = engine.detect(sample_cases).to_dict()
    json.dumps(d)
    required = {"alert_id", "headline", "case_a_id", "case_b_id", "cell_a", "cell_b", "institution_id",
                "institution_name", "confidence", "confidence_pct", "tier", "reason", "signals"}
    for al in d["alerts"]:
        assert required <= set(al) and al["headline"] == HEADLINE
        assert 0 <= al["confidence"] <= 1 and al["tier"] in {"HIGH", "MEDIUM", "LOW"}
        assert "\n" not in al["reason"] and al["reason"].endswith(".")

def test_alert_id_stable_and_order_independent(engine):
    a = engine.detect([mk("A", "RB"), mk("B", "PGRC")]).alerts[0]
    b = engine.detect([mk("B", "PGRC"), mk("A", "RB")]).alerts[0]
    assert a.alert_id == b.alert_id == make_alert_id("INST-001", "B", "A")

def test_input_order_does_not_change_output(engine, sample_cases):
    import random
    base = engine.detect(sample_cases).to_dict()["alerts"]
    shuffled = list(sample_cases); random.Random(1).shuffle(shuffled)
    # "first occurrence wins" for duplicate ids is order dependent, so drop the planted duplicate row
    clean = [c for c in sample_cases if c["case_id"] != "RB-2025-014" or c.get("title") != "Duplicate id row"]
    a = engine.detect(clean).to_dict()["alerts"]
    b = engine.detect(sorted(clean, key=lambda c: c["case_id"], reverse=True)).to_dict()["alerts"]
    assert a == b

def test_empty_and_single_inputs(engine):
    assert engine.detect([]).alerts == []
    assert engine.detect([mk("A", "RB")]).stats["pairs_evaluated"] == 0

@pytest.mark.parametrize("bad", [{}, {"case_id": "X"}, {"source_cell": "RB"}, {"case_id": "X", "source_cell": "RB", "received_at": "not-a-date"}, 42, None])
def test_malformed_cases_reported_not_raised(engine, bad):
    res = engine.detect([bad, mk("OK", "RB")])
    assert len(res.errors) == 1 and res.stats["cases_valid"] == 1

def test_dates_naive_aware_mixed(engine):
    res = engine.detect([mk("A", "RB", received_at="2025-01-01T00:00:00"), mk("B", "PGRC", received_at="2025-01-03T00:00:00+05:30")])
    assert len(res.alerts) == 1 and res.alerts[0].signals["days_apart"] is not None

def test_field_aliases_accepted(engine):
    res = engine.detect([{"complaint_number": "A", "department_code": "RB", "institution": "ABC", "description": "x"},
                         {"id": "B", "bureau": "PGRC", "institution": "ABC", "details": "y"}])
    assert len(res.alerts) == 1

def test_pair_cap_warns(institutions):
    eng = OverlapEngine(institutions, EngineConfig(max_pairs_per_institution=3))
    cases = [mk(f"R{i}", "RB") for i in range(4)] + [mk(f"P{i}", "PGRC") for i in range(4)]
    res = eng.detect(cases)
    assert res.stats["pairs_evaluated"] == 3 and any("pair_cap" in str(w) for w in res.warnings)

def test_invalid_config_rejected():
    with pytest.raises(ValueError): EngineConfig(min_confidence=0.9).validate()
    with pytest.raises(ValueError): EngineConfig.from_dict({"nope": 1})
    with pytest.raises(ValueError): EngineConfig(explicit_link_policy="x").validate()

def test_incremental_equals_batch_subset(engine, sample_cases):
    clean = [c for c in sample_cases if c.get("title") != "Duplicate id row" and "source_cell" in c]
    new = next(c for c in clean if c["case_id"] == "PGRC-2025-088")
    rest = [c for c in clean if c["case_id"] != "PGRC-2025-088"]
    inc = engine.detect_for_case(new, rest)
    full = engine.detect(clean)
    expect = {frozenset((a.case_a_id, a.case_b_id)) for a in full.alerts if "PGRC-2025-088" in (a.case_a_id, a.case_b_id)}
    assert pairs(inc) == expect and len(expect) == 2
