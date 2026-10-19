# Contract: "What the agent found" tab

## `GET /api/catalogue` (additions only)

```json
{
  "limit": 8,
  "features": [ ... unchanged ... ],
  "round_cap": 6,
  "grid_combinations": 24,
  "setup_menus": {
    "window": [{ "id": "last_10", "label": "the last 10 seasons", "short": "last 10" }, ...],
    "weighting": [{ "id": "gentle", "label": "recent seasons counting a little more", "short": "a bit more" }, ...],
    "training_innings": [{ "id": "population", "label": "...", "short": "..." }, ...]
  }
}
```

- `round_cap` is `state.ROUND_CAP`. `grid_combinations` is the product of the three menu sizes.
- `short` is non-empty and unique within its menu. Existing keys are unchanged.

## DOM (test ids)

| Element | `data-testid` |
|---|---|
| Tab heading and lead | `found-header` (no eyebrow element) |
| Sections 1 to 6 | `found-section-1` ... `found-section-6`, each an `h3` starting "1. " to "6. "; none uses `details` or a toggle |
| AI card, rival card | `contest-ai`, `contest-rival` |
| Why a rival, what's a candidate model | `contest-why`, `contest-setup` |
| Season strip and its segments | `seasons`, `season-learning`, `season-check` (one each, with `data-year`), `season-test` |
| Race chart, its text equivalent | `race-chart`, `race-text` |
| Round marks | `race-mark` with `data-round` and `data-kind` (`best`, `fitted`, `rejected`, `finished`, `failed`) |
| Lines | `race-line-ai`, `race-line-rival`, `race-line-tv` |
| Winner panel | `winner-panel` with `data-state` (`pending`, `ai`, `rival`, `tie`); link `to-final` |
| Round card, reason, candidate model chip | `round-item` (`data-outcome`), `model-reason`, `setup-chip` (unchanged meaning) |
| Rounds sentence when no AI | `rounds-none` |
| Grid tables, cells | `grid-table` (`data-innings`), `grid-cell` (`data-best`) |
| Best-cell sentence | `grid-best` |
| Ranking table and rows | `ranking`, `attempt-row` (`data-proposer`); TV line `ranking-tv` |

The old `check-error` test id and the "Each check year (runs)" column no longer exist.

## Behaviour contract

- Text from the model (`reason`, `message`, `llm_failure`) is inserted as text only.
- The tab renders from the state at the step on display; stepping back removes later data.
- Every number shown equals the corresponding state or catalogue value rounded to one decimal (counts and years as integers); gap and drop equal the difference of the displayed values.
