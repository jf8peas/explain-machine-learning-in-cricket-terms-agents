// What the agent found (feature 014), against the scripted fake model: six numbered sections, every number equal to the run's
// state (read from the replay event), the winner panel, stepping back, the fallback, both themes and a 360 px screen.
import { expect, test } from "./fixtures";
import type { Page } from "./fixtures";
import { open, openTab, playToEnd, timelineItems } from "./helpers";

interface Cell { training_innings: string; window: string; weighting: string; allowed: boolean; validation_mae: number | null }
interface Attempt { proposer: string; validation_mae: number; round: number; improved: boolean }
interface Round { round: number; outcome: string; reason: string; message?: string }
interface FoundState {
  attempts?: Attempt[]; rounds?: Round[]; grid?: { cells: Cell[]; best: Cell }; baseline_validation_mae?: number;
  validation_winner?: { winner: "llm" | "forward" };
  split?: { first_year: number; test_year: number; checks: { year: number }[] };
}

const picker = (page: Page) => page.getByTestId("model-picker").locator("select");

/** Keep the state the replay reports for the step on display, so a test can compare the page with it. */
async function watchState(page: Page) {
  await page.evaluate(() => {
    const w = window as unknown as { __state?: unknown };
    document.querySelector("graph-replay")!.addEventListener("replaychange", (ev) => { w.__state = (ev as CustomEvent).detail.state; });
  });
}
const shownState = (page: Page) => page.evaluate(() => (window as unknown as { __state: unknown }).__state) as Promise<FoundState>;
const one = (x: number) => x.toFixed(1);

test("the tab has a heading, a lead and six numbered sections, none collapsible", async ({ page }) => {
  await open(page);
  await playToEnd(page);
  await openTab(page, "found");
  const panel = page.getByTestId("found-panel");
  await expect(panel.getByRole("heading", { level: 2 })).toHaveText("What the agent found");
  await expect(page.getByTestId("found-header")).toContainText("Two methods competed");
  for (let n = 1; n <= 6; n++) {
    await expect(page.getByTestId(`found-section-${n}`).locator("h3")).toHaveText(new RegExp(`^${n}\\. `));
  }
  await expect(panel.locator("details, summary, [aria-expanded]")).toHaveCount(0);
  await expect(panel.locator(".eyebrow, .hero-eyebrow")).toHaveCount(0);
  await expect(page.getByTestId("contest-ai")).toContainText("up to 6 tries");
  await expect(page.getByTestId("contest-rival")).toContainText("24 candidate models");
  await expect(page.getByTestId("contest-why")).toContainText("Why have a rival?");
  await expect(page.getByTestId("contest-setup")).toContainText("What's a candidate model?");
  await expect(page.getByTestId("season-test")).toContainText("final test, locked");
  await expect(page.getByTestId("found-panel")).not.toContainText("Each check year");
});

test("every number on the tab comes from the run's state or the catalogue", async ({ page }) => {
  await open(page);
  await watchState(page);
  await playToEnd(page);
  const state = await shownState(page);
  const catalogue = await (await page.request.get("/api/catalogue")).json();
  await openTab(page, "found");
  const text = (await page.getByTestId("results").innerText()).replace(/\s+/g, " ");

  const allowed = new Set<string>();
  const addNumbers = (s: string) => (s.match(/\d+(\.\d+)?/g) ?? []).forEach((n) => allowed.add(n));
  const ai = state.attempts!.filter((a) => a.proposer === "llm");
  const cells = state.grid!.cells.filter((c) => c.allowed);
  const misses = [...ai.map((a) => a.validation_mae), ...cells.map((c) => c.validation_mae!), state.baseline_validation_mae!];
  misses.forEach((m) => allowed.add(one(m)));
  // gaps and drops are differences of the displayed values
  const shownMisses = misses.map((m) => Math.round(m * 10));
  for (const a of shownMisses) for (const b of shownMisses) allowed.add(((Math.abs(a - b)) / 10).toFixed(1));
  for (let n = 1; n <= 6; n++) allowed.add(String(n));                                  // section numbers
  // the chart's gridline labels: whole runs that span the plotted values
  for (let t = Math.floor(Math.min(...misses)) - 1; t <= Math.ceil(Math.max(...misses)) + 1; t++) allowed.add(String(t));
  state.rounds!.forEach((r) => allowed.add(String(r.round)));
  for (let rank = 1; rank <= ai.length + cells.length; rank++) allowed.add(String(rank));    // the ranking's numbers
  addNumbers(String(catalogue.round_cap));
  addNumbers(String(catalogue.grid_combinations));
  const split = state.split!;
  [split.first_year, split.test_year, split.first_year, ...split.checks.map((c) => c.year), split.checks[0].year - 1].forEach((y) => allowed.add(String(y)));
  // wording from the server's labels may hold numbers ("the last 10 seasons", "runs at 10 overs")
  for (const f of catalogue.features) addNumbers(f.label);
  for (const group of Object.values(catalogue.setup_menus) as { label: string; short: string }[][]) group.forEach((o) => { addNumbers(o.label); addNumbers(o.short); });
  // the AI's own words may hold numbers: they are quoted from state
  state.rounds!.forEach((r) => addNumbers(r.reason));
  addNumbers(String(split.checks.length)); addNumbers("3"); addNumbers("5");           // "three check seasons", the five shade steps are not printed

  const found = new Set(text.match(/\d+(\.\d+)?/g) ?? []);
  for (const n of found) expect(allowed, `${n} on the tab is not one of the run's numbers`).toContain(n);
  for (const m of misses) expect(text).toContain(one(m));                                // every miss is shown
  expect(text).toContain(`up to ${catalogue.round_cap} tries`);
  expect(text).toContain(`${catalogue.grid_combinations} candidate models`);
  expect(text).toContain(`${split.first_year}`);
  expect(text).toContain(`${split.test_year}`);
});

