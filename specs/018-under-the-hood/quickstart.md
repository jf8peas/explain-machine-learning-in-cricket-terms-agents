# Quickstart: Under the Hood page

1. Stop anything on port 8000. In `apps/linear_regression` run `uv run python -m uvicorn api.index:app --port 8000`; in `apps/linear_regression/web` run `npm run dev` (it proxies `/api`).
2. Open `http://127.0.0.1:5173/`. On every tab, check that "Under the hood" and "Feedback" sit at the right of the breadcrumb row, and wrap under it at phone width.
3. Click "Under the hood" (it opens `/under-the-hood.html`). Check all sections, the six jump links, "Back to the app" at the top and in the footer, and Feedback opening a new tab.
4. In Part 3, check seven closed panels, each opening and closing alone, and "Expand all" / "Collapse all" following their state. Tab through with the keyboard and press Enter and Space on a header.
5. Compare the live figures with `http://127.0.0.1:8000/api/data` (`summary`) and `/api/reference`. Block those two requests in the browser's network panel and reload: the text stays and figures read "not available right now".
6. Check light and dark themes, a 360 px window (no sideways scroll except inside tables) and "reduce motion" (the chevron does not turn smoothly).
7. Run the suites in `web/`: `npm test` (Vitest) and `npm run e2e` (Playwright). `npm run build` must write both `dist/index.html` and `dist/under-the-hood.html`.
