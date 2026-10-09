# Research: A Realistic Setup and a Steadier Judge

Every value the brief left open is chosen here from the real data or from a measurement, and every decision records what else was considered. Real data used: the committed `data/innings.csv` (5,146 first innings, downloaded 2026-10-04) and a fresh Cricsheet T20 internationals download taken on 2026-10-09 (3,558 matches, 3,348 kept by the existing rules), read with the existing `rollup_match` so the counts are the ones the preparation script will produce.

## Decision 1: One settings module, `setup_settings.py`

**Decision**: A new `backend/linreg/setup_settings.py` (separate from the existing `settings.py`, which parses environment values) holds everything the new feature fixes:

- `FULL_MEMBERS`: the twelve names in the brief, and `TEAM_ALIASES` (source spelling to canonical name).
- The menus, each a tuple of entries with an `id`, a plain `label` and its parameter: `WINDOWS` (`all`, `last_10`, `last_5`, `last_3`), `WEIGHTINGS` (`none`, `gentle`, `strong`) and `TRAINING_INNINGS` (`population`, `all`).
- `HALF_LIVES`: the two recency strengths in years (Decision 3).
- `CHECK_OFFSETS = (3, 2, 1)`, `MIN_CHECK_INNINGS`, `MIN_TRAIN_INNINGS` (Decision 4).
- The plain-language wording for a setup (`setup_words(setup)`), built from the labels, so the explanation, the leaderboard chips and the prompt all say it the same way.

Nothing else holds a menu id, a label, a half-life or a member name: the prompt, `check_proposal`, the grid search, the Data tab, the structure notes and the catalogue endpoint import from here, and a test greps the other source files for the member names and the menu ids.

**Rationale**: the brief asks for one place. A separate file keeps the env-parsing `settings.py` single-purpose.

**Alternatives**: extending `state.py` (already holds `MARGIN_RUNS`, `SET_LIMIT`; it is a constants file for the run state, and the menus need helper functions); extending `features.py` (the catalogue; the menus are not features).

## Decision 2: The team names, the alias map and a finding about Afghanistan

**Finding**: reading the fresh `t20s_male_json.zip` shows **Afghanistan does not appear in it at all** (no match, kept or excluded, names a team containing "Afghan"). The other eleven full members appear with 138 to 276 kept innings each (Australia 208, Bangladesh 186, England 207, India 262, Ireland 138, New Zealand 235, Pakistan 276, South Africa 214, Sri Lanka 213, West Indies 219, Zimbabwe 173). 98 other team names appear (the largest: United Arab Emirates 122, Hong Kong 118, Netherlands 112, Nepal 109, Bahrain 109), none a spelling variant of a full member (the only near-matches are Papua New Guinea and South Korea). So today's source needs **no aliases**.

**Decision**:
- `TEAM_ALIASES` ships as an empty mapping with its mechanics fully tested (a key must map to a full member, an alias must not be a canonical name), because the evidence shows nothing to map; an entry is added when the script's report reveals a miss.
- The preparation script prints, after each run, every T20I team name classified as not a full member (name and innings count, most frequent first) so a missed alias is visible, and prints a warning for any full member that never appears.
- The brief's test "all twelve full members appear in the data" cannot pass as written. The test asserts instead that the set of full members **absent from the data** equals the documented `ABSENT_FROM_SOURCE = {"Afghanistan"}` (with the reason beside it in `setup_settings.py`). If Afghanistan later appears in Cricsheet, the test fails and tells the owner to remove it from that set. The manifest records the absent members.
- Consequence for the page: the population is "IPL, BBL and T20 internationals between full members" with eleven of the twelve actually present; the introduction sentence does not claim twelve.

**Rationale**: a hard-coded "all twelve present" test would either fail forever or be deleted; asserting the exact documented gap keeps the check alive.

**Alternatives**: fetching Afghanistan from another Cricsheet file (no such file in the three sources the script uses; adding a source is out of scope); dropping Afghanistan from the list (the brief fixes the list of twelve).

## Decision 3: The recency strengths (half-lives)

**Decision**: gentle = **6 years**, strong = **2 years**. A training innings from year `a` years before the year being scored (the age, measured by match year, at least 1) gets weight `0.5 ** (a / half_life)`.

