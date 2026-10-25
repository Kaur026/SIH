import json
from pathlib import Path
import pytest
from overlap_engine import EngineConfig, OverlapEngine

DATA = Path(__file__).resolve().parent.parent / "data"

@pytest.fixture(scope="session")
def institutions():
    return json.loads((DATA / "sample_institutions.json").read_text(encoding="utf-8"))

@pytest.fixture(scope="session")
def sample_cases():
    return json.loads((DATA / "sample_cases.json").read_text(encoding="utf-8"))

@pytest.fixture()
def engine(institutions):
    return OverlapEngine(institutions)

def mk(case_id, cell, name="ABC Engineering College", **kw):
    d = {"case_id": case_id, "source_cell": cell, "institution_name": name,
         "title": kw.pop("title", "Some complaint"), "description": kw.pop("description", "details"),
         "status": kw.pop("status", "Received"), "received_at": kw.pop("received_at", "2025-01-01")}
    d.update(kw)
    return d
