"""GET /api/reference: how good the two references are on the training years, for the introduction (feature 006)."""
import numpy as np
import pandas as pd
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from api.index import app
from linreg import reference_api
from linreg.data_loading import DEFAULT_PATH
from linreg.goal import goal, meter
from linreg.methods import method_defs

client = TestClient(app)
CACHE = "public, s-maxage=3600, stale-while-revalidate=86400"


def independent(path=DEFAULT_PATH):
    """The expected figures worked out separately, straight from the file with numpy."""
    df = pd.read_csv(path, parse_dates=["match_date"])
    year = df["match_date"].dt.year
    test_year = year.max()
    validation_year = year[year < test_year].max()
    train = df[year < validation_year]
    actual = train["final_total"].to_numpy(float)
    out = {}
    for name, predicted in (("know_nothing", np.full(len(actual), actual.mean())),
                            ("broadcaster", train["runs_at_10"].to_numpy(float) / 10 * 20)):
        error = predicted - actual
        out[name] = {"n": len(actual), "average_miss": round(float(np.abs(error).mean()), 1),
                     "within_10": round(float((np.abs(error) <= 10 + 1e-9).mean() * 100), 1),
                     "within_20": round(float((np.abs(error) <= 20 + 1e-9).mean() * 100), 1),
                     "miss_percent": round(float(np.abs(error).mean() / actual.mean() * 100), 1),
                     "bias": round(float(error.mean()), 1)}
    years = sorted(int(y) for y in train["match_date"].dt.year.unique())
    return out, {"first_year": years[0], "last_year": years[-1], "innings": len(train)}


def test_the_response_has_the_goal_the_four_methods_the_training_years_and_both_references():
    body = client.get("/api/reference").json()
    assert set(body) == {"goal", "methods", "training", "figures", "gap", "finding", "words", "sentences", "meter", "message"}
    assert body["goal"] == goal()
    assert body["methods"] == method_defs()
    assert set(body["figures"]) == {"know_nothing", "broadcaster"}
    assert body["message"] is None


def test_the_figures_equal_an_independent_calculation_on_the_training_years():
    body = client.get("/api/reference").json()
    figures, training = independent()
    assert body["figures"] == figures
    assert body["training"] == training


def test_the_gap_and_the_finding_come_from_the_displayed_figures():
    body = client.get("/api/reference").json()
    kn, tv = body["figures"]["know_nothing"], body["figures"]["broadcaster"]
    gap = round(kn["average_miss"] - tv["average_miss"], 1)
    assert body["gap"]["average_miss_runs"] == gap
    assert body["gap"]["average_miss_percent"] == round(gap / kn["average_miss"] * 100, 1)
    assert body["gap"]["within_10_points"] == round(tv["within_10"] - kn["within_10"], 1)
    assert body["finding"] == "clearly_better"                      # on the real data the projection is far better than the floor


def test_the_sentences_are_plain_text_built_from_the_figures():
    s = client.get("/api/reference").json()["sentences"]
    assert set(s) == {"headline", "gap", "finding", "bias"}
    for text in s.values():
        assert text.strip() and "<" not in text and ">" not in text
    assert "bar" in s["headline"] and "clearly better" in s["finding"]
    assert "too low" in s["bias"]                                   # the projection runs low on the real data


def test_it_is_cached_like_the_data_endpoint():
    assert client.get("/api/reference").headers["cache-control"] == CACHE
    assert client.get("/api/data").headers["cache-control"] == CACHE


