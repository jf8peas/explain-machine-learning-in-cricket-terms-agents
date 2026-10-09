"""Offline data preparation: Cricsheet ball-by-ball JSON -> one row per first innings.

Run manually (never at request time):
    uv run python apps/linear_regression/scripts/prepare_data.py                  # download fresh data
    uv run python apps/linear_regression/scripts/prepare_data.py --from-existing  # no download

--from-existing reads the current data/innings.csv and data/manifest.json, adds or refreshes the competition
dummy columns and the manifest's "dummies" entry, and keeps the same innings, order and download date.

Every row carries the competition dummies (is_ipl, is_bbl), defined once in backend/linreg/competition_dummies.py.
An unrecognised competition stops the run before anything is written. Both output files are written to
temporary files and only replace the real ones after everything has succeeded.

Data: https://cricsheet.org (Open Data Commons Attribution License).
"""
from __future__ import annotations

import argparse
import csv
import io
import json
import os
import sys
import zipfile
from collections import Counter
from datetime import date
from pathlib import Path
from typing import Callable

import pandas as pd

APP_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = APP_DIR / "data"
sys.path.insert(0, str(APP_DIR / "backend"))

from linreg import features, setup_settings  # noqa: E402
from linreg.competition_dummies import REFERENCE, dummy_values, manifest_entry  # noqa: E402
from linreg.population import population_counts  # noqa: E402

SOURCES = {
    "t20i": "https://cricsheet.org/downloads/t20s_male_json.zip",
    "ipl": "https://cricsheet.org/downloads/ipl_male_json.zip",
    "bbl": "https://cricsheet.org/downloads/bbl_male_json.zip",
}
ATTRIBUTION = ("Ball-by-ball data from Cricsheet (https://cricsheet.org), "
               "used under the Open Data Commons Attribution License.")
COLUMNS = features.PREPARED_COLUMNS  # defined once, in the feature catalogue (linreg/features.py)
NOT_A_DISMISSAL = {"retired hurt", "retired not out"}
NOT_A_LEGAL_BALL = {"wides", "noballs"}
POWERPLAY_LAST_OVER = 5  # overs are zero-indexed: indexes 0 to 5 are overs 1 to 6
LAST_OVER = 9            # the 10th over: nothing after it is ever used by a candidate


class PrepareError(Exception):
    """The requested rebuild cannot be done from the data on hand."""
EXCLUSIONS = ["women", "no_result", "dls", "reduced_overs", "super_over",
              "ended_before_10_overs", "no_first_innings", "no_team_names"]


def _teams(match: dict, aliases: dict[str, str] | None) -> tuple[str, str] | None:
    """(batting team, bowling team) after the alias map, or None if the match does not name both."""
    batting = ((match.get("innings") or [{}])[0]).get("team")
    named = [t for t in match.get("info", {}).get("teams", []) if t]
    others = [t for t in named if t != batting]
    if not batting or not others:
        return None
    return setup_settings.canonical_team(batting, aliases), setup_settings.canonical_team(others[0], aliases)


