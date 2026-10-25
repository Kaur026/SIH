import json
import pytest
from overlap_engine import CategoryTagger, summarize
from overlap_engine.cli import main
from overlap_engine.tagging import UNCATEGORIZED

@pytest.fixture(scope="module")
def tagger(): return CategoryTagger()

@pytest.mark.parametrize("title,desc,cat", [
    ("Salary not paid", "Teachers have not received salary for months", "Faculty & Staff Grievance"),
    ("Refund denied", "College refuses to refund the fee after withdrawal", "Fee Irregularity"),
    ("Running course without approval", "The intake is above approved intake and norms are violated", "Approval / Norms Violation"),
    ("Ragging", "Senior students ragging juniors in hostel", "Harassment & Safety"),
    ("Certificate withheld", "Degree certificate and marks withheld", "Academic & Examination"),
])
def test_tagger_known_answers(tagger, title, desc, cat):
    t = tagger.tag(title, desc)
    assert t.category == cat and t.matched_terms and 0 < t.confidence <= 1

def test_tagger_uncategorized_and_empty(tagger):
    assert tagger.tag("hello world", "nothing relevant here").category == UNCATEGORIZED
    assert tagger.tag("", "").category == UNCATEGORIZED

def test_tagger_custom_taxonomy():
    t = CategoryTagger({"Parking": {"parking": 1.0, "car park": 2.0}}).tag("Car park full", "")
    assert t.category == "Parking"

def test_summary_behaviour():
    long = ("The faculty has not been paid for six months. The management keeps promising payment. "
            "Meanwhile the canteen menu changed twice. Faculty salary delay is affecting classes. Please act.")
    s = summarize(long)
    assert s.count(".") <= 2                      # at most two sentences
    assert "paid" in s.lower() or "salary" in s.lower()
    assert "canteen" not in s.lower()             # off-topic sentence dropped
    assert len(s) <= 2 * 161 + 1
    assert summarize("") == "" and summarize("One short sentence.") == "One short sentence."
    assert summarize(long) == summarize(long)                    # deterministic
    assert summarize("word " * 200).endswith("…") and len(summarize("word " * 200)) <= 161

def test_cli_detect_and_errors(tmp_path, capsys):
    out = tmp_path / "o.json"
    rc = main(["detect", "--institutions", "data/sample_institutions.json", "--cases", "data/sample_cases.json", "--out", str(out)])
    assert rc == 0 and len(json.loads(out.read_text())["alerts"]) == 5
    assert main(["detect", "--institutions", "nope.json", "--cases", "x.json"]) == 2
    cfg = tmp_path / "c.json"; cfg.write_text('{"bogus": 1}')
    assert main(["detect", "--institutions", "data/sample_institutions.json", "--cases", "data/sample_cases.json", "--config", str(cfg)]) == 2