test("the winner panel says still searching before the grid search and names the winner after it", async ({ page }) => {
  await open(page);
  await watchState(page);
  await playToEnd(page);
  await openTab(page, "working");
  const items = timelineItems(page);
  const names = await items.allTextContents();
  const grid = names.findIndex((t) => t.includes("grid_search"));
  expect(grid).toBeGreaterThan(0);
  await items.nth(grid - 1).click();
  await openTab(page, "found");
  const panel = page.getByTestId("choice-panel");
  await expect(panel).toHaveAttribute("data-state", "pending");
  await expect(panel).toContainText("Still searching");
  await openTab(page, "working");
  await items.nth(grid).click();
  const state = await shownState(page);
  await openTab(page, "found");
  await expect(panel).not.toHaveAttribute("data-state", "pending");
  const ai = Math.min(...state.attempts!.filter((a) => a.proposer === "llm").map((a) => a.validation_mae));
  const rival = state.grid!.best.validation_mae!;
  const winnerIsAi = state.validation_winner!.winner === "llm";
  await expect(panel).toContainText(winnerIsAi ? "The AI agent's candidate model" : "The rival's candidate model");
  await expect(panel).toContainText(`${one(winnerIsAi ? ai : rival)} runs`);
  await expect(panel).toContainText("Chosen before the final test season was touched");
  await expect(page.getByTestId("to-final").getByRole("link")).toHaveAttribute("href", "#final-test");
});

test("stepping back hides the data of later steps", async ({ page }) => {
  await open(page);
  await playToEnd(page);
  await openTab(page, "working");
  const items = timelineItems(page);
  await openTab(page, "found");
  await expect(page.getByTestId("grid-table")).toHaveCount(2);
  await expect(page.getByTestId("race-line-rival")).toHaveCount(1);
  await openTab(page, "working");
  await items.nth(3).click();                                                           // baseline: nothing to show yet
  await openTab(page, "found");
  await expect(page.getByTestId("results")).toBeEmpty();
  await openTab(page, "working");
  await items.nth(7).click();                                                           // the first score
  await openTab(page, "found");
  await expect(page.getByTestId("round-item")).toHaveCount(1);
  await expect(page.getByTestId("attempt-row")).toHaveCount(1);
  await expect(page.getByTestId("grid-table")).toHaveCount(0);
  await expect(page.getByTestId("race-line-rival")).toHaveCount(0);
  await expect(page.getByTestId("choice-panel")).toHaveAttribute("data-state", "pending");
});

test("the race chart marks every round and has a text equivalent", async ({ page }) => {
  await open(page);
  await watchState(page);
  await playToEnd(page);
  const state = await shownState(page);
  await openTab(page, "found");
  const marks = page.getByTestId("race-mark");
  await expect(marks).toHaveCount(state.rounds!.length);
  const kinds = await marks.evaluateAll((els) => els.map((e) => (e as HTMLElement).dataset.kind));
  const wanted = state.rounds!.map((r) => r.outcome === "fit" ? (state.attempts!.find((a) => a.proposer === "llm" && a.round === r.round)!.improved ? "best" : "fitted") : r.outcome);
  expect(kinds).toEqual(wanted);
  for (const line of ["race-line-ai", "race-line-rival", "race-line-tv"]) await expect(page.getByTestId(line)).toHaveCount(1);
  const text = await page.getByTestId("race-text").textContent();
  for (const a of state.attempts!.filter((x) => x.proposer === "llm")) expect(text).toContain(`${one(a.validation_mae)} runs`);
  expect(text).toContain(`The rival's best was ${one(state.grid!.best.validation_mae!)}`);
  expect(text).toContain(`The TV projection's was ${one(state.baseline_validation_mae!)}`);
  await expect(page.getByTestId("race-chart")).toHaveAttribute("aria-label", /Average miss on the check seasons by AI round/);
});

