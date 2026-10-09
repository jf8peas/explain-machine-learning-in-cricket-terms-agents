# Quickstart: A Lighter Goal Section

Run from `apps/linear_regression/` unless noted. No new setup, dependency or environment variable.

## Run locally

With the scripted model (no key, no network). On this machine start the API with `python -m uvicorn`, because the `uvicorn.exe` launcher is blocked by Windows policy:

```bash
LLM_PROVIDER=fake RATE_LIMIT_STORE=memory uv run python -m uvicorn api.index:app --port 8000
cd web && npm install && npm run dev
```

Open `http://localhost:5173/`. The page is the same as before apart from the introduction at the top.

## What to look at

1. **The lead line** under the title: one sentence saying the agent tries to beat the TV projected score by missing by 3 runs less on average (the 3 comes from the server).
2. **The miss meter**: a number line of average miss, better on the left. Three marks, each with a name and a value: the know-nothing guess (29.4), the TV projection (21.8) and the goal (18.8). The stretch of the line up to the goal is shaded green. The caption gives the years and the innings (2005 to 2024, 4,036 innings), and the footer says the goal and that the latest calendar year is held out.
3. **The five chips**: Agent, Language model (in the accent colour), Code, Linear regression, Rival.
4. **The two closed sections**: open "How this works, in full" to see the two original paragraphs, and "Full figures for the two simple guesses" to see the headline sentence, the table and the note.
5. **Change the numbers**: temporarily change `MARGIN_RUNS` in `backend/linreg/state.py` and restart the API: the lead line, the goal's value, the marks and the scale all follow, with no change to the page.
6. **Dark mode**: switch your system to dark (or use the browser's rendering emulation): the meter, chips and sections use the page's dark colours.
7. **A phone**: narrow the window to 360 px (or use device emulation). The page must not scroll sideways, the "better" and "worse" labels disappear, the values get smaller, the goal's name and value sit above the line and the other two below it, and no name or value overlaps another.
8. **The error states**: stop the API and reload (the lead line, meter and goal are hidden and a short message shows), and with the data file temporarily renamed (the lead line and the goal show, the meter and the second section do not).
9. **Greyscale**: the marks are told apart by their names and shapes (a dot for each reference, a line for the goal), not by colour.

## Manual check: SC-001 (needs a person)

Show someone with no machine learning background the page for a few seconds without opening anything, then ask what the agent has to beat and by roughly how much. Record the outcome in `specs/007-goal-section-redesign/checklists/requirements.md` notes.

## Tests

```bash
uv run pytest
cd web && npm test
cd web && npx playwright test      # starts the API with the fake model and the in-memory store
cd web && npm run build
```
