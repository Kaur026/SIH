"""Builds the single 'why flagged' line shown with each alert."""
from __future__ import annotations

from typing import List, Optional

from .models import Case

_METHOD_TEXT = {
    "institution_id": None,
    "aicte_permanent_id": "matched by AICTE Permanent ID",
    "exact_name": "matched by institution name/alias",
    "exact_name+state": "matched by institution name/alias and state",
    "acronym": "matched by institution short name",
    "fuzzy_name": "matched by approximate institution name",
}


def build_reason(*, inst_name: str, a: Case, b: Case, inst_method: str, inst_conf: float,
                 text: Optional[float], terms: List[str], cat_kind: str,
                 days: Optional[float], explicit_link: bool) -> str:
    parts: List[str] = [
        f"{inst_name}: {a.source_cell} case {a.case_id} ({a.status}) and "
        f"{b.source_cell} case {b.case_id} ({b.status}) are being handled by different cells"
    ]
    how = _METHOD_TEXT.get(inst_method)
    if how:
        parts.append(f"institution {how} ({round(inst_conf * 100)}%)")
    if explicit_link:
        parts.append("cases were explicitly linked")
    if text is not None:
        if text >= 0.40:
            parts.append("similar complaint text" + (f" (shared terms: {', '.join(terms)})" if terms else ""))
        elif text >= 0.15:
            parts.append("partly similar complaint text" + (f" (shared terms: {', '.join(terms)})" if terms else ""))
        else:
            parts.append("complaint text differs")
    if cat_kind == "same":
        parts.append(f"same category ({a.category})")
    elif cat_kind == "related":
        parts.append(f"related categories ({a.category} / {b.category})")
    elif cat_kind == "different":
        parts.append(f"different categories ({a.category} / {b.category})")
    if days is not None:
        parts.append("received same day" if days < 1 else f"received {round(days)} days apart")
    return "; ".join(parts) + "."
