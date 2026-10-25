from overlap_engine.textnorm import (institution_tokens, institution_key, text_tokens,
                                     normalize_permanent_id, stem)
from overlap_engine.similarity import osa_distance, token_similarity, TfidfModel, cosine

def test_dotted_initials_merge():
    assert institution_tokens("A.B.C. College of Engineering") == ["abc", "college", "engineering"]

def test_abbreviations_and_noise():
    assert institution_key("ABC Engg. Coll.") == institution_key("ABC Engineering College")
    assert institution_key("Women's  Inst. of Tech.") == "womens institute technology"
    assert institution_key("X Pvt. Ltd. College") == "x college"

def test_unicode_and_empty():
    assert institution_tokens("Café Instítute") == ["cafe", "institute"]
    assert institution_tokens("") == [] and institution_tokens("   ...  ") == []

def test_permanent_id_normalisation():
    assert normalize_permanent_id("1-1000001") == normalize_permanent_id(" 1 1000001 ")

def test_stem_conservative():
    assert stem("salaries") == "salary" and stem("fees") == "fee" and stem("class") == "class"
    assert stem("bus") == "bus"

def test_text_tokens_synonyms():
    assert text_tokens("Teachers not receiving salary")[:2] == ["faculty", "receiv"]
    assert "salary" in text_tokens("unpaid wages")

def test_osa_known_answers():
    assert osa_distance("kitten", "sitting") == 3
    assert osa_distance("ab", "ba") == 1          # transposition
    assert osa_distance("", "abc") == 3 and osa_distance("abc", "abc") == 0
    assert osa_distance("abcdef", "uvwxyz", max_dist=2) == 3   # early exit sentinel

def test_token_similarity_policy():
    assert token_similarity("college", "colege") > 0.8
    assert token_similarity("kit", "kiit") == 0.0          # short tokens: exact only
    assert token_similarity("2019", "2018") == 0.0
    assert token_similarity("engineering", "enginering") > 0.8
    assert token_similarity("pune", "pune") == 1.0

def test_tfidf_properties():
    docs = [["salary", "faculty"], ["salary", "delay"], ["ragging", "hostel"]]
    m = TfidfModel().fit(docs)
    a, b, c = (m.vectorize(d) for d in docs)
    assert abs(cosine(a, a) - 1.0) < 1e-9
    assert cosine(a, b) == cosine(b, a) and 0 < cosine(a, b) < 1
    assert cosine(a, c) == 0.0
    assert m.vectorize([]) == {} and cosine({}, a) == 0.0
