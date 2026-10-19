"""The section stays short (features 012 and 015), and the writing call has its own budget."""
import pytest

from linreg.run_budget import MIN_CALL_SECONDS, RunBudget
from tests.conftest import make_table, merged_state
from tests.test_explanation_numbers import blocks_for, facts_for, state_for


def test_every_block_is_within_its_sentence_limit_for_a_run_with_many_features():
    many = ("runs_at_10", "wickets_in_hand", "sixes_at_10", "fours_at_10", "partnership_runs", "dot_balls_at_10",
            "extras_at_10", "powerplay_runs")
    _, blocks = blocks_for(state_for(features_=many, coefs={f: 1.0 for f in many}))
    assert len(blocks) == 5 and all(1 <= len(b["sentences"]) <= 2 for b in blocks)


def test_the_writing_call_is_allowed_one_call_beyond_the_proposing_cap_and_counts():
    budget = RunBudget(deadline=float("inf") / 2, max_calls=2, call_timeout=25.0, reserve=0.0)
    assert budget.take_call() and budget.take_call() and budget.take_call() is None     # the proposing cap is unchanged
    assert budget.take_writing_call() is not None and budget.calls == 3
    assert budget.take_writing_call() is None                                           # only one extra call


def test_the_writing_call_gets_the_time_the_deadline_allows_and_none_below_the_minimum():
    now = [100.0]
    budget = RunBudget(deadline=110.0, max_calls=8, call_timeout=25.0, reserve=8.0, clock=lambda: now[0])
    assert budget.take_writing_call() == pytest.approx(9.0)                             # the time left less a one-second reserve
    now[0] = 109.5
    assert budget.take_writing_call() is None                                           # too little time to be worth a call
    assert MIN_CALL_SECONDS > 0.5


def test_proposing_retries_cannot_starve_the_writing_call():
    budget = RunBudget(deadline=float("inf") / 2, max_calls=8, call_timeout=25.0, reserve=0.0)
    while budget.take_call() is not None:
        pass
    assert budget.calls == 8 and budget.take_writing_call() is not None
