"""Feature 023 changes words only: the identifiers that carry "tv" keep their names (term id `tv`, method id `broadcaster`, fact
names, reference keys, the page's test ids and CSS classes)."""
from pathlib import Path

from linreg import hero_text, methods
from tests.test_explanation_numbers import facts_for, state_for

WEB = Path(__file__).resolve().parent.parent / "web" / "src" / "page"

FACT_IDS = ("tv_gap", "tv_test_miss", "tv_bias_runs", "tv_bias_direction", "tv_bias_large")
PAGE_NAMES = ("tv-miss", "tv-said", "tv-sentence", "tv-footnote", "tryit-tv", "tv-figure", "tv-figures")


def test_the_term_and_method_ids_are_unchanged():
    assert "tv" in methods.TERM_BY_ID and methods.TERM_BY_ID["tv"].plain == "broadcaster's projection"
    assert "broadcaster" in methods.BY_ID


def test_the_fact_ids_are_unchanged():
    ids = set(facts_for(state_for(tv=21.0, know_nothing=34.0, tv_bias=-12.0)))
    assert set(FACT_IDS) <= ids


def test_the_goal_card_and_reference_keys_are_unchanged():
    card = hero_text.goal_card(3, 22.5, {"first_year": 2005, "last_year": 2022}, {"year": 2026, "innings": 171})
    assert "tv" in card


def test_the_pages_test_ids_and_classes_are_unchanged():
    source = " ".join(path.read_text(encoding="utf-8") for path in WEB.glob("*.ts"))
    for name in PAGE_NAMES:
        assert name in source, name
