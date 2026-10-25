"""Input / output data contracts (plain dataclasses, no I/O)."""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date, datetime, timezone
from typing import Any, Iterable, Mapping, Optional

HEADLINE = "Potential Overlapping Cases – Coordination Required"


def parse_datetime(value: Any) -> Optional[datetime]:
    """Parse datetime/date/ISO-8601 string -> tz-aware datetime (naive => UTC)."""
    if value is None or value == "":
        return None
    if isinstance(value, datetime):
        dt = value
    elif isinstance(value, date):
        dt = datetime(value.year, value.month, value.day)
    elif isinstance(value, str):
        s = value.strip()
        if s.endswith(("Z", "z")):
            s = s[:-1] + "+00:00"
        try:
            dt = datetime.fromisoformat(s)
        except ValueError as exc:
            raise ValueError(f"unparseable date {value!r}") from exc
    else:
        raise ValueError(f"unsupported date type {type(value).__name__}")
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


def _s(value: Any) -> Optional[str]:
    if value is None:
        return None
    text = str(value).strip()
    return text or None


# Accepted alternative key names when building objects from dicts. These are
# ADAPTER ASSUMPTIONS (the prototype's real field names are not documented).
_CASE_ALIASES = {
    "case_id": ("case_id", "id", "complaint_number", "complaint_id"),
    "source_cell": ("source_cell", "cell", "bureau", "department", "department_code", "assigned_department"),
    "institution_id": ("institution_id",),
    "aicte_permanent_id": ("aicte_permanent_id", "permanent_id", "aicte_id"),
    "institution_name": ("institution_name", "institution"),
    "institution_state": ("institution_state", "state"),
    "title": ("title", "subject"),
    "description": ("description", "details", "text"),
    "category": ("category", "nature"),
    "status": ("status",),
    "received_at": ("received_at", "date_of_receipt", "received_date"),
    "linked_case_ids": ("linked_case_ids", "linked_cases"),
}


def _pick(d: Mapping[str, Any], key: str) -> Any:
    for name in _CASE_ALIASES[key]:
        if name in d and d[name] is not None:
            return d[name]
    return None


@dataclass(frozen=True)
class Institution:
    institution_id: str
    name: str
    aicte_permanent_id: Optional[str] = None
    aliases: tuple = ()
    state: Optional[str] = None
    city: Optional[str] = None

    @classmethod
    def from_dict(cls, d: Mapping[str, Any]) -> "Institution":
        iid = _s(d.get("institution_id") or d.get("id"))
        name = _s(d.get("name") or d.get("institution_name"))
        if not iid or not name:
            raise ValueError("institution requires 'institution_id' and 'name'")
        aliases = d.get("aliases") or ()
        if isinstance(aliases, str):
            aliases = [a for a in aliases.split(";") if a.strip()]
        return cls(iid, name, _s(d.get("aicte_permanent_id")),
                   tuple(str(a).strip() for a in aliases if str(a).strip()),
                   _s(d.get("state")), _s(d.get("city")))


@dataclass(frozen=True)
class Case:
    case_id: str
    source_cell: str
    institution_id: Optional[str] = None
    aicte_permanent_id: Optional[str] = None
    institution_name: Optional[str] = None
    institution_state: Optional[str] = None
    title: str = ""
    description: str = ""
    category: Optional[str] = None
    status: str = "Received"
    received_at: Optional[datetime] = None
    linked_case_ids: tuple = ()

    @classmethod
    def from_dict(cls, d: Mapping[str, Any]) -> "Case":
        cid, cell = _s(_pick(d, "case_id")), _s(_pick(d, "source_cell"))
        if not cid:
            raise ValueError("case requires 'case_id'")
        if not cell:
            raise ValueError("case requires 'source_cell' (the Bureau/Cell handling it)")
        links = _pick(d, "linked_case_ids") or ()
        if isinstance(links, str):
            links = links.replace(";", ",").split(",")
        return cls(
            case_id=cid, source_cell=cell,
            institution_id=_s(_pick(d, "institution_id")),
            aicte_permanent_id=_s(_pick(d, "aicte_permanent_id")),
            institution_name=_s(_pick(d, "institution_name")),
            institution_state=_s(_pick(d, "institution_state")),
            title=_s(_pick(d, "title")) or "",
            description=_s(_pick(d, "description")) or "",
            category=_s(_pick(d, "category")),
            status=_s(_pick(d, "status")) or "Received",
            received_at=parse_datetime(_pick(d, "received_at")),
            linked_case_ids=tuple(x.strip() for x in map(str, links) if x.strip()),
        )


@dataclass
class OverlapAlert:
    alert_id: str
    case_a_id: str
    case_b_id: str
    cell_a: str
    cell_b: str
    institution_id: str
    institution_name: str
    confidence: float            # 0..1
    tier: str                    # HIGH | MEDIUM | LOW
    reason: str                  # single "why flagged" line
    signals: dict = field(default_factory=dict)
    headline: str = HEADLINE

    @property
    def confidence_pct(self) -> int:
        return int(round(self.confidence * 100))

    def to_dict(self) -> dict:
        return {
            "alert_id": self.alert_id,
            "headline": self.headline,
            "case_a_id": self.case_a_id, "case_b_id": self.case_b_id,
            "cell_a": self.cell_a, "cell_b": self.cell_b,
            "institution_id": self.institution_id,
            "institution_name": self.institution_name,
            "confidence": round(self.confidence, 4),
            "confidence_pct": self.confidence_pct,
            "tier": self.tier,
            "reason": self.reason,
            "signals": self.signals,
        }


@dataclass
class DetectionResult:
    alerts: list = field(default_factory=list)
    suppressed: list = field(default_factory=list)
    unresolved: list = field(default_factory=list)
    errors: list = field(default_factory=list)
    warnings: list = field(default_factory=list)
    stats: dict = field(default_factory=dict)

    def to_dict(self) -> dict:
        return {
            "alerts": [a.to_dict() for a in self.alerts],
            "suppressed": self.suppressed,
            "unresolved": self.unresolved,
            "errors": self.errors,
            "warnings": self.warnings,
            "stats": self.stats,
        }


def as_institutions(items: Iterable[Any]) -> list:
    return [i if isinstance(i, Institution) else Institution.from_dict(i) for i in items]
