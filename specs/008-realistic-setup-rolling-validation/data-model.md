# Data Model: A Realistic Setup and a Steadier Judge

Nothing is stored at runtime. The prepared table gains five columns and the manifest four entries; the run state gains a setup, three check errors per attempt and a grid. Wire detail is in `contracts/api.md`.

## Prepared innings (`data/innings.csv`), added columns

| Column | Type | Rule |
|---|---|---|
| `batting_team` | text | The first innings' team, mapped through `TEAM_ALIASES` |
| `bowling_team` | text | The other team of the match, mapped the same way |
| `batting_full_member` | 0/1 | 1 if `batting_team` is in `FULL_MEMBERS` and the competition is `t20i`; always 0 for IPL and BBL (franchises are not national teams) |
| `bowling_full_member` | 0/1 | The same for `bowling_team` |
| `in_test_population` | 0/1 | 1 for every IPL and BBL innings, and for a `t20i` innings where both flags are 1; otherwise 0 |

The catalogue adds two candidates: `batting_full_member` (read from the column) and `both_full_members` (recipe: `batting_full_member × bowling_full_member`). Column order: after `venue`, the two team names, then the flags, `in_test_population` last before the target.

## Manifest additions (`data/manifest.json`)

| Key | Content |
|---|---|
| `full_members` | The list used |
| `team_aliases` | The alias map used (empty today) |
| `absent_full_members` | Full members with no innings in the source (`["Afghanistan"]` today) |
| `population` | `{"in": n, "out": n, "by_competition": {comp: {"in": n, "out": n}}}`, equal to the counts in the CSV |

## Setup menus (`setup_settings.py`)

| Menu | Ids (in order) | Parameter |
|---|---|---|
| Training window | `all`, `last_10`, `last_5`, `last_3` | years before the year being checked: all, 10, 5, 3 |
| Recency weighting | `none`, `gentle`, `strong` | half-life in years: none, 6, 2 |
| Training innings | `population`, `all` | test-population innings only, or every innings |

Each entry has a plain `label` ("the last 5 seasons", "recent seasons counting more", "full-member and league innings only"). Weight of a training innings: `0.5 ** (age / half_life)`, age = year being scored − match year (at least 1); no weighting gives 1.

## Rolling checks (`season_split.rolling_checks`)

| Field | Notes |
|---|---|
| `test_year` | Latest calendar year in the data |
| `test` | Test-population innings of that year |
| `checks` | Three `CheckSpec`: `year` = test year − 3, − 2, − 1; `label` (the year as text); `earlier_years` = calendar years before that year |
| Rules | Each check year and the test year need at least `MIN_CHECK_INNINGS` (100) test-population innings; at least one year before the first check year has at least `MIN_TRAIN_INNINGS` (150) test-population innings; otherwise `DataError` |

Real values today: test year 2026; checks 2023, 2024, 2025 with 176, 196 and 196 population innings; test 166.

## Setup (a value)

| Field | Notes |
|---|---|
| `features` | List of catalogue ids, at most `SET_LIMIT` (8); compared as a set |
| `window`, `weighting`, `training_innings` | Menu ids |
| Equality | All four parts, features as a set |

## Attempt (changed)

| Field | Notes |
|---|---|
| `features`, `proposer`, `improved`, `round` | As before |
| `window`, `weighting`, `training_innings` | New: the other three parts of the setup |
| `checks` | New: `[{year, mae}]`, three entries, mean absolute miss in runs on each check year's test-population innings, two decimals |
| `validation_mae`, `validation_r2` | The mean of the three check errors, and the mean of the three R², two decimals; "improved" compares the displayed `validation_mae` |

## Grid (new state key `grid`, carried by the `grid_search` step)

| Field | Notes |
|---|---|
| `cells` | 24 entries in the fixed order (training innings, then window, then weighting): `training_innings`, `window`, `weighting`, `allowed` (false if too few innings), `note` (why, when not allowed), `features` (the best set found there), `validation_mae`, `checks` |
| `caption` | One plain sentence under the grid, from the server: the training window and recency weighting are hyperparameters, settings chosen before fitting, and this is the first time the site tunes them |
| `best` | The winning cell (lowest displayed `validation_mae`, first in order on a tie) |
| `build_up` | The winning cell's forward selection: `[{feature, validation_mae}]` per step |

State also gains `validation_winner` (`"llm"` or `"forward"`, with the reason), and `forward_best` now holds the winning grid cell as an attempt.

## Final (changed)

| Field | Notes |
|---|---|
| `test_mae` | `llm`, `forward` and `tv` on the test-population innings of the test year |
| `winner`, `winner_name`, `winner_chosen_on` | The winner as already decided on validation; `winner_chosen_on = "validation"` |
| `sets` | Each model's full setup |
| `accuracy`, `verdict`, … | As feature 006, on the same innings (the know-nothing guess is the mean of test-population innings before the test year) |

## Derived on the page

| Value | Definition |
|---|---|
| Setup chips | One chip per part, text from `setup_menus` in `/api/catalogue` |
| Check error labels | "{year}: {mae}" for each of the three checks |
| Grid cell | The cell's `validation_mae` to one decimal; the best cell outlined |
| "Used for" labels | `training`, `training_validation`, `test` mapped to the labels in the column definition |
