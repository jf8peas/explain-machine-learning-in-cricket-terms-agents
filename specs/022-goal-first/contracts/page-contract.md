# Contract: the main page

Section ids and test ids the build and the tests share. Names marked *(new)* do not exist today; the rest are 020/021's and keep their meaning.

## Sections, in order

| id | Content | Notes |
|---|---|---|
| `hero` | kicker, h1, lead, "▶ Start the experiment", goal card, Commentary | goal card replaces the Scoreboard card |
| `problem` | 020's problem section | gets `id="problem"` *(new id)* |
| `watch` | h2, loop strip, player controls, status line, "What makes it an agent?", the graph, Right now, round feed, closing line | the graph is not inside Commentary |
| `verdict` | locked card, or 020/021's verdict | |
| `try` | locked card, or 020's Your turn | |
| `scorebook` | cards and panel | run-dependent cards locked before a run |

## Copy fixed by the design

| Where | Text |
|---|---|
| h1 | Can an AI agent build its own prediction model and beat the TV? |
| Lead | Halfway through a T20 innings, where will it finish? The agent chooses the clues, code does the maths, and it is tested on a season it has never seen. |
| Start link | ▶ Start the experiment |
| `watch` h2 | Choose the AI, press play, and watch it work. |
| Select label | Choose the AI |
| Run line | A live run · usually under a minute · runs can differ each time |
| Status (idle) | Ready. Choose the AI and press play. |
| Status (running) | Live with {model} · {doing} |
| Status (finished) | Finished with {model} · {tries} tries · best {score} on the check seasons |
| Feed (empty) | The agent's ideas appear here, one round at a time, once you press play. |
| Closing | Best idea: {clues}, learning from {seasons}. + See how it did on {test year} ↓ |
| Legend | Purple dashed: the AI decides · Solid: code · Green: done · Ringed: happening now |
| Verdict locked (before) | Press play to see how it does. |
| Verdict locked (during) | The result appears when the agent finishes. |
| Verdict locked (body) | {test year} stays locked until the agent has chosen its model. Then it is used once, to judge it against the goal. |
| Verdict failed | The run didn't finish: {reason}. Press play to try again, or choose another AI. |
| Your turn locked | Run the experiment first. Your turn uses the model the agent builds. |
| Scorebook locked | Available after a run |
| Preview title | Can an AI agent beat the TV at predicting a T20 score? |

The words in `{…}` and every sentence that depends on data come from the server.

## Test ids

*(new)* `start-experiment`, `goal-card`, `goal-sentence`, `goal-tv-figure`, `goal-target-figure`, `goal-judged`, `result-strip`, `player-status`, `player-announce`, `run-line`, `play-button`, `watch-again`, `run-message` (`role="alert"` for refusals and failures), `agent-explainer`, `agent-legend`, `right-now`, `right-now-step`, `right-now-doing`, `right-now-round`, `right-now-best`, `verdict-locked`, `try-locked`, `scorebook-locked-note`.

Kept: `model-select`, `model-note`, `round-feed`, `round-item`, `model-reason`, `round-live-region`, `verdict-title`, `verdict-bars`, `scorebook-card-*`, `hero-title`, and the graph component's ids.

Removed: `live-toggle`, `live-panel`, `live-start`, `run-label`, `scoreboard-agent` and the other Scoreboard-card ids, `watch-button` (replaced by `play-button`).

Graph nodes (inside the component): `data-state` is `idle`, `running`, `done` or `error`; a running node also has `aria-current="step"`.

## Focus and announcements

- "▶ Start the experiment" (a link to `#watch`) scrolls to the player and focuses `model-select`.
- `player-status` is the shown status line and is not a live region. `player-announce` is a visually hidden `role="status"` `aria-live="polite"` element that speaks phase changes and changes between an AI step and a code step, never every node.
- `round-live-region` (020) keeps its per-round announcement.
- `run-message` is `role="alert"`; the Right now card and the graph are not live regions.
- Locked cards are real elements with the title as a heading, a lock icon marked `aria-hidden`, and (for Your turn) a link to `#watch`.

## Regions (021)

New text follows 021: the goal card, the agent explanation and the locked cards are Scoreboard text; the explanation's Commentary, the hero's Commentary and the Right now card's doing line (a code-worded sentence from the server) use `data-region` as before; the agent's reasoning in the feed keeps `data-region="reasoning"`.
