// Watch it think (feature 020): the recorded run plays by itself when the section scrolls into view, can be paused and watched
// again, makes no run request, and shows the agent's own reasoning exactly as written. The full agent graph is in Commentary.
import { readFileSync } from "node:fs";
import { toPlayer } from "./helpers";
import { expect, test } from "./fixtures";
import type { Page } from "./fixtures";

const recorded = () => JSON.parse(readFileSync("tests/fixtures/recorded-run.fake.json", "utf8"));
const stateOf = () => Object.assign({}, ...recorded().events.map((e: { changes: object }) => e.changes));
const roundsOf = () => stateOf().rounds as { round: number; reason: string; outcome: string }[];

async function open(page: Page, query = "?interval=120") {
  await page.goto(`/${query}`);
  await expect(page.getByTestId("hero-title")).toBeVisible();
}
const toWatch = (page: Page) => toPlayer(page);
const button = (page: Page) => page.getByTestId("watch-button");
const rows = (page: Page) => page.getByTestId("round-item");

function countRunRequests(page: Page) {
  let n = 0;
  page.on("request", (r) => { if (new URL(r.url()).pathname === "/api/run") n++; });
  return () => n;
}

test("the section has its kicker, heading and the loop strip", async ({ page }) => {
  await open(page);
  await expect(page.locator("#watch .kicker").first()).toHaveText("WATCH IT THINK");
  await expect(page.locator("#watch-title")).toHaveText("Each round, the agent proposes an idea. Code tests it.");
  const pills = await page.getByTestId("loop-strip").locator("li").allTextContents();
  expect(pills).toEqual(["1 · Agent proposes clues", "2 · Code checks", "3 · Code fits a regression", "4 · Code scores it", "↺ repeat until no better"]);
  await expect(page.getByTestId("loop-strip").locator("li.ai")).toHaveText("1 · Agent proposes clues");
});

test("it plays by itself when scrolled into view, with no button pressed and no run request", async ({ page }) => {
  const requests = countRunRequests(page);
  await open(page);
  await expect(rows(page)).toHaveCount(0);                                   // nothing plays while the section is out of sight
  await toWatch(page);
  await expect(rows(page).first()).toBeVisible({ timeout: 10_000 });
  await expect(button(page)).toHaveText("❚❚ Pause");                         // a visible pause while it plays by itself
  await expect(button(page)).toHaveText("▶ Watch again", { timeout: 30_000 });
  await expect(rows(page)).toHaveCount(roundsOf().length);
  expect(requests()).toBe(0);
});

test("every round shows its idea, the agent's own reasoning exactly as written, a score and one status", async ({ page }) => {
  await open(page);
  await toWatch(page);
  await expect(button(page)).toHaveText("▶ Watch again", { timeout: 30_000 });
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
});

test("the run label names the recorded run's day and model", async ({ page }) => {
  await open(page);
  const run = recorded();
  await expect(page.getByTestId("run-label")).toContainText(`Recorded`);
  await expect(page.getByTestId("run-label")).toContainText(run.model_name);
  await expect(page.getByText("Lower score = closer predictions (average runs off)")).toBeVisible();
});

test("Pause pauses it and Resume carries on, by mouse and by keyboard", async ({ page }) => {
  await open(page, "?interval=700");
  await toWatch(page);
  await expect(button(page)).toHaveText("❚❚ Pause", { timeout: 10_000 });
  await button(page).click();
  await expect(button(page)).toHaveText("▶ Resume");
  const before = await rows(page).count();
  await page.waitForTimeout(1600);
  expect(await rows(page).count()).toBe(before);                            // it really stopped
  await button(page).focus();
  await page.keyboard.press("Space");                                        // keyboard resumes
  await expect(button(page)).toHaveText("❚❚ Pause");
  await page.keyboard.press("Enter");                                        // and pauses again
  await expect(button(page)).toHaveText("▶ Resume");
});

test("Watch again plays the saved run again from the start, with no run request", async ({ page }) => {
  const requests = countRunRequests(page);
  await open(page);
  await toWatch(page);
  await expect(button(page)).toHaveText("▶ Watch again", { timeout: 30_000 });
  await button(page).click();
  await expect(button(page)).toHaveText("❚❚ Pause");
  await expect(rows(page)).toHaveCount(1, { timeout: 5_000 });              // it starts again from the first round
  await expect(button(page)).toHaveText("▶ Watch again", { timeout: 30_000 });
  await expect(rows(page)).toHaveCount(roundsOf().length);
  expect(requests()).toBe(0);
});

test("for a visitor who prefers reduced motion nothing animates: the finished run is shown at once", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await open(page, "");
  await toWatch(page);
  await expect(rows(page)).toHaveCount(roundsOf().length, { timeout: 5_000 });
  await expect(button(page)).toHaveText("▶ Watch again");
});

test("the full agent graph is closed until asked for, then shows four rows in the server's order with the stage legend", async ({ page }) => {
  await open(page);
  await expect(page.getByTestId("graph-panel")).toBeHidden();
  await expect(page.getByTestId("graph-toggle")).toHaveAttribute("aria-expanded", "false");
  await page.getByTestId("graph-toggle").click();
  await expect(page.getByTestId("graph-toggle")).toHaveAttribute("aria-expanded", "true");
  await expect(page.getByTestId("graph-panel")).toBeVisible();
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
  await expect(replay.getByTestId("raw-state").locator("> summary")).toHaveText("Show every value");      // the raw values are one click further
  await replay.getByTestId("raw-state").locator("> summary").click();
  await expect(replay.locator("[data-testid=state]")).toBeVisible();
});

test("inside the graph Commentary there are Back, Step, Reset and Speed, and the node reached is ringed", async ({ page }) => {
  await open(page, "?interval=150&view=everything");
  const replay = page.locator("graph-replay");
  await toWatch(page);
  await expect(button(page)).toHaveText("▶ Watch again", { timeout: 30_000 });
  for (const id of ["back", "step", "reset", "speed"]) await expect(replay.getByTestId(id)).toBeVisible();
  await expect(replay.getByTestId("play")).toBeHidden();                      // its own Play would start a run: the page supplies the run
  await expect(replay.locator('[data-node="write_in_cricket_terms"]')).toHaveClass(/active/);
  await replay.getByTestId("back").click();
  await expect(replay.locator('[data-node="write_in_cricket_terms"]')).not.toHaveClass(/active/);
  await expect(replay.locator('[data-node="explain_in_cricket_terms"]')).toHaveClass(/active/);
  await replay.getByTestId("reset").click();
  await expect(replay.locator(".node.active")).toHaveCount(0);               // back to before the first step, the run kept
  await expect(rows(page)).toHaveCount(0);
  await button(page).click();                                                 // and it can be watched again
  await expect(rows(page).first()).toBeVisible();
});

test("at 390 px the loop strip, round rows and graph rows wrap with no sideways scroll, everything open", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 800 });
  await open(page, "?interval=100&view=everything");
  await toWatch(page);
  await expect(button(page)).toHaveText("▶ Watch again", { timeout: 30_000 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  for (const id of ["watch-button", "live-toggle", "graph-toggle"]) expect((await page.getByTestId(id).boundingBox())!.height).toBeGreaterThanOrEqual(44);
});
