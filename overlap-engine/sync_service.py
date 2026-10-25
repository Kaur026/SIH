#!/usr/bin/env python3
"""AICTE Overlap Engine - Supabase Integration Service.

Connects to the AICTE Supabase PostgreSQL repository, fetches active complaints
and technical institutions, executes the OverlapEngine pipeline, and outputs
cross-bureau overlap alerts.
"""

from __future__ import annotations

import json
import os
import sys
import urllib.request
from pathlib import Path

# Add src to sys.path so overlap_engine is importable
ENGINE_SRC = Path(__file__).resolve().parent / "src"
if str(ENGINE_SRC) not in sys.path:
    sys.path.insert(0, str(ENGINE_SRC))

from overlap_engine.detector import OverlapEngine
from overlap_engine.models import Case, Institution

# Default to project .env credentials or fallback
SUPABASE_URL = os.environ.get("VITE_SUPABASE_URL", "https://nqkbmtonueeajpbrkpji.supabase.co")
SUPABASE_KEY = os.environ.get(
    "VITE_SUPABASE_PUBLISHABLE_KEY",
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5xa2JtdG9udWVlYWpwYnJrcGppIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI3NjI1NjgsImV4cCI6MjEwODMzODU2OH0.QBaDl3ZMfYx_eQXTMeDukLyJMd1MB_u583UuZ8Zg7Q0",
)


def fetch_from_supabase(endpoint: str) -> list[dict]:
    url = f"{SUPABASE_URL.rstrip('/')}/rest/v1/{endpoint}"
    req = urllib.request.Request(
        url,
        headers={
            "apikey": SUPABASE_KEY,
            "Authorization": f"Bearer {SUPABASE_KEY}",
            "Content-Type": "application/json",
        },
    )
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read().decode())


def run_overlap_sync() -> dict:
    print(f"Connecting to AICTE Supabase at {SUPABASE_URL}...")
    
    # 1. Fetch institutions & complaints
    raw_institutions = fetch_from_supabase("institutions")
    raw_complaints = fetch_from_supabase(
        "complaints?select=*,department:departments(*),institution:institutions(*)"
    )

    print(f"Fetched {len(raw_institutions)} institutions and {len(raw_complaints)} complaints.")

    # 2. Build domain model objects
    institutions = [
        Institution.from_dict({
            "institution_id": i["id"],
            "name": i["institution_name"],
            "aicte_permanent_id": i.get("aicte_permanent_id"),
            "state": i.get("state"),
            "city": i.get("district"),
        })
        for i in raw_institutions
    ]

    cases = [
        Case.from_dict({
            "case_id": c["complaint_number"],
            "source_cell": c["department"]["code"] if c.get("department") else "PGRC",
            "institution_id": c.get("institution_id"),
            "institution_name": c["institution"]["institution_name"] if c.get("institution") else None,
            "title": c.get("title", ""),
            "description": c.get("description", ""),
            "category": c.get("category"),
            "status": c.get("status", "Received"),
            "received_at": c.get("received_at"),
        })
        for c in raw_complaints
    ]

    # 3. Execute OverlapEngine
    engine = OverlapEngine(institutions)
    result = engine.detect(cases)
    output = result.to_dict()

    print(f"\nExecution Complete: Found {len(result.alerts)} potential cross-bureau overlap alert(s)!")
    for a in result.alerts:
        print(f"  • [{a.tier} - {a.confidence_pct}%] {a.case_a_id} ({a.cell_a}) <-> {a.case_b_id} ({a.cell_b})")
        print(f"    Institution: {a.institution_name}")
        print(f"    Reason: {a.reason}\n")

    return output


if __name__ == "__main__":
    res = run_overlap_sync()
    output_path = Path(__file__).resolve().parent / "latest_alerts.json"
    with open(output_path, "w") as f:
        json.dump(res, f, indent=2)
    print(f"Saved latest alert payload to {output_path}")
