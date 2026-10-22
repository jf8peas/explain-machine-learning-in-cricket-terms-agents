"""The glossary (feature 021): one plain term per concept, defined once in methods.py and sent with /api/reference."""
import re

from fastapi.testclient import TestClient

from api.index import app
from linreg import methods
from linreg.methods import BANNED, TERMS, definitions, terms_payload

IDS = ["agent", "brute_force", "tv", "average_total", "idea", "clues", "settings", "check_seasons", "test_season", "pick"]


def test_there_are_ten_terms_in_a_stable_order():
    assert [t.id for t in sorted(TERMS, key=lambda t: t.order)] == IDS
    assert [t["id"] for t in terms_payload()] == IDS
    assert [t.order for t in TERMS] == sorted(t.order for t in TERMS)


def test_plain_terms_are_unique_and_the_helpers_read_them():
    plain = [t.plain for t in TERMS]
    assert len(set(plain)) == len(plain)
    assert methods.term("brute_force") == "brute-force search"
    assert methods.with_technical("brute_force") == "brute-force search (grid search with forward selection)"
    assert methods.with_technical("agent") == "AI agent (language-model agent)"


def test_no_plain_term_alt_or_meaning_uses_a_banned_word():
    for t in TERMS:
        for text in (t.plain, t.alt_plain or "", t.meaning):
            assert methods.banned_in(text) == [], (t.id, text)


def test_a_technical_term_may_use_forward_selection_and_nothing_else_banned():
    for t in TERMS:
        left = methods.banned_in(t.technical, ("commentary",))
        assert left == [], (t.id, left)


def test_meanings_are_one_short_line():
    for t in TERMS:
        assert len(t.meaning.split()) <= 18 and "\n" not in t.meaning


def test_the_definition_numbers_are_worked_out_not_typed():
    d = definitions()
    assert "24 combinations" in d["brute_force_technical"]
    assert "2^19, about 524,000" in d["brute_force_honest"]
    assert d["brute_force"].startswith("The brute-force search is plain code, no AI: it tries every combination of settings and, "
                                       "inside each, adds clues one at a time, keeping whichever cuts the miss most. It is the "
                                       "yardstick: if the agent can't match it, its reasoning isn't adding anything.")


def test_the_banned_patterns_are_valid_and_forward_selection_is_the_only_one_with_a_region():
    for b in BANNED:
        re.compile(b.pattern)
    assert {b.pattern: b.allowed_in for b in BANNED if b.allowed_in} == {"forward selection": ("commentary", "scorebook", "definition")}
    assert methods.has_banned("The rival won") and not methods.has_banned("The brute-force search won")


def test_the_method_names_come_from_the_terms():
    names = {m["id"]: m["name"] for m in methods.method_defs()}
    assert names == {"know_nothing": "the average-total guess", "broadcaster": "the broadcaster's projection",
                     "llm": "the AI agent's model", "forward": "the brute-force search's model"}


def test_the_reference_response_sends_the_glossary():
    body = TestClient(app).get("/api/reference").json()
    assert [t["id"] for t in body["terms"]] == IDS
    assert set(body["definitions"]) == {"brute_force", "brute_force_technical", "brute_force_honest", "projected_score"}
    assert body["terms_version"] == methods.terms_version()
    assert {b["pattern"] for b in body["banned"]} == {b.pattern for b in BANNED}


def test_the_pages_unit_test_glossary_is_the_backends_payload():
    import json
    from pathlib import Path
    fixture = Path(__file__).resolve().parent.parent / "web" / "tests" / "fixtures" / "terms.json"
    assert json.loads(fixture.read_text(encoding="utf-8")) == methods.reference_terms(), (
        "web/tests/fixtures/terms.json is out of step: regenerate it from linreg.methods.reference_terms()")


def test_the_broadcaster_has_a_long_form_a_short_form_and_a_short_possessive():
    """Feature 023: sentences take the form they need from the list and never append "'s" themselves."""
    tv = methods.TERM_BY_ID["tv"]
    assert (tv.plain, tv.short, tv.short_possessive, tv.technical) == (
        "broadcaster's projection", "the broadcaster", "the broadcaster's", "run rate × 20 overs")
    assert methods.term("tv") == "broadcaster's projection" and methods.short("tv") == "the broadcaster"
    assert methods.short_possessive("tv") == "the broadcaster's" and methods.bare(methods.short("tv")) == "broadcaster"
    for t in methods.TERMS:
        if t.id != "tv":
            assert t.short is None and t.short_possessive is None
            assert methods.short(t.id) == t.plain and methods.short_possessive(t.id) == t.plain       # a missing form falls back


def test_the_projected_score_phrase_for_the_question_comes_from_the_server():
    assert methods.definitions()["projected_score"] == "the broadcaster's projected score"
