# Overlap Engine — SIH 26264 (AICTE integrated complaint dashboard)

Standalone, standard-library-only Python engine that (1) resolves messy institution references to a
registry, (2) detects **potential overlapping cases handled by different Bureaus/Cells** for the same
institution, with suppression rules, a confidence score and a one-line "why flagged", and (3) optionally
auto-tags categories and writes a 2-line summary. No database, network, UI or auth code. **Status: standalone
engine only — it has NOT been integrated into the team prototype.**

## Run
```bash
python -m venv .venv && source .venv/bin/activate
pip install -e ".[dev]"            # no runtime dependencies; dev = pytest
pytest -q                          # 109 tests
python -m overlap_engine detect --institutions data/sample_institutions.json --cases data/sample_cases.json
python -m overlap_engine resolve --institutions data/sample_institutions.json --name "ABC Engg Collage"
python -m overlap_engine tag --cases data/sample_cases.json
python benchmarks/eval_resolver.py 2000 ; python benchmarks/bench.py
```
Python ≥ 3.10 (developed/tested on 3.12). Sample data is **entirely fictional**.

## What "overlap" means here (from the problem statement)
Two cases are a *potential overlap* when they concern the **same institution** and are handled by
**different Bureaus/Cells**, even if descriptions/IDs differ. Text/category/time similarity only raises or
lowers *confidence*; it is not required to raise an alert.

## Pipeline
1. **Ingest/validate** — bad rows go to `errors`, never crash the batch.
2. **Institution resolution** (`resolver.py`) — institution_id → AICTE Permanent ID → exact name/alias → acronym → fuzzy.
   Fuzzy = IDF-weighted token alignment with typo tolerance (OSA edit distance; tokens < 5 chars must match exactly so
   KIT ≠ KIIT), inverted-index + trigram blocking, generic words ("College") down-weighted, query words *absent* from the
   registry name count against the match, state/city disambiguation. Resolves only if score ≥ 0.85 **and** leads the
   runner-up by ≥ 0.05; otherwise the case goes to `unresolved` for review. Never guesses between close candidates.
3. **Blocking** — group by resolved institution, bucket by cell, evaluate cross-cell pairs only.
4. **Suppression** — same cell, already linked (case field or `linked_pairs`), officer-dismissed, either case closed/resolved/disposed,
   optional time window, below min confidence. Suppressed pairs are returned with reasons (auditable).
5. **Confidence** — `inst_conf × Σ wᵢsᵢ / Σ wᵢ` over *available* signals: base (same institution, different cell) 0.40,
   TF-IDF cosine of text 0.30 (with a small domain synonym table), category 0.20, recency 0.10. Tiers: HIGH ≥ 0.70, MEDIUM ≥ 0.50, LOW ≥ 0.30.
6. **Explanation** — single sentence naming institution match method, text/category/time evidence.

## Assumptions (all configurable in `EngineConfig`; NOT derived from AICTE data)
Weights, thresholds, terminal statuses, taxonomy (`data/taxonomy.json`), synonym list, abbreviation list, `include_same_cell=False`,
`explicit_link_policy="suppress"`. English text only. These need calibration on real/approved data.

## Measured results (synthetic data, single run on one machine — not published benchmarks)
* **Tests**: 109 pass (unit, known-answer on planted pairs, malformed input, determinism, incremental==batch, and a
  differential test vs a brute-force all-pairs oracle over 25 random datasets). The oracle shares the resolver and TF-IDF primitives,
  so it validates pairing/suppression/blocking logic and the score formula, not the resolver itself.
* **Resolver** (2,000 synthetic institutions, 24,000 reference variants): 98.87% correct, 0.00% wrong-resolved, 1.13% routed to review.
  Weak spot: **7/500 unknown institutions (1.4%) were wrongly matched to a near-twin registry name** (one-letter differences or
  "Engineering College" vs "College of Engineering and Technology"). Permanent IDs / state / officer review are the mitigation.
* **Scaling** (`benchmarks/bench_output.txt`): 20k cases/5k institutions — total 9.1 s, of which pairing+scoring 1.26 s versus 24.5 s for an
  unblocked all-pairs id check (200M pairs, no scoring). 50k cases: 33.7 s, ~89% of it institution resolution on mostly-unique
  synthetic strings (real data with repeated names benefits from the cache). Peak ≈ 77 MB at 20k. Incremental `detect_for_case` vs 20k existing: ~0.8 s.
* Synthetic data was written by the same author as the engine; real-world accuracy is **unverified**.

## Known limitations
Lexical similarity (no embeddings): paraphrases beyond the synonym table score low. Short single-token references that are not
registered aliases or acronyms may fall to review. Pairwise alerts only (no cluster view). Hindi/other languages unsupported.
`detect_for_case` refits IDF on the cases passed in. Category taxonomy is proposed, not AICTE-confirmed.

## Open decisions for the team (defaults chosen, change via config)
1. Does an RB case's imported "linked PGRC complaint ID" mean *already coordinated* (suppress — default) or *confirmed overlap* (`boost`)?
2. Exact field names / status vocabulary of the prototype (adapter aliases in `models.py` are guesses).
3. Official AICTE category list, and whether tagging output should overwrite the case `category`.
4. Should LOW alerts (same institution, different cells, unrelated issues) be shown or hidden? (`min_confidence`)
5. Are Regional Offices separate "cells" for overlap purposes? (currently yes)

See `docs/CONTRACT.md` for the exact I/O contract.
