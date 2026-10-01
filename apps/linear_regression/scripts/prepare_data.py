"""Offline data preparation: Cricsheet ball-by-ball JSON -> one row per first innings.

Run manually (never at request time):
    uv run python apps/linear_regression/scripts/prepare_data.py

Data: https://cricsheet.org (Open Data Commons Attribution License).
"""
from __future__ import annotations

import csv
import io
import json
import sys
import zipfile
from collections import Counter
from datetime import date
from pathlib import Path

APP_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = APP_DIR / "data"

SOURCES = {
    "t20i": "https://cricsheet.org/downloads/t20s_male_json.zip",
    "ipl": "https://cricsheet.org/downloads/ipl_male_json.zip",
    "bbl": "https://cricsheet.org/downloads/bbl_male_json.zip",
}
ATTRIBUTION = ("Ball-by-ball data from Cricsheet (https://cricsheet.org), "
               "used under the Open Data Commons Attribution License.")
COLUMNS = ["match_id", "match_date", "season", "competition", "venue",
           "runs_at_10", "wickets_at_10", "powerplay_runs", "final_total"]
NOT_A_DISMISSAL = {"retired hurt", "retired not out"}
EXCLUSIONS = ["women", "no_result", "dls", "reduced_overs", "super_over",
              "ended_before_10_overs", "no_first_innings"]


def rollup_match(match: dict, competition: str, match_id: str) -> tuple[dict | None, str | None]:
    """Return (row, None) for a kept first innings or (None, reason) when excluded."""
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

    runs_10 = powerplay = total = wickets_10 = 0
    last_over = -1
    for over in first.get("overs", []):
        idx = over["over"]
        last_over = max(last_over, idx)
        for d in over.get("deliveries", []):
            r = d["runs"]["total"]
            total += r
            w = sum(1 for x in d.get("wickets", []) if x.get("kind") not in NOT_A_DISMISSAL)
            if idx <= 9:
                runs_10 += r
                wickets_10 += w
            if idx <= 5:
                powerplay += r
    if last_over < 9 or wickets_10 >= 10:
        return None, "ended_before_10_overs"

    return {
        "match_id": match_id,
        "match_date": info["dates"][0],
        "season": str(info.get("season", "")),
        "competition": competition,
        "venue": info.get("venue", ""),
        "runs_at_10": runs_10,
        "wickets_at_10": wickets_10,
        "powerplay_runs": powerplay,
        "final_total": total,
    }, None


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


def main() -> None:
    import requests

    DATA_DIR.mkdir(parents=True, exist_ok=True)
    all_rows: list[dict] = []
    manifest: dict = {"download_date": date.today().isoformat(), "sources": [], "counts": {},
                      "attribution": ATTRIBUTION}
    for comp, url in SOURCES.items():
        print(f"Downloading {url}")
        resp = requests.get(url, timeout=120)
        resp.raise_for_status()
        with zipfile.ZipFile(io.BytesIO(resp.content)) as zf:
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
    with open(DATA_DIR / "innings.csv", "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=COLUMNS)
        w.writeheader()
        w.writerows(all_rows)
    manifest["counts"]["total_innings"] = len(all_rows)
    (DATA_DIR / "manifest.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    print(f"Wrote {len(all_rows)} innings")


if __name__ == "__main__":
    sys.exit(main())
