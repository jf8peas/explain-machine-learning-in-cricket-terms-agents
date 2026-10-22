"""The main page's link-preview tags (feature 020): fixed copy in the page, and the app's own address set before release."""
import re
from pathlib import Path

import pytest

WEB = Path(__file__).resolve().parent.parent / "web"
HTML = (WEB / "index.html").read_text(encoding="utf-8")
ENV = (WEB / ".env").read_text(encoding="utf-8")


def meta(attr: str, name: str) -> str:
    found = re.search(rf'<meta {attr}="{name}" content="([^"]*)"', HTML)
    assert found, f"{name} is missing"
    return found.group(1)


def test_the_tags_are_fixed_text_the_question_and_have_no_image():
    assert meta("property", "og:title") == "Can an AI agent beat the TV at predicting a T20 score?"
    assert meta("property", "og:description").startswith("Halfway through a T20 innings, where will it finish?")
    assert "Choose an AI, press play and watch it try" in meta("property", "og:description")
    assert meta("property", "og:type") == "website"
    assert meta("name", "twitter:card") == "summary"
    assert "og:image" not in HTML and "twitter:image" not in HTML
    for name in ("og:title", "og:description"):
        assert "{" not in meta("property", name) and "%" not in meta("property", name)     # no placeholder: nothing to fill in by script


def test_the_url_is_taken_from_one_setting():
    assert meta("property", "og:url") == "%VITE_APP_URL%"
    assert re.search(r"^VITE_APP_URL=https://\S+/$", ENV, re.M)


@pytest.mark.release
def test_the_apps_own_address_has_been_set():
    assert "CHANGE-ME" not in ENV, "set VITE_APP_URL in web/.env (or the Vercel project) to this app's public address"
