# Data Model: Under the Hood page

No stored data and no new route. Two read-only inputs and one in-memory state.

## Inputs (existing responses)

| Source | Fields used |
|---|---|
| `GET /api/data` | `summary.headline[]` (labels "Innings", "Dates", "Downloaded from Cricsheet"); `summary.sections[]` titled "Innings per competition", "Test population" and "Excluded, and why" (each `rows[]` of `{label, value}` display strings) |
| `GET /api/reference` | `training.first_year`, `training.last_year`, `training.innings`; `figures.know_nothing.average_miss`, `figures.broadcaster.average_miss`, `figures.broadcaster.bias` (signed; negative means too low); `goal.margin_runs`. All may be `null` when the server sets `message` |

## LiveFigures (page-side, built by `figures.ts`)

Every value is a string ready for `textContent`, or absent.

| Key | From |
|---|---|
| `totalInnings`, `dateRange`, `downloaded` | headline rows |
| `competitions[]` (`name`, `innings`) | "Innings per competition" rows |
| `testPopulation`, `outsidePopulation` | "Test population" rows "In the test population" and "Outside it" |
| `exclusions[]` (`label`, `count`, `explanation?`) and `excludedTotal` | "Excluded, and why" rows plus the page's explanation map |
| `refFirstYear`, `refLastYear`, `refInnings`, `knowNothingMiss`, `tvMiss`, `tvBias`, `tvBiasWords`, `goalMargin` | reference |

Rules: a missing section or row leaves its keys absent; absent keys render "not available right now"; zero-count exclusion reasons are never served so never shown; a reason with no explanation keeps its label and count only; `excludedTotal` is the sum of the served counts and is absent if any count does not parse.

## PanelState

`boolean[7]`, all `false` on load. `toggle(i)` flips one; `setAll(open)` sets all; derived `allOpen` (all seven true) drives the Expand all / Collapse all label. Not persisted.
