# Quickstart: Machine Learning Stages on Every Step

Run from `apps/linear_regression/` unless noted. No new setup, dependency or environment variable.

## Run locally

With the fake model (no key, no network):

```bash
LLM_PROVIDER=fake RATE_LIMIT_STORE=memory uv run uvicorn api.index:app --port 8000
cd web && npm install && npm run dev
```

Open `http://localhost:5173/`. See `specs/004-llm-feature-selection/quickstart.md` for running with a real model.

## What to look at

1. **Before a run**: every node has a small numbered badge at its bottom-left corner, in the stage's colour. Bands group neighbouring nodes of one stage, each labelled with the stage number and name. Choose the setup has two bands, with Fit the model between them. A dashed, muted "done beforehand" item sits ahead of `load_data`, joined by a dotted line.
2. **The legend** (right column; a row of numbered chips on a phone) lists the eight stages in order with colour, number, name and question. The note under it explains the loop and names the real training, validation and test years. Choose the setup says it is feature selection only in this app.
3. **Highlight**: select a stage (mouse, touch, or Tab then Enter or Space). Its nodes and band stay bright and the rest dim. Select it again, or "All", to clear.
4. **Press Play**: the active node stays clearly marked. Select a stage mid-run; the run carries on and the active node is never dimmed. The selection survives Reset and a new run.
5. **Detail panel**: the current step's stage badge, name and question appear beside its name and actor pill.
6. **Timeline**: each entry has its stage badge, so you can see the run move between stages, including back and forth between 5 and 6.
7. **Loop**: after the agent returns to Fit the model, the edges between Fit the model and the Choose the setup steps become heavier with a "round N" pill. Step back and the count falls; Reset clears it.
8. **Done-beforehand item**: select it (click, tap, or Enter). A panel shows what the preparation script excluded and why, and the columns it created, with a link to the Data tab. It never lights up during a run and is not in the timeline.
9. **Themes and motion**: check light and dark; with reduced motion on, nothing about stages relies on animation.
10. **Colour removed**: view the page in greyscale (browser or OS setting). The numbers still tell the stages apart.

## Manual check: SC-001 (needs a person)

Ask someone with no machine learning background to watch one full run. Afterwards, show them any three steps and ask them to name each one's stage, then ask which stage fits the parameters and which chooses the setup. Record the outcome in `specs/005-ml-stages/checklists/requirements.md`.

## Reuse check

The second fixture graph (`web/tests/fixtures/other-structure.json`) has its own stages, a loop, a note and an item. `npx playwright test reuse` shows the legend, badges, bands, highlight, loop emphasis and item for it with no visualiser change.

## Tests

```bash
uv run pytest
cd web && npm test
cd web && npx playwright test      # starts the API with the fake model and the in-memory store
cd web && npm run build
```
