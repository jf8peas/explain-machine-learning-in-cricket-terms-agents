# Goal first: the reader states the goal, presses play, watches the graph, sees the result

Design drafted 2026-10-22 in Claude Design, on top of features 020 (simpler pages) and 021 (consistent terminology) as
committed (`bf9d390`).

Files:

- `canvas/AppPlay.dc.html`: the main page, goal first. Open it in a browser-based canvas viewer or read it as markup;
  its Play button simulates a live run (timings and figures are from a fake-model run).
- The canvas itself (private to John): https://claude.ai/artifact/4M3FePB6WaY3ZZizw2v8N6, row "The app, goal first".

**This file is the specification; where it and the canvas differ, this file wins.** As in 020, every number and
data-dependent sentence comes from the backend, the build reuses the shipped classes and `theme.css` tokens (light and
dark), and every visible word follows 021's glossary.

## The idea

Today the page opens on the result of a recorded run, and the recorded run plays by itself. Instead, the reader:

1. reads the **question and the goal**,
2. **chooses the AI and presses play**: a real live run, nothing recorded,
3. **watches the graph** work through it, step by step,
4. **sees the result**, which stays locked until their run finishes.

Everything else on the page (header, The problem, the loop strip, Commentary panels, the verdict's content, Your turn,
the Scorebook, the footer, the "How this app was built" page) stays as 020 and 021 left it, except where listed below.

## What changes

1. **The recorded run is removed entirely**: the file, the script that makes it, the rewording script, the code that
   loads and autoplays it, the "Recorded {date} · {model}" label, the "From a recorded run…" line, and their tests.
2. **The hero states the question and the goal**, not a result.
3. **Play lives in Watch it think**: a model picker and a Play button at the top of the player. The separate
   "Run it live with your choice of AI" toggle and panel are removed.
4. **The graph is shown by default**, lit up as the run moves, with a "What makes it an agent?" explanation and a legend.
5. **The verdict, Your turn and the Scorebook are locked** until the reader's run finishes.

## 1. Hero

- Kicker **AN AI AGENT EXPERIMENT** (unchanged).
- h1, fixed copy: **"Can an AI agent build its own prediction model and beat the TV?"**
- Lead: **"Halfway through a T20 innings, where will it finish? The agent chooses the clues, code does the maths, and it
  is tested on a season it has never seen."**
- One button: **▶ Start the experiment**, linking to `#watch` and moving focus to the "Choose the AI" select.
  (The "Try your own innings" link is removed from the hero; it needs a finished run.)
- **The goal card** replaces the Scoreboard card:
  - Kicker **THE GOAL**.
  - **"Beat the TV's projection by at least {MARGIN_RUNS} runs on average."**
  - Two figures: **{TV's usual miss}** "runs: how far out the TV usually is" (the past-innings figure `/api/reference`
    already serves, 22.5 today) and **{MARGIN_RUNS}+** "runs closer: what the agent must do".
  - "Judged on {n} innings from {test year}, a season the agent never sees while it works." (counts from the data).
  - After a run finishes, a result strip at the foot of the card, worded by the backend's agent verdict (020): for
    example **"Result: goal reached.** The agent was 17.9 runs out, the TV 21.4. See the verdict ↓" (link to
    `#verdict`). It disappears again on reload.
- Hero Commentary (Show me everything): how good the TV is on past innings (as now); **why a season it never sees**
  ("Any model looks good on the data it chose from. {test year} stays locked until the agent has picked its model,
  then it is used once."); who does what (as now).
- At 390 × 664 the first screen shows the h1, the goal sentence and the button.

## 2. The problem

Unchanged from 020, with `id="problem"`.

## 3. Watch it think (`#watch`)

- h2 becomes **"Choose the AI, press play, and watch it work."** The loop strip and its Commentary are unchanged.
- **Player controls** (top of the player, indigo tint):
  - **Choose the AI**: a labelled `<select>` filled from `/api/models` exactly as 020's live panel was (names and notes
    only, the default marked "(default)" and selected first, the chosen note linked by `aria-describedby`). Disabled
    while a run is going.
  - **▶ Play** (primary, at least 48 px tall). While running: **Running…**, disabled. After a run: **▶ Run again**
    (a new live run with the chosen model) and **Watch it again** (replays the finished run from the events already
    received; no language-model call, no run limit used).
  - Under them: "A live run · about {run length} · runs can differ each time", with the length read from settings.
  - The gate's refusal ("You've used your {n} live runs for this hour. Try again in {m} minutes." and the daily-limit
    message) shows under the button, as a `role="alert"` message; the page stays usable.
