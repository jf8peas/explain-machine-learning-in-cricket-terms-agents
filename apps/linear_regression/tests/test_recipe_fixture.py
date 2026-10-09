"""Writes (and checks) the shared recipe fixture that the browser's recipe interpreter is tested against.

The Python interpreter computes the expected values; web/tests/unit/recipes.test.ts feeds the same inputs to the
TypeScript interpreter and expects identical results, so the one recipe cannot drift between the two.
"""
import json
from pathlib import Path

from linreg import features
from linreg.recipes import evaluate

FIXTURE = Path(__file__).resolve().parents[1] / "web" / "tests" / "fixtures" / "recipe_cases.json"
CASES = [
    {"runs_at_10": 80, "wickets_at_10": 0, "competition": "ipl", "batting_full_member": 0, "bowling_full_member": 0},
    {"runs_at_10": 55, "wickets_at_10": 9, "competition": "t20i", "batting_full_member": 1, "bowling_full_member": 1},
    {"runs_at_10": 101, "wickets_at_10": 3, "competition": "bbl", "batting_full_member": 0, "bowling_full_member": 0},
    {"runs_at_10": 0, "wickets_at_10": 5, "competition": "bbl", "batting_full_member": 0, "bowling_full_member": 0},
    {"runs_at_10": 70, "wickets_at_10": 2, "competition": "t20i", "batting_full_member": 1, "bowling_full_member": 0},
]


def expected() -> dict:
    out = []
    for inputs in CASES:
        values = dict(inputs)
        for f in features.CATALOGUE:
            recipe = f["source"].get("recipe")
            if recipe is not None:
                values[f["id"]] = int(evaluate(recipe, values))
        out.append({"inputs": inputs, "derived": {f: values[f] for f in features.DERIVED}})
    return {"catalogue": features.public_catalogue()["features"], "cases": out}


def test_the_recipe_fixture_is_up_to_date():
    want = expected()
    if not FIXTURE.exists() or json.loads(FIXTURE.read_text(encoding="utf-8")) != want:
        FIXTURE.parent.mkdir(parents=True, exist_ok=True)
        FIXTURE.write_text(json.dumps(want, indent=1), encoding="utf-8")  # regenerate; commit the change
    assert json.loads(FIXTURE.read_text(encoding="utf-8")) == want
