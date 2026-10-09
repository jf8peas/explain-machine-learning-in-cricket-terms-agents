"""The rival is a complete, visible grid search: forward selection inside every combination of training innings, window and
weighting, all judged on the same three rolling checks (feature 008)."""
import itertools
import os
import time

import pytest

from linreg import features, selection
from linreg import setup_settings as cfg
from linreg.data_loading import DEFAULT_PATH, load_innings
from linreg.fitting import Fitter
from linreg.llm_fake import FakeLlm, reply
from linreg.season_split import rolling_checks
from linreg.state import SET_LIMIT
from tests.conftest import make_table, merged_state, nodes_of

ORDER = [(i, w, g) for i, w, g in itertools.product(cfg.TRAINING_INNINGS_IDS, cfg.WINDOW_IDS, cfg.WEIGHTING_IDS)]


@pytest.fixture(scope="module")
def rolling():
    return rolling_checks(load_innings(DEFAULT_PATH))


@pytest.fixture(scope="module")
def result(rolling):
    return selection.grid_search(Fitter(rolling))


def test_the_grid_is_the_documented_24_combinations_in_a_fixed_order():
    assert selection.GRID == ORDER and len(ORDER) == 24
    assert ORDER[0] == ("population", "all", "none") and ORDER[-1] == ("all", "last_3", "strong")


def test_every_combination_is_considered_once_in_that_order_on_the_committed_data(result):
    cells = result["cells"]
    assert [(c["training_innings"], c["window"], c["weighting"]) for c in cells] == ORDER
    assert all(c["allowed"] for c in cells)
    for c in cells:
        assert 1 <= len(c["features"]) <= SET_LIMIT and len(set(c["features"])) == len(c["features"])
        assert [k["year"] for k in c["checks"]] == [k["year"] for k in result["best"]["checks"]]
        assert c["validation_mae"] == pytest.approx(sum(k["mae"] for k in c["checks"]) / 3, abs=0.0105)


def test_the_same_grid_comes_out_every_time(rolling, result):
    again = selection.grid_search(Fitter(rolling))
    assert again == result


def independent_forward(fitter, window, weighting, innings):
    """Greedy forward selection written separately, straight from Fitter.evaluate."""
    current, previous = [], None
    while len(current) < SET_LIMIT:
        best = None
        for f in features.IDS:
            if f in current or fitter.redundant(window, innings, current + [f]):
                continue
            mae = fitter.evaluate(window, weighting, innings, current + [f])["mae"]
            if best is None or mae < best[1]:
                best = (f, mae)
        if best is None or (previous is not None and round(best[1], 2) >= previous):
            break
        current, previous = current + [best[0]], round(best[1], 2)
    return current, previous


@pytest.mark.parametrize("combo", [("population", "all", "none"), ("population", "last_5", "gentle"), ("all", "last_3", "strong")])
def test_forward_selection_inside_a_combination_matches_an_independent_run(rolling, result, combo):
    fitter = Fitter(rolling)
    cell = next(c for c in result["cells"] if (c["training_innings"], c["window"], c["weighting"]) == combo)
    chosen, error = independent_forward(fitter, combo[1], combo[2], combo[0])
    assert cell["features"] == chosen and cell["validation_mae"] == error


def test_a_set_that_is_redundant_in_any_check_is_never_built(rolling, result):
    fitter = Fitter(rolling)
    for c in result["cells"]:
        assert not fitter.redundant(c["window"], c["training_innings"], c["features"])


def test_the_best_cell_has_the_lowest_displayed_error_and_the_winning_cells_build_up_is_shown(result):
    best = result["best"]
    assert best["validation_mae"] == min(c["validation_mae"] for c in result["cells"] if c["allowed"])
    first = next(c for c in result["cells"] if c["validation_mae"] == best["validation_mae"])
    assert (first["training_innings"], first["window"], first["weighting"]) == (best["training_innings"], best["window"], best["weighting"])
    build = result["build_up"]
    assert [b["feature"] for b in build] == best["features"]
    assert build[-1]["validation_mae"] == best["validation_mae"]
    assert all(a["validation_mae"] > b["validation_mae"] for a, b in zip(build, build[1:]))      # each step helped


class StubFitter:
    """A fitter whose answers are scripted, to test ties and thin cells without real data."""

    def __init__(self, thin=()):
        self.thin, self.evaluated = set(thin), []

    def too_few(self, window, innings):
        return [(2023, 50)] if (window, innings) in self.thin else []

    def redundant(self, window, innings, ids):
        return False

    def evaluate(self, window, weighting, innings, ids):
        self.evaluated.append((window, weighting, innings))
        return {"mae": 20.0, "r2": 0.5, "checks": [{"year": y, "mae": 20.0, "r2": 0.5} for y in (2023, 2024, 2025)]}