| Age (years) | none | gentle (6) | strong (2) |
|---|---|---|---|
| 1 | 1.00 | 0.89 | 0.71 |
| 2 | 1.00 | 0.79 | 0.50 |
| 3 | 1.00 | 0.71 | 0.35 |
| 5 | 1.00 | 0.56 | 0.18 |
| 10 | 1.00 | 0.31 | 0.03 |

**Rationale**: gentle should matter on the long windows (all years: an innings from ten years back counts about a third of last year's) and strong should concentrate the fit on the last three or four seasons (a five-year-old innings counts under a fifth) without ignoring older cricket entirely. Both stay distinguishable on a 5-year window (0.56 against 0.18 at the far end) and, as the brief expects, strong on a 3-year window barely differs from gentle (0.35 against 0.71 at the far end, still different, so it is kept as a real option; the brief's "no effect" example is `none` on a window where the age spread is small, handled the same way, both allowed).

**Alternatives**: half-lives of 10 and 3 (gentle too weak to see on 5 years); an exponential per-year decay factor (less readable than "halves every N years" for a cricket fan).

## Decision 4: The minimums, from the real counts

Test-population innings per year in the committed data plus the fresh team names (IPL and BBL always; T20Is only when both teams are full members). The test year Y is 2026 (the latest year, part way through, downloaded 2026-10-04).

| Year | Role | IPL | BBL | T20I (both full) | Test population |
|---|---|---|---|---|---|
| 2020 | training | 60 | 58 | 37 | 155 |
| 2021 | training | 60 | 61 | 99 | 220 |
| 2022 | training | 74 | 55 | 100 | 229 |
| 2023 | check 1 (Y−3) | 71 | 52 | 53 | **176** |
| 2024 | check 2 (Y−2) | 71 | 37 | 88 | **196** |
| 2025 | check 3 (Y−1) | 70 | 40 | 86 | **196** |
| 2026 | test (Y) | 72 | 24 | 70 | **166** |

