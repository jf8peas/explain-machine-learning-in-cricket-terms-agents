// Watch it think (features 020 and 022): nothing plays by itself; the reader presses Play and the run streams in. The round feed shows
// the agent's own reasoning exactly as written; "Watch it again" replays the finished run with no run request; the graph is shown by
// default, and with Show me everything it has Back, Step, Reset and Speed once a run has finished.
import { readFileSync } from "node:fs";
import { finishRun } from "./helpers";
import { expect, test } from "./fixtures";
import type { Page } from "./fixtures";

// The scripted fake run is deterministic, so its rounds are what a live run with the default AI shows.
const fakeRunFile = () => JSON.parse(readFileSync("tests/fixtures/fake-run.json", "utf8"));
const stateOf = () => Object.assign({}, ...fakeRunFile().events.map((e: { changes: object }) => e.changes));
const roundsOf = () => stateOf().rounds as { round: number; reason: string; outcome: string }[];

async function open(page: Page, query = "?interval=40") {
  await page.goto(`/${query}`);
  await expect(page.getByTestId("hero-title")).toBeVisible();
}
const rows = (page: Page) => page.getByTestId("round-item");

function countRunRequests(page: Page) {
  let n = 0;
  page.on("request", (r) => { if (new URL(r.url()).pathname === "/api/run") n++; });
  return () => n;
}

test("the section has its kicker, heading and the loop strip", async ({ page }) => {
  await open(page);
  await expect(page.locator("#watch .kicker").first()).toHaveText("WATCH IT THINK");
  await expect(page.locator("#watch-title")).toHaveText("Choose the AI, press play, and watch it work.");
  const pills = await page.getByTestId("loop-strip").locator("li").allTextContents();
  expect(pills).toEqual(["1 · Agent proposes clues", "2 · Code checks", "3 · Code fits a regression", "4 · Code scores it", "↺ repeat until no better"]);
  await expect(page.getByTestId("loop-strip").locator("li.ai")).toHaveText("1 · Agent proposes clues");
});

test("nothing plays by itself: no round and no run request until Play is pressed", async ({ page }) => {
  const requests = countRunRequests(page);
  await open(page);
  await page.getByTestId("player").scrollIntoViewIfNeeded();
  await page.waitForTimeout(1500);
  await expect(rows(page)).toHaveCount(0);
  expect(requests()).toBe(0);
  await finishRun(page);
  expect(requests()).toBe(1);
});

test("every round shows its idea, the agent's own reasoning exactly as written, a score and one status", async ({ page }) => {
  await open(page);
  await finishRun(page);
  await expect(rows(page)).toHaveCount(roundsOf().length);
  const expected = roundsOf();
  for (const [i, round] of expected.entries()) {
    const row = rows(page).nth(i);
    await expect(row).toContainText(`ROUND ${round.round}`);
    await expect(row.getByTestId("round-idea")).not.toBeEmpty();
    if (round.reason) expect(await row.getByTestId("model-reason").evaluate((el) => el.textContent)).toBe(round.reason);
    await expect(row.getByTestId("round-status")).toHaveCount(1);
    if (round.outcome === "fit") await expect(row.getByTestId("round-score")).toHaveText(/^\d+\.\d$/);
    else await expect(row.getByTestId("round-score")).toHaveCount(0);
  }
  const statuses = await rows(page).evaluateAll((els) => els.map((e) => e.getAttribute("data-status")));
  expect(statuses[0]).toBe("first_score");
  expect(new Set(statuses)).toEqual(new Set(statuses.filter((s) => ["first_score", "new_best", "no_better", "rejected", "finished", "failed"].includes(s as string))));
  await expect(page.getByTestId("best-idea")).toContainText("Best idea:");
  await expect(page.getByTestId("best-idea")).toContainText("learning from");
  await expect(page.getByTestId("see-result")).toContainText("See how it did on");
  await expect(page.getByTestId("see-result")).toHaveAttribute("href", "#verdict");
});

