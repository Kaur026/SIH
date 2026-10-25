"""Scaling benchmark. Run: python benchmarks/bench.py   (all data is synthetic)"""
import sys, time, tracemalloc, itertools
sys.path[:0] = ["src", "benchmarks"]
from overlap_engine import OverlapEngine
from synth import make_institutions, make_cases

def strip(rows): return [{k: v for k, v in r.items() if not k.startswith("_")} for r in rows]

def naive_pairing_s(engine, cases):
    """Baseline pairing stage WITHOUT blocking: test every case pair for same-institution/different-cell.
    Resolution is done first (excluded from the timing) so only the pairing strategy is compared."""
    res = [(c["source_cell"].casefold(), engine.resolver.resolve(name=c["institution_name"], state=c["institution_state"]))
           for c in cases]
    t0 = time.perf_counter(); hits = 0
    for (ca, ra), (cb, rb) in itertools.combinations(res, 2):
        if ra.resolved and rb.resolved and ra.institution_id == rb.institution_id and ca != cb:
            hits += 1
    return time.perf_counter() - t0, hits

print(f"{'cases':>7} {'insts':>6} {'total s':>8} {'resolve s':>10} {'score+pair s':>13} {'pairs eval':>11} {'alerts':>7} | naive all-pairs id-check s (pairs tested)")
for n_cases, n_inst in [(1000, 500), (5000, 2000), (20000, 5000), (50000, 10000)]:
    insts = make_institutions(n_inst, seed=3)
    eng = OverlapEngine(strip(insts))
    cases = strip(make_cases(insts, n_cases, seed=5))
    t0 = time.perf_counter(); res = eng.detect(cases); dt = time.perf_counter() - t0
    naive = ""
    if n_cases <= 20000:
        nt, _ = naive_pairing_s(eng, cases); naive = f"{nt:.2f} ({n_cases*(n_cases-1)//2:,})"
    s = res.stats
    print(f"{n_cases:>7} {n_inst:>6} {dt:>8.2f} {s['resolve_ms']/1000:>10.2f} {s['scoring_ms']/1000:>13.2f} {s['pairs_evaluated']:>11} {s['alerts']:>7} | {naive}")

# incremental latency: one new case against 20k existing
insts = make_institutions(5000, seed=3); eng = OverlapEngine(strip(insts))
cases = strip(make_cases(insts, 20000, seed=5)); eng.detect(cases)       # warm resolver cache
new = dict(cases[0], case_id="NEW-1", source_cell="PGRC")
t0 = time.perf_counter(); r = eng.detect_for_case(new, cases); print(f"\nincremental detect_for_case vs 20k existing (warm cache): {time.perf_counter() - t0:.2f}s, {len(r.alerts)} alerts")

# peak memory at 20k cases
tracemalloc.start(); eng = OverlapEngine(strip(insts)); eng.detect(cases)
cur, peak = tracemalloc.get_traced_memory(); tracemalloc.stop()
print(f"peak Python memory for 20k-case batch (tracemalloc, includes caches): {peak/1e6:.0f} MB")
