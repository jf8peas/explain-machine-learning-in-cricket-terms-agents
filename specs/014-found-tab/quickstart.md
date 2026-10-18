# Quickstart: "What the agent found" tab

From `apps/linear_regression`:

```bash
# backend (catalogue additions)
python -m pytest tests/test_api_catalogue.py tests/test_setup_settings.py

# whole backend suite
python -m pytest

# front end
cd web
npm run test          # Vitest: found-* unit tests and the existing ones
npx playwright test   # fake model: found.spec.ts and the updated existing specs
```

Look at the page: start the app as in earlier features, open Working, press Play, then open **What the agent found**. Step the replay back and forward: the rival line, grids and winner panel appear only once the grid-search step is reached. Check light and dark themes and a 360 px wide window (no sideways page scroll; the ranking table scrolls inside its own box).

Checks to make by eye: the six numbered sections in order; the AI's reasons exactly as written; no "Each check year" column; colours always beside words or shapes.
