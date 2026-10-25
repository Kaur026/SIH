# Input / Output Contract (v0.1 — proposed, to be confirmed with the backend owner)

The prototype's real field names are not in the project documents, so `Case.from_dict`
accepts several aliases (see `models.py::_CASE_ALIASES`). Teammates only need to map their
rows to this shape; the engine never touches the database or network.

## Institution (registry)
| field | required | notes |
|---|---|---|
| institution_id | yes | unique |
| name | yes | official name |
| aicte_permanent_id | no | unique if present |
| aliases | no | list of short names / variants (the team plan says the institutions table has alias names) |
| state, city | no | used only to disambiguate identical/similar names |

## Case
| field | required | notes |
|---|---|---|
| case_id | yes | unique (aliases: id, complaint_number, complaint_id) |
| source_cell | yes | Bureau/Cell *currently* handling it, e.g. "RB", "PGRC" (aliases: cell, bureau, department_code) |
| institution_id / aicte_permanent_id / institution_name / institution_state | one of the first three recommended | resolution order: id → permanent id → name |
| title, description | no | text signal |
| category | no | text label (comes from the data or from `CategoryTagger`) |
| status | no | default "Received"; terminal = resolved/closed/disposed (configurable) |
| received_at | no | ISO-8601 |
| linked_case_ids | no | cases already linked (e.g. RB case's linked PGRC id) |

## Calls
```python
engine = OverlapEngine(institutions, EngineConfig())
result = engine.detect(cases, linked_pairs=[...], dismissed_pairs=[...])      # batch
result = engine.detect_for_case(new_case, existing_cases)                       # on case create/update
result.to_dict()   # JSON-safe
```

## Output (`result.to_dict()`)
* `alerts[]`: `alert_id` (deterministic, safe for upsert), `headline`, `case_a_id`, `case_b_id`, `cell_a`, `cell_b`,
  `institution_id`, `institution_name`, `confidence` (0–1), `confidence_pct`, `tier` (HIGH/MEDIUM/LOW),
  `reason` (one line), `signals{institution_confidence, text_similarity, category_match, days_apart, shared_terms, explicitly_linked}`
* `suppressed[]`: pairs not alerted, with reason (`already_linked`, `dismissed_by_officer`, `closed_case`, `outside_time_window`, `below_min_confidence`)
* `unresolved[]`: cases whose institution could not be resolved safely (`AMBIGUOUS`/`UNRESOLVED`) + candidates → manual review queue
* `errors[]`: malformed / duplicate input rows (never raises on bad rows)
* `warnings[]`, `stats{}` (counts, tier histogram, resolve_ms, scoring_ms)

Case A is the earlier-received case. The team plan's handoff format
(case A, case B, institution, confidence %, reason line) maps to
`case_a_id, case_b_id, institution_name, confidence_pct, reason`.