test("the AI's reasons are shown exactly as written", async ({ page }) => {
  await open(page);
  await watchState(page);
  await playToEnd(page);
  const state = await shownState(page);
  await openTab(page, "found");
  const shown = await page.getByTestId("model-reason").allTextContents();
  expect(shown).toEqual(state.rounds!.map((r) => r.reason).filter((r) => r !== ""));
});

test("both themes render the tab, with method colours beside words", async ({ page }) => {
  await open(page);
  await playToEnd(page);
  await openTab(page, "found");
  for (const scheme of ["light", "dark"] as const) {
    await page.emulateMedia({ colorScheme: scheme });
    await expect(page.getByTestId("contest-ai")).toBeVisible();
    await expect(page.getByTestId("contest-ai")).toContainText("The AI agent");
    await expect(page.getByTestId("contest-rival")).toContainText("The rival");
    await expect(page.getByTestId("choice-panel")).toBeVisible();
    const found = await page.locator("tbody td.found-by").allTextContents();
    expect(found.every((t) => t === "AI agent" || t === "Rival")).toBe(true);
    const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    expect(bg).toBe(scheme === "dark" ? "rgb(18, 22, 29)" : "rgb(255, 255, 255)");
    const ai = await page.getByTestId("contest-ai").evaluate((el) => getComputedStyle(el).borderTopColor);
    const rival = await page.getByTestId("contest-rival").evaluate((el) => getComputedStyle(el).borderTopColor);
    expect(ai).not.toBe(rival);
  }
});

test("at 360 px wide there is no sideways page scroll and the tab stacks", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await open(page);
  await playToEnd(page);
  await openTab(page, "found");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  const ai = await page.getByTestId("contest-ai").boundingBox();
  const rival = await page.getByTestId("contest-rival").boundingBox();
  expect(rival!.y).toBeGreaterThan(ai!.y + ai!.height - 1);                              // the two cards are stacked
  const card = await page.getByTestId("round-item").first().boundingBox();
  expect(card!.x + card!.width).toBeLessThanOrEqual(360);
});

test("without a language model the AI card says so, the chart has no AI line and the rival is named", async ({ page }) => {
  await open(page);
  await picker(page).selectOption({ label: "Unreliable" });
  await playToEnd(page);
  await openTab(page, "found");
  await expect(page.getByTestId("contest-ai")).toContainText("did not take part");
  await expect(page.getByTestId("rounds-none")).toBeVisible();
  await expect(page.getByTestId("race-line-ai")).toHaveCount(0);
  await expect(page.getByTestId("race-line-rival")).toHaveCount(1);
  await expect(page.getByTestId("race-line-tv")).toHaveCount(1);
  await expect(page.getByTestId("choice-panel")).toHaveAttribute("data-state", "noAi");
  await expect(page.getByTestId("too-close")).toHaveCount(0);
  await expect(page.getByTestId("choice-panel")).toContainText("The rival's candidate model");
});

// ---------------- feature 016: validation versus test ----------------

test("a VALIDATION banner under the lead says every score is from the check seasons and that the verdict comes from the final test", async ({ page }) => {
  await open(page);
  await watchState(page);
  await playToEnd(page);
  await openTab(page, "found");
  const split = (await shownState(page)).split!;
  const banner = page.getByTestId("found-panel").getByTestId("exam-banner");
  await expect(banner).toHaveAttribute("data-exam", "validation");
  await expect(banner.getByTestId("exam-pill")).toHaveText("VALIDATION");
  await expect(banner).toContainText(`check seasons, ${split.checks[0].year}–${split.checks[split.checks.length - 1].year}`);
  await expect(banner).toContainText("(cross-validation)");
  await expect(banner).toContainText("choose a candidate model, not to judge it");
  await expect(banner).toContainText("The honest verdict comes from the final test.");
  const order = await page.getByTestId("results").evaluate((root) => [...root.children].slice(0, 2).map((c) => c.getAttribute("data-testid")));
  expect(order).toEqual(["found-header", "exam-banner"]);
});

