"""GET /api/catalogue: the candidate features, with descriptions, for the page and the try-your-own form."""
from fastapi.testclient import TestClient

from api.index import app
from linreg import features

client = TestClient(app)


def get() -> dict:
    r = client.get("/api/catalogue")
    assert r.status_code == 200
    return r.json()


def test_the_response_lists_every_candidate_with_the_fields_the_page_needs():
    body = get()
    assert body["limit"] == 8
    assert [f["id"] for f in body["features"]] == features.IDS
    for f in body["features"]:
        assert set(f) == {"id", "label", "description", "unit", "bounds", "source", "inputs"}
        assert f["label"] and f["description"] and f["unit"] and "min" in f["bounds"]


def test_measured_and_derived_sources_and_inputs():
    by_id = {f["id"]: f for f in get()["features"]}
    assert by_id["runs_at_10"]["source"] == {"measured": True} and by_id["runs_at_10"]["inputs"] == ["runs_at_10"]
    assert by_id["wickets_in_hand"]["source"] == {"difference": {"from": 10, "of": "wickets_at_10"}}
    assert by_id["runs_x_wickets_in_hand"]["inputs"] == ["runs_at_10", "wickets_at_10"]
    assert by_id["is_ipl"]["source"] == {"indicator": {"column": "competition", "equals": "ipl"}}
    assert by_id["is_ipl"]["inputs"] == ["competition"]


def test_the_competition_choice_has_the_reference_first_and_display_names():
    c = get()["competition"]
    assert c["column"] == "competition" and c["reference"] == "t20i"
    assert c["options"] == [{"value": "t20i", "label": "T20 International"}, {"value": "ipl", "label": "IPL"},
                            {"value": "bbl", "label": "BBL"}]


def test_it_has_a_cache_header_and_nothing_secret():
    r = client.get("/api/catalogue")
    assert "s-maxage" in r.headers["cache-control"]
    assert "key" not in r.text.lower().replace("keys", "")  # no credential-looking fields


def test_the_setup_menus_carry_the_ids_and_labels_the_page_shows():
    from linreg import setup_settings
    body = get()
    assert body["setup_menus"] == setup_settings.public_menus()
    assert [m["id"] for m in body["setup_menus"]["window"]] == setup_settings.WINDOW_IDS
    assert all(m["label"].strip() for group in body["setup_menus"].values() for m in group)


def test_the_two_team_candidates_are_in_the_catalogue_with_their_inputs():
    by_id = {f["id"]: f for f in get()["features"]}
    assert by_id["batting_full_member"]["source"] == {"measured": True}
    assert by_id["both_full_members"]["inputs"] == ["batting_full_member", "bowling_full_member"]
