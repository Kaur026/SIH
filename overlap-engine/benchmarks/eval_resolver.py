"""Synthetic evaluation of institution resolution. Run: python benchmarks/eval_resolver.py [N_INSTITUTIONS]"""
import sys, time, random
from collections import defaultdict
sys.path[:0] = ["src", "benchmarks"]
from overlap_engine import InstitutionResolver, RESOLVED
from synth import make_institutions, variant, VARIANTS

n = int(sys.argv[1]) if len(sys.argv) > 1 else 2000
insts = make_institutions(n, seed=7)
reg = [{k: v for k, v in i.items() if not k.startswith("_")} for i in insts]
t0 = time.perf_counter(); rs = InstitutionResolver(reg); build = time.perf_counter() - t0
rng = random.Random(11)
stats = defaultdict(lambda: [0, 0, 0, 0])   # total, correct, wrong, abstained
t0 = time.perf_counter(); calls = 0
for inst in insts:
    for kind in VARIANTS:
        for use_state in (False, True):
            name = variant(inst, kind, rng)
            r = rs.resolve(name=name, state=inst["state"] if use_state else None); calls += 1
            s = stats[kind]; s[0] += 1
            if r.status == RESOLVED:
                s[1 if r.institution_id == inst["institution_id"] else 2] += 1
            else:
                s[3] += 1
elapsed = time.perf_counter() - t0
# negatives: names of institutions NOT in the registry must never resolve
neg = make_institutions(500, seed=999)
false_pos = sum(rs.resolve(name=i["name"]).status == RESOLVED for i in neg if i["name"] not in {x["name"] for x in reg})
print(f"registry={n} institutions, build={build*1000:.0f} ms, {calls} resolutions in {elapsed:.2f}s ({calls/elapsed:.0f}/s, uncached)")
print(f"{'variant':<18}{'total':>7}{'correct%':>10}{'wrong%':>8}{'abstain%':>10}")
tot = [0, 0, 0, 0]
for k in VARIANTS:
    t, c, w, a = stats[k]; tot = [x + y for x, y in zip(tot, (t, c, w, a))]
    print(f"{k:<18}{t:>7}{100*c/t:>10.2f}{100*w/t:>8.2f}{100*a/t:>10.2f}")
t, c, w, a = tot
print(f"{'ALL':<18}{t:>7}{100*c/t:>10.2f}{100*w/t:>8.2f}{100*a/t:>10.2f}")
print(f"unknown-institution false resolutions: {false_pos} / {len(neg)}")
