"""Command line: python -m overlap_engine {detect,resolve,tag} ..."""
from __future__ import annotations

import argparse
import sys

from .config import EngineConfig
from .detector import OverlapEngine
from .io import dump_json, load_json
from .summarize import summarize
from .tagging import CategoryTagger


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(prog="overlap_engine", description=__doc__)
    sub = ap.add_subparsers(dest="cmd", required=True)

    d = sub.add_parser("detect", help="detect overlaps in a cases JSON file")
    d.add_argument("--institutions", required=True)
    d.add_argument("--cases", required=True)
    d.add_argument("--config", help="JSON file of EngineConfig overrides")
    d.add_argument("--linked", help="JSON list of [case_id, case_id] pairs already linked")
    d.add_argument("--dismissed", help="JSON list of [case_id, case_id] pairs marked not-overlap")
    d.add_argument("--out")

    r = sub.add_parser("resolve", help="resolve one institution reference")
    r.add_argument("--institutions", required=True)
    r.add_argument("--name"); r.add_argument("--permanent-id"); r.add_argument("--state")

    t = sub.add_parser("tag", help="auto-tag and summarise cases")
    t.add_argument("--cases", required=True)
    t.add_argument("--out")

    a = ap.parse_args(argv)
    try:
        if a.cmd == "detect":
            cfg = EngineConfig.from_dict(load_json(a.config)) if a.config else EngineConfig()
            eng = OverlapEngine(load_json(a.institutions), cfg)
            res = eng.detect(load_json(a.cases),
                             linked_pairs=load_json(a.linked) if a.linked else (),
                             dismissed_pairs=load_json(a.dismissed) if a.dismissed else ())
            dump_json(res.to_dict(), a.out)
        elif a.cmd == "resolve":
            eng = OverlapEngine(load_json(a.institutions))
            dump_json(eng.resolver.resolve(name=a.name, permanent_id=a.permanent_id, state=a.state).to_dict(), None)
        else:
            tagger, out = CategoryTagger(), []
            for c in load_json(a.cases):
                title, desc = c.get("title", ""), c.get("description", "")
                out.append({"case_id": c.get("case_id"), **tagger.tag(title, desc).to_dict(),
                            "summary": summarize(f"{title}. {desc}" if title else desc)})
            dump_json(out, a.out)
    except (ValueError, OSError) as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 2
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
