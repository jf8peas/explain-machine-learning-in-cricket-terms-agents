# Data model: Hero Chart Zoom

Nothing new is fetched or stored. These are the pure layout types and functions the chart is built from. All figures come from `/api/reference` (see [plan.md](plan.md) "Data the chart uses").

## `worm-layout.ts` (pure)

```ts
export const NARROW_BELOW = 560;                       // unchanged
export type Mode = "wide" | "narrow";                  // was "side" | "key"
export function layoutMode(cardWidth: number): Mode;   // was labelMode
export function yAxis(values: number[]): YAxis;        // unchanged
export function spreadLabels(wished: Wish[], gap: number, top: number, bottom: number): Record<string, number>;   // unchanged

export interface ZoomRange { lo: number; hi: number; ticks: number[] }
/** actual, tv, nothing are the three totals at 20 overs; averageMiss is the TV's usual miss. */
export function zoomRange(values: { actual: number; tv: number; nothing: number }, averageMiss: number): ZoomRange;
// `nothing` is the know-nothing guess rounded to a whole number (the value the label "Know-nothing 162" shows), so the label, the marker and the range all use the same number
export const ZOOM_PAD = 2;                             // runs of room beyond the nearest value before rounding to a 10
export const ZOOM_STEP = 10;                           // tick spacing

/** "<n> runs short", "<n> runs over", "1 run short|over" or "spot on", from the whole-number total and TV projection. */
export function missWords(actual: number, tv: number): string;
```

`zoomRange` rule: `lo = floor((min − ZOOM_PAD) / 10) × 10`, `hi = ceil((max + ZOOM_PAD) / 10) × 10` where `min` and `max` are over `{actual, tv, nothing, tv − averageMiss, tv + averageMiss}`; if `hi − lo < 10` then `hi = lo + 10`; `ticks` every 10 from `lo` to `hi` inclusive. The brief's three-argument form `zoomRange(values, averageMiss, tvProjection)` is the same function with `tv` carried in `values`.

## `worm.ts`

```ts
export interface WormInput { example: Example; averageMiss: number; averageTotal: number; chartText: string }   // unchanged

export interface Pt { x: number; y: number }
export interface Panel { x: number; y: number; width: number; height: number }

export interface LinePlan {
  geometry: { width: number; height: number; left: number; right: number; top: number; bottom: number; tick: number; note: number; dot: number };
  axis: YAxis;
  overX: (over: number) => number;                      // evenly spaced: left + over/20 × (right − left)
  context: Panel;                                       // overs 0 to 10: the grey band
  prediction: Panel;                                    // overs 10 to 20: the surface area
  contextLine: Pt[];                                   // 0 to 10 (context-line colour)
  actualLast10: Pt[];                                   // 10 to 20 (text colour, solid)
  wickets: { over: number; pt: Pt; band: "context" | "prediction" }[];
  dot: Pt; dotLabel: string;                            // the score at 10 overs, "82/2"
  finishX: number; actual: Pt; tv: Pt; nothing: Pt;     // markers on the finish line at 20 overs
  lens: { x: number; top: number; bottom: number };     // spans the zoom range on the line graph's y scale, clamped to the plot (the range can pad past the axis maximum)
  headings: { context: [string, string]; prediction: [string, string] };
}

export interface ZoomPlan {
  card: Panel;                                          // the zoom's rectangle
  range: ZoomRange;
  ruler: { x: number; top: number; bottom: number; ticks: { value: number; y: number }[] };
  scale: (value: number) => number;                     // value → y on the ruler
  markers: { actual: Pt; tv: Pt; nothing: Pt };
  usualMiss: { x: number; top: number; bottom: number; text: string };   // TV ± averageMiss on `scale`; text "TV's usual miss, ±22.5"
  bracket: { x: number; top: number; bottom: number; words: string; direction: "short" | "over" | "spot on" };
  labels: { id: "actual" | "tv" | "nothing"; text: string; y: number }[];  // placed by spreadLabels, never overlapping
  agent: Panel;                                         // "The agent: ?" over "where will it land?"; below the lowest label, above the key
  key: Panel;
  title: [string, string];                              // "ZOOM ON THE FINISH", "total after 20 overs"
}

export interface Plan {
  mode: Mode;
  line: LinePlan;
  zoom: ZoomPlan;
  joins: { x1: number; y1: number; x2: number; y2: number }[];   // the two faint lens lines; [] in narrow mode
  layout: "split" | "stacked";                                   // wide = one SVG split 60/40; narrow = two SVGs stacked
  shares: { line: number; zoom: number };                        // 0.60 and 0.39 in the wide plan (the gap is the rest)
}

export function wormPlan(input: WormInput, mode: Mode): Plan;          // pure and deterministic
export function drawWorm(plan: Plan, chartText: string): SVGSVGElement[];   // one SVG wide, two narrow
export function mountWorm(card: HTMLElement, host: HTMLElement, input: WormInput): void;
```

Rules the plan guarantees (and the tests check):

| Rule | Check |
|---|---|
| Overs evenly spaced | `overX(o+1) − overX(o)` is the same for every `o` |
| Over 10 halfway | `overX(10) = (left + right) / 2` |
| Labels apart | for any inputs, consecutive `zoom.labels` are at least the label gap apart and inside the ruler band |
| Agent box clear | `agent` overlaps no label box and not `key`; it lies between the lowest label and the key |
| Usual-miss bar exact | `usualMiss.top = scale(tv + averageMiss)` and `usualMiss.bottom = scale(tv − averageMiss)` |
| Range contains everything | every value and the whole miss band lie inside `[range.lo, range.hi]` with at least `ZOOM_PAD` runs to spare |
| Bracket words | `bracket.words = missWords(actual, tv)`; the bracket spans `scale(tv)` to `scale(actual)` |
| Panel split | wide: `line` panel is 60% of `geometry.width`, `zoom.card` 39%, gap 1% |
| Wickets in their band | wickets at overs 1 to 9 are `context` (context-line colour), at 11 to 19 `prediction` (text colour); none at over 10 or 20 |
| Deterministic | same `(input, mode)` gives an identical plan (deep equality) |

## Server (`hero_text.py`)

```python
def miss_words(actual: int, tv: int) -> str: ...         # same rule and wording as missWords; cases in web/tests/fixtures/miss_words_cases.json
def caption(example, tv_average_miss) -> str: ...        # new wording (plan.md "Server caption")
def chart_text(example, tv_average_miss, average_total) -> str: ...   # existing sentences plus the zoom
```

`web/tests/fixtures/miss_words_cases.json`: `[{"actual": 186, "tv": 164, "words": "22 runs short"}, {"actual": 150, "tv": 171, "words": "21 runs over"}, {"actual": 180, "tv": 180, "words": "spot on"}, {"actual": 181, "tv": 180, "words": "1 run short"}, {"actual": 179, "tv": 180, "words": "1 run over"}, ...]`.
