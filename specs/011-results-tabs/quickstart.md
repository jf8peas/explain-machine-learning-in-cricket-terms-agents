# Quickstart: verify the results tabs

1. From `apps/linear_regression/web`: `npm run test`, then `npx playwright test` (the existing suites, updated, plus `tabs.spec.ts`).
2. Open the app: the Working tab shows with Data first in the bar; Working holds the intro, picker, graph and the summary sentence, and none of the results.
3. Press Play. Watch the summary line follow the leader and the What the agent found tab gain a marker; open it mid-run and see it fill in.
4. Let the replay finish: the page switches to What the agent found once, focus is on its heading, and The final test and Try your own innings have markers; follow the link to The final test.
5. Step back and forward, replay from the timeline: no further switch. Start another run: the result tabs go back to their not-ready sentences and you stay where you are.
6. At phone width: all five tabs reachable by scrolling the tab bar; the page does not scroll sideways.