def test_a_tie_between_cells_goes_to_the_first_in_the_fixed_order():
    out = selection.grid_search(StubFitter())
    assert (out["best"]["training_innings"], out["best"]["window"], out["best"]["weighting"]) == ORDER[0]
    assert out["best"]["features"] == [features.IDS[0]]                               # the first of any tie; nothing improves


def test_a_cell_with_too_few_innings_is_marked_not_allowed_and_never_fitted():
    stub = StubFitter(thin={("last_3", "population")})
    out = selection.grid_search(stub)
    thin = [c for c in out["cells"] if not c["allowed"]]
    assert len(out["cells"]) == 24 and len(thin) == 3                                 # three weightings
    assert all(c["window"] == "last_3" and c["training_innings"] == "population" for c in thin)
    assert all("2023" in c["note"] and "50" in c["note"] and c["validation_mae"] is None and c["features"] == [] for c in thin)
    assert ("last_3", "none", "population") not in stub.evaluated and ("last_3", "gentle", "population") not in stub.evaluated


# --- through the agent --------------------------------------------------------------------------------------------------

SCRIPT = [reply(["runs_at_10"]), reply(["runs_at_10", "wickets_in_hand"]), reply(["runs_at_10"], "enough", True)]


@pytest.fixture
def path(write_csv):
    return write_csv(make_table())


def test_one_grid_search_step_replaces_the_repeating_forward_steps(run_graph, path):
    events = run_graph({"data_path": path}, llm=FakeLlm({"fake/steady": list(SCRIPT)}))
    names = nodes_of(events)
    assert names.count("grid_search") == 1 and "forward_selection" not in names
    assert names[-3:] == ["grid_search", "final_test", "explain_in_cricket_terms"]
    state = merged_state(events)
    grid = state["grid"]
    assert len(grid["cells"]) == 24 and grid["best"] and grid["build_up"] and "hyperparameters" in grid["caption"]
    forward = [a for a in state["attempts"] if a["proposer"] == "forward_selection"]
    assert forward == [state["forward_best"]] and state["forward_best"]["features"] == grid["best"]["features"]
    assert state["forward_best"]["validation_mae"] == grid["best"]["validation_mae"]
    assert (state["forward_best"]["window"], state["forward_best"]["weighting"], state["forward_best"]["training_innings"]) == (
        grid["best"]["window"], grid["best"]["weighting"], grid["best"]["training_innings"])


def test_the_validation_winner_is_set_by_the_grid_step_before_the_final_test(run_graph, path):
    events = run_graph({"data_path": path}, llm=FakeLlm({"fake/steady": list(SCRIPT)}))
    update = next(u for n, u in events if n == "grid_search")
    assert update["validation_winner"] == selection.validation_winner(merged_state(events)["llm_best"], update["forward_best"])
    assert "final" not in update


def test_without_a_language_model_the_grid_still_runs_and_wins_by_default(run_graph, path):
    state = merged_state(run_graph({"data_path": path}, model_id="fake/broken"))
    assert len(state["grid"]["cells"]) == 24
    assert state["validation_winner"]["winner"] == "forward" and state["final"]["llm_took_part"] is False


def test_the_grid_and_the_agents_state_stay_plain_data(run_graph, path):
    import json
    state = merged_state(run_graph({"data_path": path}, llm=FakeLlm({"fake/steady": list(SCRIPT)})))
    json.dumps(state["grid"])


# --- time (FR-021, SC-006) ------------------------------------------------------------------------------------------------

def _grid_seconds(rolling):
    started = time.perf_counter()
    out = selection.grid_search(Fitter(rolling))
    return time.perf_counter() - started, out


def test_the_complete_grid_on_the_committed_data_is_fast(rolling):
    limit = float(os.environ.get("GRID_TIMING_LIMIT_SECONDS", "3.0"))
    seconds, out = _grid_seconds(rolling)
    if seconds > limit:                                   # one retry, so a loaded machine does not flake the suite
        seconds, out = _grid_seconds(rolling)
    assert len(out["cells"]) == 24 and all(c["allowed"] for c in out["cells"])
    assert seconds <= limit, f"the complete grid took {seconds:.2f}s (limit {limit}s)"


def test_a_whole_scripted_run_on_the_committed_data_finishes_well_inside_the_deadline(run_graph):
    started = time.perf_counter()
    events = run_graph({"data_path": str(DEFAULT_PATH)}, llm=FakeLlm({"fake/steady": list(SCRIPT)}))
    seconds = time.perf_counter() - started
    assert nodes_of(events)[-1] == "explain_in_cricket_terms" and merged_state(events)["final"]
    assert seconds <= 15.0, f"the scripted run took {seconds:.1f}s"
