"""Hand-made Cricsheet-style match builders for tests (zero-indexed overs)."""
from __future__ import annotations


def _delivery(runs: int, wicket: bool = False) -> dict:
    d = {"batter": "A", "bowler": "B", "non_striker": "C",
         "runs": {"batter": runs, "extras": 0, "total": runs}}
    if wicket:
        d["wickets"] = [{"player_out": "A", "kind": "bowled"}]
    return d


def make_innings(per_over_runs: list[int], wickets_in_over: dict[int, int] | None = None,
                 super_over: bool = False) -> dict:
    """One delivery per over carries the over's runs; wickets are extra deliveries."""
    wickets_in_over = wickets_in_over or {}
    overs = []
    for i, runs in enumerate(per_over_runs):
        deliveries = [_delivery(runs)]
        for _ in range(wickets_in_over.get(i, 0)):
            deliveries.append(_delivery(0, wicket=True))
        overs.append({"over": i, "deliveries": deliveries})
    inn = {"team": "X", "overs": overs}
    if super_over:
        inn["super_over"] = True
    return inn


def make_match(innings: list[dict], *, gender: str = "male", result: str | None = None,
               method: str | None = None, overs: int = 20, date: str = "2023-05-01",
               season: str = "2023", venue: str = "Ground") -> dict:
    outcome: dict = {"winner": "X"}
    if result:
        outcome = {"result": result}
    if method:
        outcome["method"] = method
    return {
        "info": {"gender": gender, "dates": [date], "season": season, "venue": venue,
                 "overs": overs, "outcome": outcome, "teams": ["X", "Y"]},
        "innings": innings,
    }


# Normal first innings: 20 overs; over i scores i+1 runs (so runs at 10 = 55, powerplay = 21).
NORMAL_RUNS = [i + 1 for i in range(20)]
NORMAL = dict(runs_at_10=55, powerplay=21, total=sum(NORMAL_RUNS), wickets_at_10=3)
NORMAL_WICKETS = {2: 1, 5: 1, 9: 1, 12: 1}  # 3 by the end of over index 9, 1 more later
