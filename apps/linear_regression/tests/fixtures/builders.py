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


def delivery(batter: int = 0, extras: int = 0, kind: str | None = None, wicket: str | bool = False,
             non_boundary: bool = False) -> dict:
    """One Cricsheet-style delivery with full control: runs off the bat, extras (wides, noballs, byes, legbyes)
    and an optional dismissal (True for a bowled wicket, or the dismissal kind such as "retired hurt")."""
    d = {"batter": "A", "bowler": "B", "non_striker": "C",
         "runs": {"batter": batter, "extras": extras, "total": batter + extras}}
    if non_boundary:
        d["runs"]["non_boundary"] = True
    if extras:
        d["extras"] = {kind or "byes": extras}
    if wicket:
        d["wickets"] = [{"player_out": "A", "kind": wicket if isinstance(wicket, str) else "bowled"}]
    return d


def innings_from_deliveries(overs: list[list[dict]], super_over: bool = False) -> dict:
    """An innings whose overs are lists of deliveries (over index = position in the list)."""
    inn = {"team": "X", "overs": [{"over": i, "deliveries": list(ds)} for i, ds in enumerate(overs)]}
    if super_over:
        inn["super_over"] = True
    return inn


def six_dot_overs(count: int) -> list[list[dict]]:
    """`count` quiet overs of six dot balls (a convenient filler)."""
    return [[delivery() for _ in range(6)] for _ in range(count)]


def make_match(innings: list[dict], *, gender: str = "male", result: str | None = None,
               method: str | None = None, overs: int = 20, date: str = "2023-05-01",
               season: str = "2023", venue: str = "Ground", teams: tuple[str, str] = ("X", "Y")) -> dict:
    """A match; `teams` is (batting first, bowling first) and sets the first innings' team and info.teams."""
    if innings:
        innings = [{**innings[0], "team": teams[0]}, *innings[1:]]
    outcome: dict = {"winner": teams[0]}
    if result:
        outcome = {"result": result}
    if method:
        outcome["method"] = method
    return {
        "info": {"gender": gender, "dates": [date], "season": season, "venue": venue,
                 "overs": overs, "outcome": outcome, "teams": list(teams)},
        "innings": innings,
    }


# Normal first innings: 20 overs; over i scores i+1 runs (so runs at 10 = 55, powerplay = 21).
NORMAL_RUNS = [i + 1 for i in range(20)]
NORMAL = dict(runs_at_10=55, powerplay=21, total=sum(NORMAL_RUNS), wickets_at_10=3)
NORMAL_WICKETS = {2: 1, 5: 1, 9: 1, 12: 1}  # 3 by the end of over index 9, 1 more later
