# Data Model: Cricket Silhouettes

No stored or server data. The feature adds styling tokens, two static shape files and two decorative elements.

## Silhouette shape files (static)

| File | Size | Natural ratio | Used by |
|---|---|---|---|
| `web/src/page/silhouettes/bowler-silhouette.svg` | 630 × 1013 | 0.622 | hero band |
| `web/src/page/silhouettes/batter-silhouette.svg` | 838 × 870 | 0.963 | chart card |

Both are alpha masks (black shape, detail in alpha), copied unchanged from `design/assets/`. Colour is never in the file.

## Tokens (`theme.css`)

| Token | Value | Notes |
|---|---|---|
| `--silhouette` | `var(--text)` | follows the theme |
| `--silhouette-alpha` | `.07` | batter strength |
| `--silhouette-blend` | `multiply` (light), `screen` (dark) | batter blend |
| `--silhouette-on-dark` | `#cbd5e1` | fixed; the band is dark in both themes |
| `--silhouette-on-dark-alpha` | `.09` | bowler strength |

## Bowler sizing constants (`silhouette.css`, from calibration)

| Range | Properties | Meaning |
|---|---|---|
| stacked / two columns / capped | `--bowler-k`, `--bowler-b` | height = `k × 100cqw + b`; `k` unitless, `b` in px |
| crossover | one container-query width | where his width equals the band's |

Fixed: top 30 px; width = height × 630 / 1013; focal point 0.3 of his width.

## Elements

| Element | Where | Attributes |
|---|---|---|
| bowler | first child of `#hero` | `class="silhouette silhouette-bowler"`, `aria-hidden="true"`, `data-testid="silhouette-bowler"`, no children |
| batter | in `div.worm-stage`, after the chart host | `class="silhouette silhouette-batter"`, `aria-hidden="true"`, `data-testid="silhouette-batter"`, no children |

State: none. Nothing is saved, nothing is sent, nothing changes with the run.
