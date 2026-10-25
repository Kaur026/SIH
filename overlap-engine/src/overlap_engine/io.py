"""Thin JSON helpers (kept out of the core engine)."""
from __future__ import annotations

import json
from pathlib import Path
from typing import Any, List


def load_json(path: str) -> Any:
    with Path(path).open(encoding="utf-8") as fh:
        return json.load(fh)


def dump_json(obj: Any, path: str | None) -> None:
    text = json.dumps(obj, indent=2, ensure_ascii=False)
    if path:
        Path(path).write_text(text + "\n", encoding="utf-8")
    else:
        print(text)
