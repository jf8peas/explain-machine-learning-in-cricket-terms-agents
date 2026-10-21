# Quickstart: Who Built This

1. In `apps/linear_regression/web` run `npm run dev` (start the API server as in the feature 018 quickstart if you also want the live figures; the credits need no data).
2. Open `http://127.0.0.1:5173/under-the-hood.html`. Check there are seven jump links and that "Who built this" moves to the last section.
3. Check the section: kicker, "John Fong", bio, "View LinkedIn profile →"; then the card "Who's testing it" with "Alesja Tanabe", her bio and her link. Compare the copy and both addresses with `design/README.md`.
4. Click each link: LinkedIn opens in a new tab. Tab through: both links show a focus outline and come after the stage panels and before "Back to the app".
5. Check the footer shows "Built by John Fong · Tested by Alesja Tanabe" above the Cricsheet line.
6. Check light and dark themes and a 360 px window (no sideways scroll). Open the main page: it is unchanged, with no Author link.
7. In `web/` run `npm test`, `npm run e2e` and `npm run build`.
