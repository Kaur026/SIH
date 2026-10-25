import pytest
from overlap_engine import InstitutionResolver, RESOLVED, AMBIGUOUS, UNRESOLVED, EngineConfig

@pytest.fixture()
def rs(institutions):
    return InstitutionResolver(institutions)

def test_institution_id_and_permanent_id(rs):
    r = rs.resolve(institution_id="INST-004")
    assert (r.status, r.institution_id, r.confidence, r.method) == (RESOLVED, "INST-004", 1.0, "institution_id")
    r = rs.resolve(permanent_id="1 - 1000001")
    assert r.institution_id == "INST-001" and r.method == "aicte_permanent_id"

def test_permanent_id_conflicting_name_warns_but_trusts_id(rs):
    r = rs.resolve(permanent_id="1-1000001", name="Greenfield Polytechnic")
    assert r.institution_id == "INST-001" and "name_conflicts_with_permanent_id" in r.warnings

def test_unknown_ids_fall_back_to_name(rs):
    r = rs.resolve(institution_id="NOPE", permanent_id="9-9", name="Greenfield Polytechnic")
    assert r.institution_id == "INST-007"
    assert {"unknown_institution_id", "unknown_permanent_id"} <= set(r.warnings)

@pytest.mark.parametrize("name,expected", [
    ("ABC", "INST-001"), ("abc engg college", "INST-001"), ("A.B.C. College of Engineering", "INST-001"),
    ("ABC Engineering Colege", "INST-001"), ("ABC Enginering College", "INST-001"),
    ("ABC College", "INST-001"), ("NIAS", "INST-008"), ("RKMIT", "INST-004"),
    ("Dr R K Mehta Inst of Tech", "INST-004"), ("KIT", "INST-005"), ("KIIT", "INST-006"),
    ("Kiran Institute of Information Technology", "INST-006"),
    ("Greenfield Poly", "INST-007"), ("Greenfeild Polytechnic", "INST-007"),
])
def test_name_variants_resolve(rs, name, expected):
    r = rs.resolve(name=name)
    assert r.status == RESOLVED and r.institution_id == expected, r

def test_kit_and_kiit_never_confused(rs):
    assert rs.resolve(name="KIT").institution_id != rs.resolve(name="KIIT").institution_id

def test_shared_name_is_ambiguous_without_state(rs):
    r = rs.resolve(name="Sunrise Institute of Technology")
    assert r.status == AMBIGUOUS and {c[0] for c in r.candidates} == {"INST-002", "INST-003"}

def test_shared_name_resolved_by_state(rs):
    r = rs.resolve(name="Sunrise Institute of Technology", state="Madhya Pradesh")
    assert r.status == RESOLVED and r.institution_id == "INST-003"

def test_city_in_name_disambiguates(rs):
    assert rs.resolve(name="Sunrise Institute of Technology, Nashik").institution_id == "INST-002"
    assert rs.resolve(name="SIT Indore").institution_id == "INST-003"

def test_ambiguous_acronym(rs):
    assert rs.resolve(name="SIT").status == AMBIGUOUS

@pytest.mark.parametrize("name", [None, "", "   ", "!!!", "Unknown Vidyalaya of Learning", "Zzyzx Academy"])
def test_unresolvable(rs, name):
    r = rs.resolve(name=name)
    assert r.status == UNRESOLVED and r.institution_id is None

def test_different_institution_with_shared_generic_words_not_merged(rs):
    # shares only generic words ("Institute", "Technology") with several registry entries
    assert rs.resolve(name="Himalaya Institute of Technology").status != RESOLVED

def test_duplicate_registry_ids_rejected(institutions):
    with pytest.raises(ValueError):
        InstitutionResolver(institutions + [dict(institutions[0], aicte_permanent_id="X-1")])
    dup = dict(institutions[1], institution_id="INST-099")
    with pytest.raises(ValueError):
        InstitutionResolver(institutions + [dup])   # duplicate permanent id

def test_resolution_is_cached_and_deterministic(rs):
    a = rs.resolve(name="ABC Engg Collage"); b = rs.resolve(name="ABC Engg Collage")
    assert a is b