test("section 2 and 3 carry the validation labels and the choice panel says 'Chosen on validation'", async ({ page }) => {
  await open(page);
  await playToEnd(page);
  await openTab(page, "found");
  await expect(page.getByTestId("found-section-2").locator("h3")).toHaveText("2. How every candidate model is scored: three check seasons (cross-validation)");
  await expect(page.getByTestId("found-section-2")).toContainText("These scores are used again and again to compare candidate models, which is exactly why they can't also be the final verdict.");
  expect(await page.getByTestId("season-check").evaluateAll((els) => els.every((e) => e.classList.contains("exam-validation")))).toBe(true);
  await expect(page.getByTestId("season-caption-validation")).toHaveText("VALIDATION: USED TO CHOOSE");
  await expect(page.getByTestId("season-caption-test")).toHaveText("TEST");
  await expect(page.getByTestId("found-section-3").locator("h3")).toHaveText("3. The race on the check seasons");
  await expect(page.getByTestId("race-chart")).toContainText("average miss on check seasons");
  await expect(page.getByTestId("found-section-3")).toContainText("All scores are on the check seasons.");
  const panel = page.getByTestId("choice-panel");
  await expect(panel).toContainText("Chosen on validation");
  await expect(panel).toContainText("on the check seasons");
  await expect(panel).toContainText("How good it really is gets settled by the final test, on a season nothing has seen.");
  await expect(page.getByTestId("to-final").getByRole("link")).toHaveAttribute("href", "#final-test");
  await expect(panel).not.toContainText(/winner/i);
});

test("the choice panel's scores come from the run and its state follows the gap on the check seasons", async ({ page }) => {
  await open(page);
  await watchState(page);
  await playToEnd(page);
  await openTab(page, "found");
  const s = await shownState(page);
  const ai = Math.min(...s.attempts!.filter((a) => a.proposer === "llm").map((a) => Math.round(a.validation_mae * 10)));
  const rival = Math.round(s.grid!.best.validation_mae! * 10);
  const state = Math.abs(ai - rival) < 5 ? "whisker" : "clear";
  await expect(page.getByTestId("choice-panel")).toHaveAttribute("data-state", state);
  await expect(page.getByTestId("choice-panel").getByTestId("too-close")).toHaveCount(state === "whisker" ? 1 : 0);
  const chosen = s.validation_winner!.winner === "llm" ? ai : rival, other = s.validation_winner!.winner === "llm" ? rival : ai;
  await expect(page.getByTestId("choice-text")).toContainText(`It missed by ${(chosen / 10).toFixed(1)} runs on the check seasons, against ${(other / 10).toFixed(1)}`);
});

test("the lead runs the full width of the container", async ({ page }) => {
  await page.setViewportSize({ width: 1200, height: 900 });
  await open(page, 40);
  await playToEnd(page);
  await openTab(page, "found");
  const widths = await page.evaluate(() => {
    const lead = document.querySelector('[data-testid="found-header"]') as HTMLElement;
    const box = document.querySelector('[data-testid="results"]') as HTMLElement;
    return { lead: lead.getBoundingClientRect().width, box: box.getBoundingClientRect().width };
  });
  expect(Math.abs(widths.lead - widths.box)).toBeLessThanOrEqual(1);
});

test("at 360 px the banner wraps under its pill, the season caption stacks and the page does not scroll sideways", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await open(page, 40);
  await playToEnd(page);
  await openTab(page, "found");
  const sizes = await page.evaluate(() => ({ page: document.documentElement.scrollWidth, window: window.innerWidth }));
  expect(sizes.page).toBeLessThanOrEqual(sizes.window);
  const banner = page.getByTestId("found-panel").getByTestId("exam-banner");
  const pill = (await banner.getByTestId("exam-pill").boundingBox())!, text = (await banner.locator(".exam-banner-text").boundingBox())!;
  expect(text.y).toBeGreaterThanOrEqual(pill.y + pill.height - 1);
  const a = (await page.getByTestId("season-caption-validation").boundingBox())!, b = (await page.getByTestId("season-caption-test").boundingBox())!;
  expect(b.y).toBeGreaterThan(a.y);
});

test("the tab never says winner, with the AI, and without it the panel names the rival and never says too close to call", async ({ page }) => {
  await open(page);
  await playToEnd(page);
  await openTab(page, "found");
  expect(await page.getByTestId("found-panel").evaluate((el) => (el as HTMLElement).innerText)).not.toMatch(/winner/i);
  await page.goto("/?interval=40");
  await picker(page).selectOption({ label: "Unreliable" });
  await playToEnd(page);
  await openTab(page, "found");
  expect(await page.getByTestId("found-panel").evaluate((el) => (el as HTMLElement).innerText)).not.toMatch(/winner/i);
  await expect(page.getByTestId("choice-panel")).toHaveAttribute("data-state", "noAi");
  await expect(page.getByTestId("choice-heading")).toHaveText("The rival's candidate model");
  await expect(page.getByTestId("too-close")).toHaveCount(0);
});