(All T20Is: 2023 328, 2024 580, 2025 485, 2026 419, so the brief's point stands: the full-member innings are a minority of the internationals, 16% in 2023.) Population innings before 2023, for the introduction's figures: about 2,200 (4,036 before this feature).

**Decision**:
- `MIN_CHECK_INNINGS = 100` (the existing `MIN_TEST_INNINGS`, which the test year also needs). The smallest real check or test year has 166, a 66% margin, so the real data passes and a thin synthetic year (say 60) fails.
- `MIN_TRAIN_INNINGS = 150` per check, after the setup's window and training-innings choice are applied. The thinnest real case is window `last_3` with `population` innings for check 1: 2020 to 2022 gives 604, four times the minimum. 150 is about eight innings per fitted number at the set limit (eight features plus an intercept), the usual rule of thumb floor for a stable linear fit.
- "Enough years" means: the data holds the three check years, the test year, and at least one earlier year with `MIN_TRAIN_INNINGS` test-population innings (so the first check's "all years" setup can be fitted).

**Alternatives**: a share of the year's innings (hard to explain); 50 or 200 for the check minimum (50 admits very noisy checks; 200 would fail 2023 and 2026 today).

## Decision 5: What replaces `split_three_ways`

**Decision**: `season_split.py` gains `rolling_checks(df)` and drops `split_three_ways` and its `Slices` class once every consumer has moved. It returns a frozen `Rolling` with:

- `test_year` (the latest calendar year present) and `test` (the test-population innings of that year);
- `checks`: three `CheckSpec`s `(year, label, earlier_years)` for `test_year − 3, − 2, − 1`, where `earlier_years` are the calendar years strictly before the check year;
- helpers `years_for(check_year, window)` and `age(match_year, check_year)`;
- the counts the stages, the Data tab and the errors need (`n_check`, `n_test`).

It raises the existing `DataError` for: a check or the test year below `MIN_CHECK_INNINGS`, too few years, or no earlier year with `MIN_TRAIN_INNINGS`. Every consumer calls it: `nodes.py`, `reference_api.py`, `data_table.py`, `stage_info.py` and the Data tab summary.

**Rationale**: the brief; one function means the stage notes, the "Used for" column and the agent can never disagree about the years.

## Decision 6: Fast, exact fitting (what keeps the 24-combination grid complete)

**Measured on this machine** (committed data, one training set of about 2,500 rows, six features): `fit_and_score` costs 2.97 ms; the existing SVD redundancy check costs 0.76 ms; a solve from a precomputed Gram block costs 0.009 ms. A forward selection inside one combination makes at most 8 steps of up to 18 candidates over 3 checks (about 430 fits). Naively that is 430 × 3.7 ms ≈ 1.6 s per combination, **about 38 s for 24**, which does not fit beside a language-model loop in an 80 s run with an 8 s reserve. The Gram path is about 430 × 0.05 ms ≈ 20 ms per combination, **about 0.5 s for 24**.

**Decision**: new module `backend/linreg/fitting.py`:

- `CheckData`: for one check, built once per run, the validation arrays (`X_val`, `y_val`, test-population rows of the check year) and, for each of the 8 (window, training innings) subsets, the training arrays `X` (intercept column plus every catalogue feature) and `y`, and the ages.
- For each weighting: `G = Xᵀ W X` and `b = Xᵀ W y` once (`W` from the half-life), cached on the subset.
- `solve(subset, weighting, feature_ids)` picks the matching rows and columns of `G` and `b` (the intercept is always included) and solves `np.linalg.solve`. Predictions on validation are `X_val[:, idx] @ beta`.
- `validation_error(setup)` returns the three check errors (mean absolute miss in runs on the check year's test-population innings) and their average.
- The existing `regression.fit` stays as the reference and gains an optional `weights` argument (weighted least squares through the same `lstsq` after scaling rows by `sqrt(w)`); it is used for the final fits and the `fit_model` step, which also need coefficients and IQRs. A test compares the fast path with `regression.fit` for random feature subsets, weightings, windows, training-innings choices and checks, to a tolerance of `1e-8` on coefficients and predictions.
- Importance figures (IQR) are computed only for the final fitted models (`final_test`, `fit_model`), never inside the search.

**Alternatives**: caching `np.linalg.lstsq` results by feature set only (does not remove the per-fit cost across weightings and checks); sampling a few combinations (the brief and the clarification require a complete grid); adding scikit-learn or scipy (forbidden: no new dependencies, and the Vercel size limit).

## Decision 7: One redundancy criterion, from the Gram block

**Problem**: the existing `redundancy.repeating_features` builds a standardised design from the rows and takes an SVD (0.76 ms), too slow inside the search, and the proposal check must agree with the search exactly.

**Decision**: `redundancy.py` gains `redundant_columns(G_block)`, which works from the (unweighted) Gram block of the training rows of one check for the columns in question (intercept first): centre through the intercept, scale to a correlation matrix, take `numpy.linalg.eigvalsh`, and call the set redundant when the smallest eigenvalue is at most `GRAM_TOLERANCE = 1e-10` times the largest. A feature "repeats" (for the rejection message) when dropping it removes the near-zero eigenvalue, as today. A set is redundant if it is redundant in **any of the three checks' training rows** (for that setup's window and training innings). `check_proposal` and the grid search call the same function with the same tolerance; the old `repeating_features(train, columns)` is kept as a thin wrapper that builds the block from rows, so existing tests keep their meaning, and a test shows the wrapper and the Gram path agree on every real feature pair and on sampled sets of up to 8.

**Measured** (the years before 2023 of the committed data, smallest eigenvalue of the correlation matrix over the largest): exact repeats give values of about 1e-17 in size and sometimes slightly negative (`wickets_at_10` with `wickets_in_hand`, a duplicated column, and sets that contain `runs_at_10` with `powerplay_runs` and `runs_overs_7_10`, which are exactly linked because the first is the sum of the other two); the most correlated honest set tried (`runs_at_10`, `wickets_in_hand` and their product) gives 0.005; `is_ipl` with `is_bbl` gives 0.54. A tolerance of 1e-10 sits between 1e-17 and 5e-3, with seven orders of magnitude on the safe side and many on the other. A test pins the criterion on these cases and on every pair of catalogue features.

**Alternatives**: keep the SVD per candidate (too slow); a QR rank test (no cheaper than the eigenvalue test on a block this small).

## Decision 8: The new catalogue features

**Decision**: add `batting_full_member` (measured from the new column, "batting team is a full member", 0/1) and `both_full_members` (a recipe: the product of `batting_full_member` and `bowling_full_member`, "both teams are full members", 0/1). `bowling_full_member` is a prepared column but not a candidate on its own (the brief's examples name only the two). For league innings both flags are 0 (franchises are not national teams), so `both_full_members` equals "neither IPL nor BBL" inside the test population, which is exactly the clash the existing redundancy check rejects with `is_ipl` and `is_bbl` together; the rejection message names the features and says one can be built exactly from the others, and the catalogue description of `both_full_members` says it matches "neither IPL nor BBL" within the test population so the model can see why. Catalogue size goes from 16 to 18.

**Alternatives**: setting league flags to 1 (the brief says 0 and the population rule depends on it); adding `bowling_full_member` as a third candidate (more menu for little teaching value).

## Decision 9: The stage numbering (a discrepancy in the brief)

The brief says "Replace the forward_selection node with grid_search (stage 6, code)" and "The hyperparameter explanation goes in the stage 6 note". In the numbering fixed by feature 005 and its renumbering, stage 5 is **Choose the setup** (`choose`, which holds propose, check, evaluate and forward selection today) and stage 6 is **Fit the model** (`fit`). The grid search chooses hyperparameters and features, so it belongs to `choose` (stage 5) and the note replaced is the existing `CHOOSE_NOTE`, which also says "hyperparameter tuning appears in later apps". **Decision**: `grid_search` is in `choose` (stage 5); the hyperparameter note goes in the choose-stage note. If the owner intends otherwise it is a one-line change in `NODE_STAGES`.

## Decision 10: The `grid_search` node

**Decision**: one node, one visit, replacing `forward_selection` and its self-loop. It runs forward selection inside each of the 24 combinations in a fixed order: training innings (`population`, then `all`), then window (`all`, `last_10`, `last_5`, `last_3`), then weighting (`none`, `gentle`, `strong`). Inside a combination, forward selection is the existing algorithm on the average validation error across the three checks: each step adds the single feature that most lowers the error (candidates in catalogue order, the first of a tie wins), skipping any addition that exceeds `SET_LIMIT` or is redundant in any check; it stops when no addition lowers the displayed (two decimal) error. Across combinations the lowest displayed average error wins and the first in the fixed order breaks a tie. A combination that leaves fewer than `MIN_TRAIN_INNINGS` in some check is recorded as "too few innings" and not fitted (never happens on the committed data; a test with a thin synthetic table covers it).

Its step carries `grid`: `{cells: [{training_innings, window, weighting, features, validation_mae, checks: [{year, mae}], allowed, note}], best: {…the winning cell…}, build_up: [{feature, validation_mae}]}` for the winning cell's feature-by-feature build-up. The state keeps `forward_best` (the winning cell as an attempt with its setup and three check errors), `grid` and `validation_winner`.

**Rationale**: the brief; a single visit keeps the loop edges simple and makes the grid one readable event.

## Decision 11: The winner and the final test

**Decision**: `grid_search` ends by setting `validation_winner`: the setup (the language model's best or the grid's best) with the lower displayed average validation error; a tie goes to the language model; with no language-model attempt the grid's best wins. `final_test` reads the winner from state, refits **both** best setups on all years before Y (each with its own window, weighting and training innings, the window and ages relative to Y), scores each once on the test-population innings of Y, scores the TV projection and the know-nothing guess on the same innings (the know-nothing guess is the mean of test-population innings before Y), and reports both models with the pre-chosen winner marked. The test slice is touched only inside `final_test`, after the winner is already in state; a test replaces every value of the test year and shows nothing before `final_test` changes.

**Alternatives**: choosing the winner inside `final_test` (it would sit next to test scoring and be easy to break); a separate node (adds a stage entry and a node for a pure comparison).

## Decision 12: The language model's setup and the checks

**Decision**:
- `llm_reply.Proposal` makes `window`, `weighting`, `training_innings` and `features` optional in parsing (a missing part must reach `check_proposal` to be rejected with its own reason rather than make the whole reply "unusable"); `reason` and `finished` stay as they are. The JSON schema asked for lists all of them as required.
- `selection.check_proposal(setup_parts, tried, rolling, data)` applies the rules in this order, the first failure deciding: `missing_part`, `unknown_window`, `unknown_weighting`, `unknown_training_innings`, `unknown_feature`, `empty`, `too_many`, `already_tried` (all four parts equal, features as a set), `too_few_innings` (fewer than `MIN_TRAIN_INNINGS` in some check), `redundant` (in any check, Decision 7, plus the existing named-twice rule). Each rule has its own code and message.
- A `finished` proposal is handled as today (it ends the model's part; the setup parts are not checked).
- The prompt gains: the menus with ids and labels, the rule that all four parts are required, average final totals by year and test-population innings counts by competition and year (years before Y only), and each earlier attempt's setup with its three check errors labelled by year.
- `explore` is computed from the test-population innings in the years before Y (the model never sees the test year), replacing the training-years-only statistics.

**Rationale**: the brief. Putting the repeat rule after the menus means a malformed proposal is never compared with the tried list.

## Decision 13: The timing test

**Decision**: a pytest runs the complete grid (24 combinations) on the committed data (after the data refresh of Decision 14) through the real `grid_search` function and fails above **3.0 seconds**. Expected cost about 0.5 s (Decision 6), so a loaded machine has roughly a sixfold margin, while the naive path (about 38 s) fails it by an order of magnitude. The run's reserve in `run_budget.py` is 8 s: the grid plus `final_test` and the explanation (a scripted agent run in the tests takes about 0.2 s today) stay inside it. The test also asserts the number of combinations (24), not only the time.

## Decision 14: Refreshing the data

**Decision**: `scripts/prepare_data.py` is extended and re-run on a fresh download (network was available: the T20I zip downloaded in 14 MB and parsed here). It records `batting_team`, `bowling_team` (alias-mapped), `batting_full_member`, `bowling_full_member` and `in_test_population` per innings. The batting team is the first innings' `team`, the bowling team is the other entry of `info.teams`. For IPL and BBL both flags are 0 and `in_test_population` is 1. `--from-existing` fails clearly as it does today (it cannot add team names), by adding the new columns to the list of "needs the ball-by-ball data" columns. The manifest gains `full_members`, `team_aliases`, `absent_full_members`, and `population` (`{in, out, by_competition}`), and the script prints the non-member T20I team names (Decision 2).

Refreshing changes the data (new matches since 2026-10-04), so figures on the page move slightly; tests that compare against the file compute from the file, so they follow; fixtures with hand-written expectations are listed in `tasks.md`.

## Decision 15: Visitor-facing text

**Decision**: one typed sentence in the introduction (under the meter, no numbers): "The agent is tested on IPL and BBL innings and on T20 internationals between ICC full members." The hyperparameter explanation is the **choose-stage note** in `stage_info.py` (replacing the old "feature selection only" wording): "Two of the choices here, how many past seasons to learn from and how much recent seasons count, are hyperparameters: settings chosen before fitting, not learned from the data. This is the first app on the site to tune them; the rival tries every combination (a grid search)." The split and loop notes are built from `rolling_checks`. The setup wording in sentences ("learned from the last 5 seasons, with recent seasons counting more, using full-member and league innings only") is built in `setup_settings.setup_words` from the labels.

**Risk noted**: feature 007's SC-002 limits the visible introduction to 120 words; the new sentence adds 15. The 007 test is updated with a recorded reason if the count exceeds the limit (the current count is measured in `tasks.md` T001).

## Decision 16: The page's grid and the leaderboard

**Decision**: pure render helpers in `web/src/page/grid.ts` and `setup.ts` (Vitest-tested) used by `results.ts`: the grid is one small table per training-innings choice, rows the four windows, columns the three weightings, each cell showing its average validation error, with the best cell outlined (2 px outline plus a bold weight, not colour alone) and a caption naming the axes. Setup chips (features, window, weighting, training innings) and the three check errors labelled by year appear on every leaderboard entry. The labels come from the server (`/api/catalogue` gains `setup_menus`) so nothing typed in the page names a menu option.

## Decision 17: What else is touched

`graph.py` (node, edges, actors, stages), `graph_api.py` (nothing structural), `state.py` (new state keys and constants), `scoring.py` (the know-nothing guess and the references on the test population), `cricket_explanation.py` (the setup sentence), `data_table.py` and `data_notes.py` (columns, "Used for", population counts), `catalogue_api.py` (menus), `reference_api.py` (population-restricted figures before Y−3), `llm_fake.py` (full setups and each new rejection), `tests/fixtures` (the reuse fixture and the recipe fixture), and the e2e specs that expect the old self-loop (`play.spec.ts`, `stages.spec.ts`, `llm-run.spec.ts`, `reuse.spec.ts`).