- **Status line** (polite live region): "Ready. Choose the AI and press play." / "Live with {model} · {what is
  happening now}" / "Finished with {model} · {tries} tries · best {score} on the check seasons". The 020 per-round
  live-region announcement is kept; the status line must not announce every node.
- **What makes it an agent?** (h3, Scoreboard, above the graph):
  > A language model working in a loop: it looks at the results so far, decides what to try next, and stops when it
  > can't do better. Here the AI makes those decisions in the purple steps; code does everything else.
  - Legend: **Purple dashed: the AI decides** · **Solid: code** · **Green: done** · **Ringed: happening now**.
  - Commentary:
    > Built with LangGraph. Each box is a node, a Python function, and each arrow is an edge. Some edges are
    > conditional: after `check_proposal` and `evaluate`, the graph reads its state and chooses where to go next: back
    > to `propose_features`, on to `fit_model`, or out to the yardstick. The state carries the data, every idea tried
    > and every score from one step to the next.
- **The graph** (020's shared four-row component) is shown by default, no longer inside Commentary:
  - During a run the node being worked on is ringed (3 px accent), nodes already done take the green "done" style,
    language-model nodes keep the dashed purple style. After the run every visited node shows done and none is ringed.
  - **Right now** card beside it (stacked below on a phone): Step (node name), Doing (a plain-words line per node,
    from the backend with the structure, e.g. "The AI is choosing its clues", "Code fits the regression", "Unlocking
    {test year} and scoring once"), Round ("2 of up to 6" or "—"), Best so far.
  - The 8 ML stages legend is shown only with Show me everything.
  - Back, Step, Reset and Speed: available after a run, under the graph, when Show me everything is on (they step
    through the finished run's events, as 020's full-graph panel did).
- **Round feed** under the graph: unchanged from 020 (idea, the agent's reasoning as written, score, status; settings
  in Commentary). Before a run: "The agent's ideas appear here, one round at a time, once you press play."
- After the run: "Best idea: {clues}, learning from {seasons}." and **See how it did on {test year} ↓** (to `#verdict`).

## 4. The verdict (`#verdict`)

- **Locked** until the run's final test arrives: a dashed card with a lock icon, the title **"Press play to see how it
  does."** (before a run) or **"The result appears when the agent finishes."** (during), and "{test year} stays locked
  until the agent has chosen its model. Then it is used once, to judge it against the goal."
- When the final test arrives it unlocks with 020/021's content unchanged; the agent's bar label adds the model name:
  "AI agent ({model})".
- A run that fails or is stopped part-way leaves it locked, with "The run didn't finish: {reason}. Press play to try
  again, or choose another AI." The no-language-model case keeps 020's behaviour.

## 5. Your turn (`#try`)

Locked until a run finishes: "Run the experiment first. Your turn uses the model the agent builds." with a link to
`#watch`. Then unchanged from 020.

## 6. The Scorebook

Cards stay visible; until a run finishes, the run-dependent cards (Every model tried, The agent graph step by step)
show "Available after a run" and do not open. The data and How this app was built work as now.

## Session behaviour

- Nothing is stored: a reload or a return visit starts at the idle state (020's clarification still holds).
- Show me everything, its persistence and `?view=everything` are unchanged.
- Old anchors keep working; `#verdict` and `#try` land on the locked cards before a run.

## Preview tags and the other page

- The fixed preview tags become the question: title "Can an AI agent beat the TV at predicting a T20 score?", with a
  description inviting the reader to choose an AI and watch it try.
- "How this app was built": remove every mention of a recorded run; otherwise unchanged.

## Tests and limits

- Every check that used the recorded run (021's banned-term check, 020's word count, the first-screen check) runs on a
  finished fake-model live run instead.
- Word limits: simple view ≤ 500 words both before a run and after a fake-model run (excluding the agent's quoted
  reasoning); everything open ≤ 1,200.
- 390 × 664: h1, goal sentence and Start button visible without scrolling; no horizontal scroll; 44 px targets.

## Out of scope

The agent's nodes, edges, prompts and scoring; the run gate's logic; the data; the recipe-agent app; the main site.

## Open questions

1. **Run limits for the LinkedIn launch.** Every visit now costs a live run. Today: 5 per visitor per hour, 300 a day
   site-wide. At the Balanced model's worst case (about $0.03 a run), 1,000 a day is about $30. Keep, raise, or make
   the daily limit an environment setting the owner changes on launch day (it already is: `RUN_LIMIT_PER_DAY`)?
2. Should **Watch it again** keep 020's ❚❚ Pause, or is replay short enough to go without?
