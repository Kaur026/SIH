"""Synthetic (fictional) data generator for evaluation & benchmarks. Deterministic by seed."""
import random
from datetime import datetime, timedelta, timezone

CONS = "b c d g h j k l m n p r s t v".split()
VOW = "a e i o u".split()
TYPES = ["Institute of Technology", "Engineering College", "College of Engineering and Technology",
         "Polytechnic", "Institute of Management Studies", "Institute of Engineering"]
CITIES = [("Pune", "Maharashtra"), ("Nashik", "Maharashtra"), ("Nagpur", "Maharashtra"), ("Indore", "Madhya Pradesh"),
          ("Bhopal", "Madhya Pradesh"), ("Chennai", "Tamil Nadu"), ("Coimbatore", "Tamil Nadu"), ("Mysuru", "Karnataka"),
          ("Hubballi", "Karnataka"), ("Jaipur", "Rajasthan"), ("Kota", "Rajasthan"), ("Lucknow", "Uttar Pradesh"),
          ("Kanpur", "Uttar Pradesh"), ("Patna", "Bihar"), ("Ranchi", "Jharkhand"), ("Guwahati", "Assam"),
          ("Kochi", "Kerala"), ("Hyderabad", "Telangana"), ("Warangal", "Telangana"), ("Raipur", "Chhattisgarh")]
CELLS = ["RB", "PGRC", "Regional Office North", "Regional Office South", "Academic Bureau"]
STATUS = ["Received", "Under Review", "In Progress", "On Hold", "Closed", "Resolved"]
ISSUES = ["faculty salary unpaid", "fee refund denied", "course without approval", "laboratory equipment deficiency",
          "ragging in hostel", "degree certificate withheld", "admission irregularity", "excess fee collected",
          "fake faculty records", "intake above approved limit"]

def word(rng):
    return "".join(rng.choice(CONS) + rng.choice(VOW) for _ in range(rng.choice((2, 3)))).capitalize()

def make_institutions(n, seed=0):
    rng = random.Random(seed); seen = set(); out = []
    while len(out) < n:
        w = word(rng); typ = rng.choice(TYPES); city, state = rng.choice(CITIES)
        name = f"{w} {typ}"
        if (name, city) in seen: continue
        seen.add((name, city)); i = len(out) + 1
        short = w.upper() + ("IT" if "Technology" in typ else "EC")
        out.append({"institution_id": f"I{i:06d}", "name": name, "aicte_permanent_id": f"1-{2000000 + i}",
                    "aliases": [short], "state": state, "city": city, "_w": w, "_typ": typ})
    return out

def typo(tok, rng):
    if len(tok) < 6: return tok
    i = rng.randrange(1, len(tok) - 1)
    kind = rng.choice("sdt")
    if kind == "s": return tok[:i] + rng.choice("abcdefghijklmnopqrstuvwxyz") + tok[i + 1:]
    if kind == "d": return tok[:i] + tok[i + 1:]
    return tok[:i] + tok[i + 1] + tok[i] + tok[i + 2:] if i + 1 < len(tok) else tok

def variant(inst, kind, rng):
    w, typ = inst["_w"], inst["_typ"]
    if kind == "exact": return inst["name"]
    if kind == "abbrev": return (w + " " + typ).replace("Engineering", "Engg").replace("College", "Coll.").replace("Institute", "Inst.").replace("Technology", "Tech.")
    if kind == "typo": return " ".join(typo(t, rng) for t in inst["name"].split())
    if kind == "dropped_generic":          # keep the distinctive word + ONE real type word (or none)
        gen = [t for t in typ.split() if t.lower() not in ("of", "and")]
        return f"{w} {rng.choice(gen + [''])}".strip()
    if kind == "alias": return inst["aliases"][0]
    if kind == "lowercase_city": return f"{inst['name'].lower()}, {inst['city'].lower()}"
    raise ValueError(kind)

VARIANTS = ["exact", "abbrev", "typo", "dropped_generic", "alias", "lowercase_city"]

def make_cases(insts, n, seed=1, overlap_rate=0.3, span_days=300):
    """n cases; ~overlap_rate of institutions get cases in several cells."""
    rng = random.Random(seed); base = datetime(2025, 1, 1, tzinfo=timezone.utc); out = []
    hot = rng.sample(insts, max(1, int(len(insts) * overlap_rate)))
    for i in range(n):
        inst = rng.choice(hot) if rng.random() < 0.6 else rng.choice(insts)
        kind = rng.choice(VARIANTS)
        out.append({"case_id": f"C{i:07d}", "source_cell": rng.choice(CELLS),
                    "institution_name": variant(inst, kind, rng), "institution_state": inst["state"] if rng.random() < .7 else None,
                    "title": rng.choice(ISSUES).capitalize(), "description": " ".join(rng.choices(ISSUES, k=2)),
                    "category": rng.choice(ISSUES) if rng.random() < .8 else None, "status": rng.choice(STATUS),
                    "received_at": (base + timedelta(days=rng.randint(0, span_days))).isoformat(),
                    "_truth": inst["institution_id"], "_kind": kind})
    return out