def rollup_match(match: dict, competition: str, match_id: str,
                 aliases: dict[str, str] | None = None) -> tuple[dict | None, str | None]:
    """Return (row, None) for a kept first innings or (None, reason) when excluded.

    An unrecognised competition raises UnknownCompetition, even if the match would be excluded. `aliases` maps a team's
    spelling in the source to its canonical name (default: the settings module's map).
    """
    dummies = dummy_values(competition)  # raises for an unknown competition, before anything else
    info = match.get("info", {})
    if info.get("gender") != "male":
        return None, "women"
    outcome = info.get("outcome", {})
    if outcome.get("result") == "no result":
        return None, "no_result"
    if outcome.get("method"):
        return None, "dls"
    if info.get("overs") != 20:
        return None, "reduced_overs"
    innings = match.get("innings") or []
    if not innings:
        return None, "no_first_innings"
    first = innings[0]
    if first.get("super_over"):
        return None, "super_over"
    teams = _teams(match, aliases)
    if teams is None:
        return None, "no_team_names"

    runs_10 = powerplay = total = wickets_10 = 0
    pp_wickets = runs_7_10 = wickets_7_10 = fours = sixes = dots = extras = 0
    partnership_runs = balls_since_wicket = 0
    last_over = -1
    for over in first.get("overs", []):
        idx = over["over"]
        last_over = max(last_over, idx)
        for d in over.get("deliveries", []):
            runs = d["runs"]
            r = runs["total"]
            total += r
            if idx > LAST_OVER:
                continue  # the target (final_total) uses the whole innings; every candidate stops at over 10
            w = sum(1 for x in d.get("wickets", []) if x.get("kind") not in NOT_A_DISMISSAL)
            runs_10 += r
            wickets_10 += w
            if idx <= POWERPLAY_LAST_OVER:
                powerplay += r
                pp_wickets += w
            else:
                runs_7_10 += r
                wickets_7_10 += w
            if not runs.get("non_boundary"):
                fours += runs.get("batter") == 4
                sixes += runs.get("batter") == 6
            dots += r == 0
            extras += runs.get("extras", 0)
            if w:  # a dismissal ends the partnership; this ball's runs belong to the one that ended
                partnership_runs = balls_since_wicket = 0
            else:
                partnership_runs += r
                balls_since_wicket += not (NOT_A_LEGAL_BALL & set(d.get("extras", {})))
    if last_over < LAST_OVER or wickets_10 >= 10:
        return None, "ended_before_10_overs"

    # Franchises are not national teams: the full-member flags are 0 for the leagues, and every league innings is in the
    # test population; a T20 international is in it only when both teams are full members.
    is_international = competition == REFERENCE
    batting_member = int(is_international and setup_settings.is_full_member(teams[0], aliases))
    bowling_member = int(is_international and setup_settings.is_full_member(teams[1], aliases))
    row = features.derive_row({
        "match_id": match_id,
        "batting_team": teams[0],
        "bowling_team": teams[1],
        "batting_full_member": batting_member,
        "bowling_full_member": bowling_member,
        "in_test_population": int(not is_international or (batting_member and bowling_member)),
        "match_date": info["dates"][0],
        "season": str(info.get("season", "")),
        "competition": competition,
        "venue": info.get("venue", ""),
        "runs_at_10": runs_10,
        "wickets_at_10": wickets_10,
        "powerplay_runs": powerplay,
        "powerplay_wickets": pp_wickets,
        "runs_overs_7_10": runs_7_10,
        "wickets_overs_7_10": wickets_7_10,
        "fours_at_10": int(fours),
        "sixes_at_10": int(sixes),
        "dot_balls_at_10": int(dots),
        "extras_at_10": extras,
        "partnership_runs": partnership_runs,
        "balls_since_last_wicket": int(balls_since_wicket),
        "final_total": total,
    })
    assert all(row[c] == v for c, v in dummies.items())  # the recipes and the shared mapping agree
    return {column: row[column] for column in COLUMNS}, None


def process_zip(zf: zipfile.ZipFile, competition: str) -> tuple[list[dict], Counter, int]:
    rows: list[dict] = []
    excluded: Counter = Counter()
    read = 0
    for name in zf.namelist():
        if not name.endswith(".json"):
            continue
        read += 1
        match = json.loads(zf.read(name))
        row, reason = rollup_match(match, competition, Path(name).stem)
        if row:
            rows.append(row)
        else:
            excluded[reason] += 1
    return rows, excluded, read


def fetch_zip(url: str) -> bytes:
    import requests

    resp = requests.get(url, timeout=120)
    resp.raise_for_status()
    return resp.content


def write_outputs(rows: list[dict], manifest: dict, data_dir: Path) -> None:
    """Write innings.csv and manifest.json via temporary files; the real files change only after both are ready."""
    data_dir.mkdir(parents=True, exist_ok=True)
    csv_final, manifest_final = data_dir / "innings.csv", data_dir / "manifest.json"
    csv_tmp, manifest_tmp = data_dir / "innings.csv.tmp", data_dir / "manifest.json.tmp"
    try:
        with open(csv_tmp, "w", newline="", encoding="utf-8") as f:
            w = csv.DictWriter(f, fieldnames=COLUMNS)
            w.writeheader()
            w.writerows(rows)
        manifest_tmp.write_text(json.dumps(manifest, indent=2), encoding="utf-8")
        os.replace(csv_tmp, csv_final)
        os.replace(manifest_tmp, manifest_final)
    finally:
        for tmp in (csv_tmp, manifest_tmp):
            tmp.unlink(missing_ok=True)


def _international_teams(rows: list[dict]) -> Counter:
    """How many kept T20 international innings each team took part in (as batting or bowling side)."""
    seen: Counter = Counter()
    for r in rows:
        if r["competition"] == REFERENCE:
            seen[r["batting_team"]] += 1
            seen[r["bowling_team"]] += 1
    return seen


def team_manifest(rows: list[dict]) -> dict:
    """What the manifest records about the test population: the member list, the aliases, who is absent and the counts."""
    seen = _international_teams(rows)
    return {"full_members": list(setup_settings.FULL_MEMBERS), "team_aliases": dict(setup_settings.TEAM_ALIASES),
            "absent_full_members": [m for m in setup_settings.FULL_MEMBERS if m not in seen],
            "population": population_counts(pd.DataFrame(rows))}


