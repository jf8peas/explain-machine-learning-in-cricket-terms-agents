"""The fixed text of the pages (feature 021, FR-006): page titles, link-preview tags and the prose of the pages may stay HTML, but
they must agree with the backend's term list. No banned name, every glossary term spelled the way the list spells it, and none of
the near-synonyms the list replaced."""
import re
from pathlib import Path

import pytest

from linreg import methods

WEB = Path(__file__).resolve().parent.parent / "web"
PAGES = {"index.html": WEB / "index.html", "under-the-hood.html": WEB / "under-the-hood.html"}

# Wordings a page might use for a glossary concept instead of the term: each is wrong wherever it is found in fixed text.
VARIANTS = ("brute force search", "bruteforce", "average total guess", "average-total-guess", "check years", "check year ",
            "candidate model", "know nothing", "test year", "the rival", "mechanical")


def visible_text(html: str) -> str:
    html = re.sub(r"<(script|style)\b.*?</\1>", " ", html, flags=re.S | re.I)
    html = re.sub(r"<!--.*?-->", " ", html, flags=re.S)
    metas = " ".join(re.findall(r'<meta [^>]*content="([^"]*)"', html))
    title = " ".join(re.findall(r"<title>(.*?)</title>", html, flags=re.S))
    labels = " ".join(re.findall(r'(?:aria-label|alt|title)="([^"]*)"', html))
    body = re.sub(r"<[^>]+>", " ", html)
    return re.sub(r"\s+", " ", f"{title} {metas} {labels} {body}")


@pytest.mark.parametrize("name", PAGES)
def test_the_fixed_text_has_no_banned_name(name):
    text = visible_text(PAGES[name].read_text(encoding="utf-8"))
    assert methods.banned_in(text) == [], name


@pytest.mark.parametrize("name", PAGES)
def test_the_fixed_text_has_none_of_the_names_the_glossary_replaced(name):
    text = visible_text(PAGES[name].read_text(encoding="utf-8")).lower()
    assert [v for v in VARIANTS if v in text] == [], name


def test_a_glossary_term_in_the_fixed_text_is_spelled_as_the_list_spells_it():
    """Case does not matter, hyphens do: "average-total guess", "brute-force search", "TV projection"."""
    for name, path in PAGES.items():
        text = visible_text(path.read_text(encoding="utf-8"))
        for t in methods.TERMS:
            loose = re.sub(r"[-\s]+", r"[-\\s]+", re.escape(t.plain).replace(r"\-", "-")).replace(r"\ ", " ")
            for found in re.findall(loose, text, flags=re.I):
                assert found.lower() == t.plain.lower(), (name, found, t.plain)


def test_the_preview_tags_name_the_agent_with_the_listed_term_and_ask_the_reader_to_choose_an_ai():
    html = PAGES["index.html"].read_text(encoding="utf-8")
    title = re.search(r'<meta property="og:title" content="([^"]*)"', html).group(1)
    assert methods.term("agent") in title
    assert "Choose an AI" in re.search(r'<meta property="og:description" content="([^"]*)"', html).group(1)       # the picker's own word