def test_changing_every_validation_and_test_year_value_changes_nothing_in_the_response(tmp_path):
    """SC-004: the introduction must not depend on the validation or the test year."""
    df = pd.read_csv(DEFAULT_PATH, parse_dates=["match_date"])
    year = df["match_date"].dt.year
    test_year = year.max()
    validation_year = year[year < test_year].max()
    changed = df.copy()
    later = year >= validation_year
    rng = np.random.default_rng(7)
    for column in changed.columns:
        if column in ("match_date", "match_id", "season", "competition", "venue"):
            continue
        if pd.api.types.is_numeric_dtype(changed[column]):
            changed.loc[later, column] = rng.integers(1, 250, int(later.sum()))
    path = tmp_path / "innings.csv"
    changed.to_csv(path, index=False)

    def response(csv):
        api = FastAPI()
        api.include_router(reference_api.create_router(data_path=csv), prefix="/api")
        return TestClient(api).get("/api/reference").json()

    assert response(path) == response(DEFAULT_PATH)


def test_when_the_data_cannot_be_read_the_goal_and_methods_are_still_sent(tmp_path):
    missing = tmp_path / "nope.csv"
    api = FastAPI()
    api.include_router(reference_api.create_router(data_path=missing), prefix="/api")
    r = TestClient(api).get("/api/reference")
    body = r.json()
    assert r.status_code == 200
    assert body["goal"] == goal() and body["methods"] == method_defs()
    for key in ("training", "figures", "gap", "finding", "words", "sentences", "meter"):
        assert body[key] is None
    assert "could not be loaded" in body["message"]


def test_the_result_is_worked_out_once_but_a_failure_is_tried_again(monkeypatch):
    calls = []
    real = reference_api.build_reference

    def counting(path=None):
        calls.append(1)
        return real(path)

    monkeypatch.setattr(reference_api, "build_reference", counting)
    api = FastAPI()
    api.include_router(reference_api.create_router(), prefix="/api")
    c = TestClient(api)
    c.get("/api/reference")
    c.get("/api/reference")
    assert len(calls) == 1

    broken = FastAPI()
    broken.include_router(reference_api.create_router(data_path="no-such-file.csv"), prefix="/api")
    bc = TestClient(broken)
    before = len(calls)
    bc.get("/api/reference")
    bc.get("/api/reference")
    assert len(calls) - before == 2                                   # a failure is not kept


def test_only_the_training_slice_is_used(monkeypatch):
    seen = {}
    original = reference_api.split_three_ways

    def spy(df, *a, **k):
        slices = original(df, *a, **k)
        seen["train_rows"] = len(slices.train)
        return slices

    monkeypatch.setattr(reference_api, "split_three_ways", spy)
    body = reference_api.build_reference()
    assert body["training"]["innings"] == seen["train_rows"]


def test_the_bias_words_come_from_the_wording_module_in_full_and_short_form():
    from linreg import accuracy_text
    body = client.get("/api/reference").json()
    for method, figures in body["figures"].items():
        assert body["words"][method]["bias"] == accuracy_text.bias_words(figures["bias"])
        assert body["words"][method]["bias_short"] == accuracy_text.bias_short(figures["bias"])
    assert body["words"]["broadcaster"]["bias_short"].endswith("too low")


def test_the_meter_equals_an_independent_calculation_from_the_training_years():
    body = client.get("/api/reference").json()
    figures, training = independent()
    tv, kn = figures["broadcaster"]["average_miss"], figures["know_nothing"]["average_miss"]
    m = body["meter"]
    assert {x["id"]: x["value"] for x in m["marks"]} == {"know_nothing": kn, "broadcaster": tv,
                                                          "goal": round(tv - body["goal"]["margin_runs"], 1)}
    assert m == meter(kn, tv, training)
    assert m["scale"]["min"] < min(x["value"] for x in m["marks"]) and max(x["value"] for x in m["marks"]) < m["scale"]["max"]


def test_the_lead_is_sent_even_when_the_figures_are_not(tmp_path):
    api = FastAPI()
    api.include_router(reference_api.create_router(data_path=tmp_path / "nope.csv"), prefix="/api")
    body = TestClient(api).get("/api/reference").json()
    assert body["meter"] is None
    assert body["goal"]["lead"] == goal()["lead"]