def print_team_report(rows: list[dict]) -> None:
    """Every T20 international team classified as not a full member, so a missed alias can be spotted, and a warning for
    any full member that never appears in the data."""
    seen = _international_teams(rows)
    others = sorted(((t, n) for t, n in seen.items() if t not in setup_settings.FULL_MEMBERS), key=lambda x: (-x[1], x[0]))
    print("Not full members in the T20I data (team: innings). Check none is a spelling of a full member; if one is, "
          "add it to TEAM_ALIASES in linreg/setup_settings.py:")
    for team, n in others:
        print(f"  {team}: {n}")
    absent = [m for m in setup_settings.FULL_MEMBERS if m not in seen]
    if absent:
        documented = set(absent) == set(setup_settings.ABSENT_FROM_SOURCE)
        print(f"Warning: these full members never appear in the T20I data: {', '.join(absent)}."
              + (f" This is the documented gap ({setup_settings.ABSENT_REASON})" if documented else
                 " That is not the documented gap: check the aliases and the source."))


def run_download(data_dir: Path = DATA_DIR, sources: dict[str, str] = SOURCES,
                 fetch: Callable[[str], bytes] = fetch_zip, today: str | None = None) -> None:
    """Download every source, roll up the matches and write the data files."""
    all_rows: list[dict] = []
    manifest: dict = {"download_date": today or date.today().isoformat(), "sources": [], "counts": {},
                      "attribution": ATTRIBUTION}
    for comp, url in sources.items():
        dummy_values(comp)  # an unrecognised competition stops the run before anything is downloaded
        print(f"Downloading {url}")
        with zipfile.ZipFile(io.BytesIO(fetch(url))) as zf:
            rows, excluded, read = process_zip(zf, comp)
        all_rows += rows
        manifest["sources"].append({"competition": comp, "url": url})
        manifest["counts"][comp] = {
            "matches_read": read,
            "excluded": {k: excluded.get(k, 0) for k in EXCLUSIONS},
            "innings_kept": len(rows),
        }
        print(f"  {comp}: read {read}, kept {len(rows)}, excluded {dict(excluded)}")
    all_rows.sort(key=lambda r: (r["match_date"], r["match_id"]))
    manifest["counts"]["total_innings"] = len(all_rows)
    manifest["dummies"] = manifest_entry()
    manifest["features"] = features.manifest_entry()
    manifest.update(team_manifest(all_rows))
    print_team_report(all_rows)
    write_outputs(all_rows, manifest, data_dir)
    print(f"Wrote {len(all_rows)} innings")


def run_from_existing(data_dir: Path = DATA_DIR) -> None:
    """Add or refresh the dummy and derived columns and the manifest entries on the existing files, without downloading.

    Every original value, the row order and the download date are kept exactly as they are. The measured columns
    need the ball-by-ball data, so if the file lacks any of them this stops with a clear message.
    """
    with open(data_dir / "innings.csv", newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        header = reader.fieldnames or []
        rows = list(reader)
    needed = [c for c in COLUMNS if c not in features.DERIVED]
    missing = [c for c in needed if c not in header]
    if missing:
        raise PrepareError(
            "The existing innings.csv has no ball-by-ball columns for: " + ", ".join(missing) + ". They cannot be "
            "worked out from the file, so --from-existing cannot add them. Run scripts/prepare_data.py without "
            "--from-existing to download fresh data.")
    for row in rows:
        dummy_values(row["competition"])  # an unrecognised competition stops here, before any write
        numbers = {c: int(row[c]) for c in features.MEASURED}
        derived = features.derive_row({**numbers, "competition": row["competition"]})
        row.update({c: derived[c] for c in features.DERIVED})
    manifest = json.loads((data_dir / "manifest.json").read_text(encoding="utf-8"))
    manifest["dummies"] = manifest_entry()
    manifest["features"] = features.manifest_entry()
    write_outputs(rows, manifest, data_dir)
    print(f"Updated {len(rows)} innings with the dummy and derived columns (no download)")


def main(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser(description="Prepare data/innings.csv and data/manifest.json.")
    parser.add_argument("--from-existing", action="store_true",
                        help="rebuild from the current innings.csv without downloading (adds or refreshes the dummies)")
    args = parser.parse_args(argv)
    if args.from_existing:
        run_from_existing(DATA_DIR)
    else:
        run_download(DATA_DIR)


if __name__ == "__main__":
    try:
        main()
    except PrepareError as exc:
        sys.exit(str(exc))
