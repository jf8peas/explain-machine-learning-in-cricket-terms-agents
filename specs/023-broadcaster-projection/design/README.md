# The broadcaster's projected score: a sharper question and one name for the yardstick

Design drafted 2026-10-23 in Claude Design, on top of feature 022 as committed (`a166173`).

Files:

- `canvas/AppPlay.dc.html`: the main page with the new hero question and the new wording (visual reference only).
- The canvas itself (private to John): https://claude.ai/artifact/4M3FePB6WaY3ZZizw2v8N6, row "The app, goal first".

**This file is the specification; where it and the canvas differ, this file wins.** As before, every number and
data-dependent sentence comes from the backend, and every visible word follows feature 021's term list.

## 1. The hero question

| | Now (022) | New |
|---|---|---|
| h1 | Can an AI agent build its own prediction model and beat the TV? | **Can an AI agent build a regression model that beats the broadcaster's projected score?** |
| Lead | Halfway through a T20 innings, where will it finish? The agent chooses the clues, code does the maths, and it is tested on a season it has never seen. | **Halfway through a T20 innings, where will it finish? The agent chooses the clues, code does the maths, and it's tested on a season it has never seen.** |
| Page `<title>` and preview title | Can an AI agent beat the TV at predicting a T20 score? | **Can an AI agent beat the broadcaster's projected score?** |

The preview description keeps 022's meaning (choose an AI and watch it try), reworded with "broadcaster".

## 2. One name: the broadcaster's projection

"TV" is replaced by "broadcaster" everywhere a visitor can see or hear it, on both pages, at every level (Scoreboard,
Commentary, Scorebook), in charts, tables, aria-labels, live-region lines, the "Right now" step lines, page titles and
preview tags.

Feature 021's term list gains the new names; it stays the single source:

| Term id | Plain term (Scoreboard) | Short form (in running text, labels and tiles) | Technical term (Commentary, Scorebook) |
|---|---|---|---|
| `tv` (id unchanged) | **broadcaster's projection** | **the broadcaster** | run rate × 20 overs |

Examples of the change:

| Where | Now | New |
|---|---|---|
| Goal card | Beat the TV's projection by at least 3 runs on average. | Beat the broadcaster's projection by at least 3 runs on average. |
| Goal card figure | runs: how far out the TV usually is | runs: how far out the broadcaster usually is, on past innings ({first year}–{last year}) |
| Result strip | The agent was 17.9 runs out, the TV 21.4. | The agent was 17.9 runs out, the broadcaster 21.4. |
| The problem h2 | The TV projection is usually about 22 runs out. | The broadcaster's projection is usually about 22 runs out. |
| Problem tile | TV said | Broadcaster said |
| Verdict h2 | … the agent beat the TV by 3.5 runs. | … the agent beat the broadcaster by 3.5 runs. |
| Bars, closeness | TV projection | Broadcaster's projection |
| Rule of thumb | Take the TV projection, then add … | Take the broadcaster's projection, then add … |
| Your turn | See the agent's prediction next to the TV's. · TV: 164 | … next to the broadcaster's. · Broadcaster: 164 |
| Right now line | Scoring the TV and the average-total guess | Scoring the broadcaster's projection and the average-total guess |
| Hero Commentary | How good is the TV? … The TV guesses too low … | How good is the broadcaster? Its projection … The broadcaster guesses too low … |
| Run-by-over chart | the TV's straight line | the broadcaster's straight line |

Grammar: "the broadcaster" is the short form for running text ("beat the broadcaster", "the broadcaster 21.4");
"broadcaster's projection" is the name of the method (bars, tables, keys, card titles). Backend sentence builders take
both forms from the term list rather than adding "'s" themselves.

## 3. Language-model wording

The reword prompt for `write_in_cricket_terms` contains an example that says "the TV". Its example wording changes to
"the broadcaster" (wording only; the prompt's structure, rules and facts are unchanged), so a live model's reworded
takeaways use the new name instead of being rejected by 021's reply check and falling back.

## 4. Keeping it

- Feature 021's banned-term list gains **"TV projection"**, **"the TV"** and the standalone word **"TV"** (any case,
  word-bounded), with the agent's quoted reasoning still exempt.
- Internal identifiers keep "tv" (term id `tv`, fact names such as `tv_gap`, CSS classes, test ids, state keys).

## Out of scope

Everything else on both pages; the agent's nodes, edges and scoring; the run gate; the data.
