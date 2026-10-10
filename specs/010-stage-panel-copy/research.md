# Research: Stages Panel Copy

**Decision 1 - Constants as the sources.** `SET_LIMIT`, `ROUND_CAP`, `NO_IMPROVE_STOP` and `MARGIN_RUNS` are in `state.py`; the grid size is `len(selection.GRID)`, the product of the three menus in `setup_settings`. All five already exist, so none is invented. Alternative: a new module of copy constants (a second place to keep in step).

**Decision 2 - Notes in `stage_info.py` as f-strings.** The agreed text with the five numbers interpolated. Alternative: a template file (more machinery for eight strings).

**Decision 3 - The number of check years.** The split note says "each of the three years" and the general note names three years. If no constant gives the number of checks, define one in `season_split.py` and use it in `rolling_checks` and for the count word in the note; a test asserts they agree. Alternative: type "three" (the drift this feature exists to prevent).

**Decision 4 - `loop_note()` returns `None` on unreadable data.** The spec says send no general note rather than a sentence without years. `structure_extras` omits the key; the legend already treats a missing `general` as nothing to show.

**Decision 5 - Whole-number margin.** Print `MARGIN_RUNS` with the whole-number rule `goal.py` already uses, so a future 2.5 still reads correctly.

**Decision 6 - No note text in `stages.py`.** The shared stage set keeps names and questions only. Only stage 5's name changes there; its question and id stay.

**Decision 7 - Fixture regenerated.** `linreg-structure.json` is a copy of the real response, guarded by a pytest drift test, so it is regenerated from the running app rather than edited by hand.
