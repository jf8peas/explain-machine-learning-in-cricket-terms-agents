"""The owner's list of allowed language models, the default, and what the page may see."""
import json

import pytest

from linreg.model_options import FALLBACK_OPTIONS, ModelConfigError, ModelOptions

GOOD = [
    {"id": "vendor/fast-1", "name": "Fast", "note": "Quick and cheap", "default": True},
    {"id": "vendor/deep-1", "name": "Thorough", "note": "Slower and more careful"},
]


def options(value=None, **env) -> ModelOptions:
    environ = dict(env)
    if value is not None:
        environ["MODEL_OPTIONS"] = value if isinstance(value, str) else json.dumps(value)
    return ModelOptions.from_env(environ)


def test_parses_the_json_list_and_finds_the_default():
    o = options(GOOD)
    assert [m.id for m in o.options] == ["vendor/fast-1", "vendor/deep-1"]
    assert o.default.id == "vendor/fast-1" and o.default.name == "Fast"
    assert [m.default for m in o.options] == [True, False]


def test_the_fallback_list_is_used_only_when_the_variable_is_unset():
    assert [m.id for m in options().options] == [m["id"] for m in FALLBACK_OPTIONS]
    assert [m.id for m in options(GOOD).options] == ["vendor/fast-1", "vendor/deep-1"]
    assert options(MODEL_OPTIONS="").options  # an empty string counts as unset


def test_the_fallback_is_the_five_timed_models_with_one_default():
    ids = [m["id"] for m in FALLBACK_OPTIONS]
    assert ids == ["openai/gpt-6-luna", "minimax/minimax-m3", "anthropic/claude-haiku-4.5",
                   "anthropic/claude-sonnet-5.5", "moonshotai/kimi-k3"]
    assert [m["id"] for m in FALLBACK_OPTIONS if m.get("default")] == ["anthropic/claude-haiku-4.5"]
    assert all(m["name"] and m["note"] for m in FALLBACK_OPTIONS)


@pytest.mark.parametrize("bad", [
    "not json", "{}", "[]", json.dumps([{"id": "a", "name": "A", "note": "n"}]),                 # no default
    json.dumps([{"id": "a", "name": "A", "note": "n", "default": True},
                {"id": "b", "name": "B", "note": "n", "default": True}]),                          # two defaults
    json.dumps([{"id": "a", "name": "A", "note": "n", "default": True},
                {"id": "a", "name": "B", "note": "n"}]),                                           # duplicate id
    json.dumps([{"id": "", "name": "A", "note": "n", "default": True}]),                           # empty id
    json.dumps([{"id": "a", "note": "n", "default": True}]),                                       # no name
])
def test_a_bad_configuration_raises_a_clear_error(bad):
    with pytest.raises(ModelConfigError) as err:
        options(bad)
    assert "MODEL_OPTIONS" in str(err.value)


def test_choices_are_opaque_tokens_that_map_back_to_the_owners_models():
    o = options(GOOD)
    tokens = [m["choice"] for m in o.public()["models"]]
    assert tokens == ["m1", "m2"]
    assert o.resolve("m2").id == "vendor/deep-1"
    assert o.resolve(None).id == "vendor/fast-1"      # no choice means the default


@pytest.mark.parametrize("value", ["m0", "m3", "", "vendor/deep-1", "M1", "m1 ", "m-1", "../m1", "openai/gpt-6-luna"])
def test_anything_that_is_not_a_listed_token_is_refused(value):
    assert options(GOOD).resolve(value) is None


def test_the_public_view_has_names_notes_and_the_default_but_never_an_id():
    public = options(GOOD).public()
    assert public["models"][0] == {"name": "Fast", "note": "Quick and cheap", "default": True, "choice": "m1"}
    assert public["models"][1]["default"] is False
    text = json.dumps(public)
    assert "vendor/" not in text and "fast-1" not in text
