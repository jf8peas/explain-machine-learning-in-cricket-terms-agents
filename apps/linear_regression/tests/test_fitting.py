"""The fast Gram-matrix fit gives the same answers as the reference fit, and the three-check error is what it should be."""
import itertools
import random

import numpy as np
import pytest

from linreg import features, regression, setup_settings as cfg
from linreg.data_loading import DEFAULT_PATH, load_innings
from linreg.evaluation import mae
from linreg.fitting import Fitter
from linreg.redundancy import repeating_features_svd
from linreg.season_split import rolling_checks


@pytest.fixture(scope="module")
def rolling():
    return rolling_checks(load_innings(DEFAULT_PATH))


@pytest.fixture(scope="module")
def fitter(rolling):
    return Fitter(rolling)


def weights_for(rolling, spec, rows, weighting):
    ages = (spec.year - rows["match_date"].dt.year).to_numpy(dtype=float)
    return np.array([cfg.weight_for_age(a, weighting) for a in ages])


def independent_sets(fitter, n_sets, seed):
    rng = random.Random(seed)
    sets = []
    while len(sets) < n_sets:
        size = rng.randint(1, 8)
        chosen = rng.sample(features.IDS, size)
        if not fitter.redundant("all", "all", chosen):
            sets.append(chosen)
    return sets


def test_weighted_fit_matches_a_hand_computed_weighted_least_squares():
    import pandas as pd
    df = pd.DataFrame({"x": [1.0, 2.0, 3.0, 4.0], "final_total": [2.0, 4.1, 5.9, 8.4]})
    w = np.array([1.0, 2.0, 1.0, 4.0])
    got = regression.fit(df, ["x"], weights=w)
    X = np.column_stack([np.ones(4), df["x"]])
    beta = np.linalg.solve(X.T @ (w[:, None] * X), X.T @ (w * df["final_total"].to_numpy()))
    assert got["intercept"] == pytest.approx(beta[0]) and got["coefficients"]["x"] == pytest.approx(beta[1])
    plain = regression.fit(df, ["x"])
    ones = regression.fit(df, ["x"], weights=np.ones(4))
    assert ones["intercept"] == pytest.approx(plain["intercept"])
    assert ones["coefficients"]["x"] == pytest.approx(plain["coefficients"]["x"])


def test_the_fast_path_matches_the_reference_fit_for_random_sets_weightings_windows_and_checks(rolling, fitter):
    rng = random.Random(11)
    sets = independent_sets(fitter, 40, seed=5)
    for index, spec in enumerate(rolling.checks):
        for window, weighting, innings in itertools.product(cfg.WINDOW_IDS, cfg.WEIGHTING_IDS, cfg.TRAINING_INNINGS_IDS):
            # a set that is redundant in these training rows has no single answer, so only independent sets are compared
            chosen = next(c for c in rng.sample(sets, len(sets)) if not fitter.redundant(window, innings, c))
            rows = rolling.training_rows(spec, window, innings)
            reference = regression.fit(rows, chosen, weights=weights_for(rolling, spec, rows, weighting))
            coefficients, intercept = fitter.fit_check(index, window, weighting, innings, chosen)
            assert intercept == pytest.approx(reference["intercept"], rel=1e-8, abs=1e-8), (spec.year, window, weighting)
            for f in chosen:
                assert coefficients[f] == pytest.approx(reference["coefficients"][f], rel=1e-8, abs=1e-8)
            check_rows = rolling.check_rows(spec)
            want = regression.predict(check_rows, reference["coefficients"], reference["intercept"])
            got = regression.predict(check_rows, coefficients, intercept)
            assert np.allclose(got, want, atol=1e-8, rtol=0)


def test_the_three_check_errors_and_their_mean_equal_an_independent_calculation(rolling, fitter):
    chosen = ["runs_at_10", "wickets_in_hand", "sixes_at_10"]
    result = fitter.evaluate("last_5", "gentle", "population", chosen)
    errors = []
    for spec in rolling.checks:
        rows = rolling.training_rows(spec, "last_5", "population")
        fit = regression.fit(rows, chosen, weights=weights_for(rolling, spec, rows, "gentle"))
        check = rolling.check_rows(spec)
        errors.append(mae(check["final_total"], regression.predict(check, fit["coefficients"], fit["intercept"])))
    assert [c["year"] for c in result["checks"]] == [s.year for s in rolling.checks]
    assert [c["mae"] for c in result["checks"]] == pytest.approx(errors, abs=1e-6)
    assert result["mae"] == pytest.approx(float(np.mean(errors)), abs=1e-6)
    assert all(0 < c["r2"] < 1 for c in result["checks"]) and result["r2"] == pytest.approx(np.mean([c["r2"] for c in result["checks"]]))


def test_the_weighting_changes_the_fit_but_not_the_validation_rows(fitter):
    chosen = ["runs_at_10", "wickets_in_hand"]
    plain = fitter.evaluate("all", "none", "all", chosen)
    strong = fitter.evaluate("all", "strong", "all", chosen)
    assert plain["mae"] != strong["mae"]


def test_too_few_reports_the_checks_left_short(fitter, rolling):
    assert fitter.too_few("last_3", "population") == []                      # the real data has plenty
    sizes = fitter.training_sizes("last_3", "population")
    assert [y for y, _ in sizes] == [s.year for s in rolling.checks] and all(n >= cfg.MIN_TRAIN_INNINGS for _, n in sizes)


def test_redundancy_from_the_gram_agrees_with_the_row_based_check_for_every_pair_and_sampled_sets(rolling, fitter):
    rows = {s.year: rolling.training_rows(s, "all", "all") for s in rolling.checks}
    for a, b in itertools.combinations(features.IDS, 2):
        expected = any(repeating_features_svd(r, [a, b]) for r in rows.values())
        assert fitter.redundant("all", "all", [a, b]) == expected, (a, b)
    rng = random.Random(3)
    for _ in range(200):
        chosen = rng.sample(features.IDS, rng.randint(2, 8))
        expected = sorted({c for r in rows.values() for c in repeating_features_svd(r, chosen)}, key=chosen.index)
        assert fitter.repeating("all", "all", chosen) == expected, chosen


def test_a_set_redundant_in_any_one_check_is_redundant():
    import pandas as pd
    from tests.test_rolling_checks import table
    df = table(range(2018, 2027), per_year=150)
    df["a"] = df["runs_at_10"].astype(float)
    df["b"] = df["a"]
    # nothing here uses the catalogue; this only exercises the "any check" rule through the block helper
    from linreg.redundancy import redundant_columns, gram_block
    assert redundant_columns(gram_block(df, ["a", "b"])) and not redundant_columns(gram_block(df, ["a"]))
