"""Differential test: engine (blocking + bucketing) vs. naive O(n^2) all-pairs oracle."""
import itertools, math, random
import pytest
from overlap_engine import Case, EngineConfig, OverlapEngine
from overlap_engine.similarity import TfidfModel, cosine
from overlap_engine.textnorm import text_tokens

NAMES = ["ABC Engineering College", "ABC", "ABC Engg Collage", "NIAS", "National Institute of Applied Sciences",
         "Greenfield Poly", "RKMIT", "Dr R K Mehta Inst of Tech", "KIT", "KIIT", "SIT", "Sunrise Institute of Technology",
         "SIT Nashik", "Nowhere Academy", None]
CELLS = ["RB", "PGRC", "Regional Office West", "rb", "ACAD"]
STATUS = ["Received", "Under Review", "In Progress", "On Hold", "Closed", "Resolved"]
CATS = ["Fee", "Faculty", "Approval", None]
WORDS = "salary faculty fee refund approval campus hostel lab ragging certificate admission delay unpaid".split()

def random_cases(rng, n):
    out = []
    for i in range(n):
        out.append(Case(case_id=f"C{i}", source_cell=rng.choice(CELLS), institution_name=rng.choice(NAMES),
                        title=" ".join(rng.choices(WORDS, k=3)), description=" ".join(rng.choices(WORDS, k=8)),
                        category=rng.choice(CATS), status=rng.choice(STATUS),
                        received_at=None if rng.random() < .1 else __import__("datetime").datetime(2025, 1, 1, tzinfo=__import__("datetime").timezone.utc) + __import__("datetime").timedelta(days=rng.randint(0, 200))))
    return out

def oracle(engine, cases, linked, dismissed):
    cfg = engine.cfg
    res = {c.case_id: engine.resolver.resolve(institution_id=c.institution_id, permanent_id=c.aicte_permanent_id,
                                               name=c.institution_name, state=c.institution_state) for c in cases}
    toks = {c.case_id: text_tokens(f"{c.title} {c.title} {c.description}") for c in cases}
    model = TfidfModel().fit(toks.values())
    vec = {k: model.vectorize(v) for k, v in toks.items()}
    alerts, supp = {}, {}
    for a, b in itertools.combinations(cases, 2):
        ra, rb = res[a.case_id], res[b.case_id]
        if not (ra.resolved and rb.resolved and ra.institution_id == rb.institution_id):
            continue
        if " ".join(a.source_cell.casefold().split()) == " ".join(b.source_cell.casefold().split()):
            continue
        pk = frozenset((a.case_id, b.case_id))
        if pk in linked: supp[pk] = "already_linked"; continue
        if pk in dismissed: supp[pk] = "dismissed_by_officer"; continue
        if a.status.casefold() in cfg.terminal_statuses or b.status.casefold() in cfg.terminal_statuses:
            supp[pk] = "closed_case"; continue
        w = cfg.weights; num = den = w["base"]
        t = cosine(vec[a.case_id], vec[b.case_id]) if vec[a.case_id] and vec[b.case_id] else None
        if t is not None: num += w["text"] * t; den += w["text"]
        if a.category and b.category:
            num += w["category"] * (1.0 if a.category == b.category else 0.0); den += w["category"]
        if a.received_at and b.received_at:
            d = abs((a.received_at - b.received_at).total_seconds()) / 86400
            num += w["time"] * math.exp(-d / cfg.time_decay_days); den += w["time"]
        conf = min(ra.confidence, rb.confidence) * num / den
        if conf < cfg.min_confidence: supp[pk] = "below_min_confidence"; continue
        alerts[pk] = conf
    return alerts, supp

@pytest.mark.parametrize("seed", range(25))
def test_engine_matches_bruteforce_oracle(institutions, seed):
    rng = random.Random(seed)
    cases = random_cases(rng, rng.randint(2, 60))
    ids = [c.case_id for c in cases]
    linked = {frozenset(rng.sample(ids, 2)) for _ in range(3)}
    dismissed = {frozenset(rng.sample(ids, 2)) for _ in range(3)}
    eng = OverlapEngine(institutions)
    got = eng.detect(cases, linked_pairs=[tuple(p) for p in linked], dismissed_pairs=[tuple(p) for p in dismissed])
    exp_alerts, exp_supp = oracle(eng, cases, linked, dismissed)
    got_alerts = {frozenset((a.case_a_id, a.case_b_id)): a.confidence for a in got.alerts}
    assert set(got_alerts) == set(exp_alerts)
    for k, v in exp_alerts.items():
        assert got_alerts[k] == pytest.approx(v, abs=1e-9)
    got_supp = {frozenset((s["case_a_id"], s["case_b_id"])): s["reason"] for s in got.suppressed}
    assert got_supp == exp_supp
