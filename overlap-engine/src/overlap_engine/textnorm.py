"""Normalization & tokenization (standard library only)."""
from __future__ import annotations

import re
import unicodedata
from typing import List

_TOKEN_RE = re.compile(r"[a-z0-9]+")

# Common abbreviations seen in Indian institution names. Proposed list; extend freely.
ABBREVIATIONS = {
    "engg": "engineering", "engr": "engineering", "enggg": "engineering",
    "inst": "institute", "instt": "institute", "insti": "institute", "institution": "institute",
    "tech": "technology", "technol": "technology", "technological": "technology",
    "univ": "university", "uni": "university",
    "coll": "college", "clg": "college", "colg": "college",
    "mgmt": "management", "mgt": "management", "mgmnt": "management",
    "poly": "polytechnic", "polytechnique": "polytechnic",
    "sci": "science", "sciences": "science",
    "govt": "government", "gov": "government",
    "dept": "department", "centre": "center",
    "pvt": "", "ltd": "", "limited": "", "private": "",
}

# Dropped from institution names entirely.
INSTITUTION_STOP = {"of", "the", "and", "for", "in", "at", "a", "an", "", "to"}

# Low-information words in institution names (down-weighted, not dropped).
GENERIC_TOKENS = {
    "college", "institute", "engineering", "technology", "university", "school",
    "polytechnic", "management", "science", "academy", "campus", "education",
    "educational", "research", "studies", "training", "center", "group", "trust",
    "society", "foundation", "autonomous", "government", "technical", "pharmacy",
    "architecture", "applied", "advanced", "womens", "women", "vidyalaya",
    "vidyapeeth", "mahavidyalaya", "department", "computer", "information",
}

TEXT_STOP = frozenset("""
a about above after again against all am an and any are as at be because been before being
below between both but by can could did do does doing down during each few for from further
had has have having he her here hers him his how i if in into is it its itself just me more
most my no nor not now of off on once only or other our out over own same she should so some
such than that the their them then there these they this those through to too under until up
very was we were what when where which while who whom why will with would you your also
please kindly sir madam regarding respect respected submit request
""".split())


def _fold(text: str) -> str:
    text = unicodedata.normalize("NFKD", text or "")
    text = "".join(c for c in text if not unicodedata.combining(c))
    text = text.casefold().replace("&", " and ")
    return re.sub(r"[’'`]", "", text)          # women's -> womens


def _merge_initials(tokens: List[str]) -> List[str]:
    """['a','b','c','engineering'] -> ['abc','engineering'] (handles 'A.B.C.')."""
    out: List[str] = []
    run: List[str] = []
    for t in tokens + [""]:
        if len(t) == 1 and t.isalpha():
            run.append(t)
            continue
        if run:
            out.append("".join(run) if len(run) > 1 else run[0])
            run = []
        if t:
            out.append(t)
    return out


def institution_tokens(name: str) -> List[str]:
    """Normalized token list for an institution name / alias / reference."""
    toks = _merge_initials(_TOKEN_RE.findall(_fold(name)))
    toks = [ABBREVIATIONS.get(t, t) for t in toks]
    return [t for t in toks if t and t not in INSTITUTION_STOP]


def institution_key(name: str) -> str:
    return " ".join(institution_tokens(name))


def normalize_permanent_id(value: str) -> str:
    return re.sub(r"[^A-Z0-9]", "", (value or "").upper())


def stem(tok: str) -> str:
    """Tiny suffix stripper; deliberately conservative (no external NLP deps)."""
    n = len(tok)
    if n <= 3 or tok.isdigit():
        return tok
    if tok.endswith("ies") and n > 4:
        return tok[:-3] + "y"
    if tok.endswith("sses"):
        return tok[:-2]
    if tok.endswith(("xes", "ches", "shes", "zes")) and n > 5:
        return tok[:-2]
    if tok.endswith("ing") and n > 5:
        return tok[:-3]
    if tok.endswith("ed") and n > 4:
        return tok[:-2]
    if tok.endswith("s") and not tok.endswith(("ss", "us", "is")) and n > 3:
        return tok[:-1]
    return tok


# Small domain thesaurus so paraphrases share vocabulary (rule-based, PROPOSED --
# extend from real complaint text). Keys/values are post-stem forms.
_SYN_GROUPS = {
    "faculty": "faculty teacher lecturer professor staff instructor",
    "salary": "salary wage pay payment remuneration dues stipend",
    "approval": "approval permission sanction recognition unapproved unrecognised unrecognized",
    "certificate": "certificate degree marksheet diploma",
    "admission": "admission enrolment enrollment enrolled admit admitted",
    "fee": "fee charge overcharge overcharged tuition",
    "refund": "refund reimbursement",
    "laboratory": "laboratory lab equipment",
    "ragging": "ragging bully bullying harassment",
}
SYNONYMS = {stem(w): canon for canon, words in _SYN_GROUPS.items() for w in words.split()}
SYNONYMS.update({w: canon for canon, words in _SYN_GROUPS.items() for w in words.split()})


def text_tokens(text: str) -> List[str]:
    """Stop-word-filtered, stemmed, synonym-folded tokens for complaint text."""
    out = []
    for t in _TOKEN_RE.findall(_fold(text)):
        if len(t) > 1 and t not in TEXT_STOP:
            st = stem(t)
            out.append(SYNONYMS.get(t) or SYNONYMS.get(st) or st)
    return out