test("rounds arrive as the run goes, not all at the end", async ({ page }) => {
  await open(page);
  await page.getByTestId("model-select").selectOption({ label: "Thorough" });
  await page.getByTestId("play-button").click();
  await expect(rows(page).first()).toBeVisible({ timeout: 60_000 });
  expect(await rows(page).count()).toBeLessThan(roundsOf().length);
  await expect(rows(page)).toHaveCount(roundsOf().length, { timeout: 90_000 });
});

test("Watch it again plays the finished run again from the start, with no run request", async ({ page }) => {
  await open(page, "?interval=300");
  await finishRun(page);
  const requests = countRunRequests(page);
  await page.getByTestId("watch-again").click();
  await expect(rows(page)).toHaveCount(1, { timeout: 15_000 });               // it starts again from the first round
  await expect(rows(page)).toHaveCount(roundsOf().length, { timeout: 60_000 });
  expect(requests()).toBe(0);
});

test("for a visitor who prefers reduced motion Watch it again shows the finished run at once", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await open(page, "?interval=40");
  await finishRun(page);
  await page.getByTestId("watch-again").click();
  await expect(rows(page)).toHaveCount(roundsOf().length, { timeout: 5_000 });
  await expect(page.locator("graph-replay [data-node][data-state=\"running\"]")).toHaveCount(0);
});

test("the graph is shown with four rows in the server's order, and the stage legend comes with Show me everything", async ({ page }) => {
  await open(page, "?view=everything");
  const structure = await (await page.request.get("/api/structure")).json();
  const replay = page.locator("graph-replay");
  const titles = await replay.locator("[data-testid=graph-row] .row-title").allTextContents();
  expect(titles).toEqual(structure.rows.map((r: { title: string }) => r.title));
  for (const row of structure.rows as { id: string }[]) {
    const expectedNodes = structure.nodes.filter((n: { row?: string }) => n.row === row.id).map((n: { id: string }) => n.id).sort();
    const shown = (await replay.locator(`[data-row="${row.id}"] [data-node]`).evaluateAll((els) => els.map((e) => e.getAttribute("data-node")))).sort();
    expect(shown).toEqual(expectedNodes);
  }
  await expect(replay.locator('[data-node="propose_features"]')).toHaveAttribute("data-actor", "llm");
  await expect(replay.locator('[data-node="propose_features"] .actor-tag')).toHaveText("AI");
  await expect(replay.locator('[data-node="load_data"] .actor-tag')).toHaveCount(0);
  await expect(replay.locator("[data-testid=legend-stage]")).toHaveCount(structure.stages.length);
});

test("with Show me everything and a finished run there are Back, Step, Reset and Speed, and the node reached is ringed", async ({ page }) => {
  await open(page, "?interval=150&view=everything");
  const replay = page.locator("graph-replay");
  await finishRun(page);
  for (const id of ["back", "step", "reset", "speed"]) await expect(replay.getByTestId(id)).toBeVisible();
  await expect(replay.getByTestId("play")).toBeHidden();                      // its own Play would start a run: the page supplies the run
  await expect(replay.locator(".node.active")).toHaveCount(0);                 // the run is over: nothing is working
  await replay.getByTestId("back").click();
  await expect(replay.locator('[data-node="explain_in_cricket_terms"]')).toHaveClass(/active/);
  await expect(replay.locator('[data-node="explain_in_cricket_terms"]')).toHaveAttribute("data-state", "running");
  await replay.getByTestId("back").click();
  await expect(replay.locator('[data-node="explain_in_cricket_terms"]')).not.toHaveClass(/active/);
  await replay.getByTestId("reset").click();
  await expect(replay.locator(".node.active")).toHaveCount(0);               // back to before the first step, the run kept
  await page.getByTestId("watch-again").click();                              // and it can be watched again
  await expect(rows(page).first()).toBeVisible();
});

test("at 390 px the loop strip, round rows and graph rows wrap with no sideways scroll, everything open", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 800 });
  await open(page, "?interval=40&view=everything");
  await finishRun(page);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  for (const id of ["play-button", "watch-again", "model-select"]) expect((await page.getByTestId(id).boundingBox())!.height).toBeGreaterThanOrEqual(44);
});
