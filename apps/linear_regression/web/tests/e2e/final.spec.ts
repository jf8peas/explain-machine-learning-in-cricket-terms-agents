import { expect, test, type Page } from "./fixtures";
import { apiState, contrastOf, open, openTab, playToEnd, serveRun, sse, timelineItems, visibleText } from "./helpers";

// The final test tab (features 015 and 016): four numbered sections, none collapsible, under a TEST banner. Against the real
// app with the scripted fake model; no test calls a real model. States are read from the page's own state panel, and crafted
// ones are served as a one-step run so the verdict variants, the figure sets and the too-close boundary can be varied.

interface Figures { n: number; average_miss: number; within_10: number; within_20: number; bias: number }
interface Final {
  winner: "llm" | "forward"; llm_took_part: boolean; methods: string[]; accuracy: Record<string, Figures>;
  bias_phrases: Record<string, string>; test_mae: Record<string, number | null>;
  validation_mae: { llm: number | null; forward: number | null }; [k: string]: unknown;
}
interface Block { id: string; title: string; sentences: string[]; visual: Record<string, unknown>; from_model?: string[] }
interface Explanation {
  facts: Record<string, { value: unknown; display: string }>; blocks: Block[]; order: string[];
  source: string; model: string | null; fallback_reason: string | null;
}
interface Attempt { proposer: string; validation_mae: number; improved?: boolean; round?: number }
interface State {
  final: Final; explanation: Explanation; split: { test_year: number; checks: { year: number }[] };
  attempts: Attempt[]; grid: { cells: { allowed: boolean }[] }; forward_best: { validation_mae: number };
  validation_winner: { winner: "llm" | "forward" }; [k: string]: unknown;
}

const panel = async <T>(page: Page, key: string): Promise<T> => JSON.parse((await page.locator(`[data-key="${key}"] pre`).textContent()) ?? "{}");
const stateOf = async (page: Page) => (await apiState(page)) as unknown as State;     // one run against the visitor's limit: use sparingly
const finalOf = (page: Page) => panel<Final>(page, "final");
const explanationOf = (page: Page) => panel<Explanation>(page, "explanation");
const splitOf = (page: Page) => panel<State["split"]>(page, "split");

/** The real run's whole state, then a one-step run served with the patched state, played to its end. Leaves the page on What the agent found. */
async function craft(page: Page, patch: (s: State) => void, model?: string) {
  await open(page, 40);
  if (model) await page.getByTestId("model-select").selectOption({ label: model });
  const state = await stateOf(page);
  patch(state);
  // only the parts the two tabs read (a whole-state step also carries the data and error panels, which the replay treats as a failed run)
  const keep = ["final", "explanation", "split", "attempts", "grid", "forward_best", "validation_winner", "baseline_validation_mae", "rounds",
    "llm_status", "llm_best", "model_name", "features", "coefficients", "intercept", "feature_iqr"];
  const changes = Object.fromEntries(keep.filter((k) => k in state).map((k) => [k, state[k]]));
  await serveRun(page, sse("step", { step: 1, node: "explain_in_cricket_terms", summary: "x", changes }) + sse("done", { steps: 1 }));
  await page.reload();
  await openTab(page, "working");
  await page.getByTestId("play").click();
  await expect(page.getByTestId("tab-found")).toHaveAttribute("aria-selected", "true", { timeout: 15_000 });
}

/** Set the two models' scores on both exams. The AI's best on the check seasons is its first attempt. */
function setScores(s: State, v: { vAi: number; vRival: number; tAi: number; tRival: number }) {
  s.final.validation_mae = { llm: v.vAi, forward: v.vRival };
  s.final.accuracy.llm.average_miss = v.tAi; s.final.accuracy.forward.average_miss = v.tRival;
  s.final.test_mae.llm = v.tAi; s.final.test_mae.forward = v.tRival;
  const ai = s.attempts.filter((a) => a.proposer === "llm");
  ai.forEach((a, i) => { a.validation_mae = i === 0 ? v.vAi : v.vAi + 2 + i; a.improved = i === 0; });
  s.forward_best.validation_mae = v.vRival;
  s.validation_winner.winner = v.vAi <= v.vRival ? "llm" : "forward";
  s.final.winner = s.validation_winner.winner;
}

/** The design's run: validation rival 17.0, AI 17.4; test AI 17.7, rival 17.8. */
const DESIGN = { vAi: 17.4, vRival: 17.0, tAi: 17.7, tRival: 17.8 };

const rowIds = (page: Page, testid: string) => page.getByTestId(testid).evaluateAll((els) => els.map((e) => e.getAttribute("data-method")));
const tooClose = (page: Page) => page.getByTestId("too-close");

// ---------------- structure and labels ----------------

test("the tab has a header, a TEST banner and four numbered sections with one heading style and nothing collapsible", async ({ page }) => {
  await open(page);
  await playToEnd(page);
  await openTab(page, "final-test");
  const split = await splitOf(page), final = await finalOf(page);
  await expect(page.getByTestId("final-header")).toContainText(`each of the ${final.accuracy.broadcaster.n} innings of ${split.test_year}`);
  const banner = page.getByTestId("final-panel").getByTestId("exam-banner");
  await expect(banner).toHaveAttribute("data-exam", "test");
  await expect(banner.getByTestId("exam-pill")).toHaveText("TEST");
  await expect(banner).toContainText(String(split.test_year));
  await expect(banner).toContainText("never used for learning, tuning or choosing");
  await expect(banner).toContainText("honest");
  for (const n of [1, 2, 3, 4]) {
    const section = page.getByTestId(`final-section-${n}`);
    await expect(section).toBeVisible();
    await expect(section.locator("h3").first()).toHaveText(new RegExp(`^${n}\\. `));
  }
  const headings = ["1. How did our pick do?", "2. Why the scores differ from Model Selection", "3. How close did each one get?", "4. In cricket terms: what this tells us"];
  for (const [i, h] of headings.entries()) await expect(page.getByTestId(`final-section-${i + 1}`).locator("h3").first()).toHaveText(h);
  expect(await page.getByTestId("final-panel").locator("details, summary, [aria-expanded]").count()).toBe(0);
  expect(await page.getByTestId("final-panel").locator(".eyebrow, .hero-eyebrow").count()).toBe(0);
});

test("the removed parts are gone: no comparison box, accuracy table, scatter plot, place labels or extra sentence", async ({ page }) => {
  await open(page);
  await playToEnd(page);
  await openTab(page, "final-test");
  for (const id of ["comparison", "accuracy-table", "accuracy-chart", "chart-toggle", "winner", "reference-finding", "expectations-note", "verdict-leader"]) {
    await expect(page.getByTestId(id)).toHaveCount(0);
  }
  expect(await page.locator("[data-place], .race-place").count()).toBe(0);
  const text = (await page.getByTestId("final-panel").textContent()) ?? "";
  expect(text).not.toMatch(/R²|\bR2\b|typical total|How it was chosen|share of a typical|\b[1-4](st|nd|rd|th)\b/i);
});

test("neither tab ever says winner, for a run with the AI, a run without it and a run where the pick lost the test", async ({ page }) => {
  const visible = async () => `${await visibleText(page, "final-panel")} ${await visibleText(page, "found-panel")}`;
  await open(page);
  await playToEnd(page);
  await openTab(page, "found");
  await openTab(page, "final-test");
  expect(await visible()).not.toMatch(/winner/i);
  await page.goto("/?interval=40");
  await page.getByTestId("model-select").selectOption({ label: "Unreliable" });
  await playToEnd(page);
  await openTab(page, "found");
  await openTab(page, "final-test");
  expect(await visible()).not.toMatch(/winner/i);
  // the pick (chosen on validation) loses the test: validation rival 17.0 vs AI 17.4, test AI 17.7 vs rival 19.2
  await craft(page, (s) => setScores(s, { vAi: 17.4, vRival: 17.0, tAi: 17.7, tRival: 19.2 }));
  await openTab(page, "found");
  await openTab(page, "final-test");
  expect(await visible()).not.toMatch(/winner/i);
});

// ---------------- section 1: how did our pick do ----------------

test("section 1 opens with the pick card and the goal verdict beside it, then bars sorted by average miss with no place labels", async ({ page }) => {
  await open(page);
  await playToEnd(page);
  await openTab(page, "final-test");
  const final = await finalOf(page);
  const chosen = final.winner;
  const pick = page.getByTestId("pick-card");
  await expect(pick).toHaveAttribute("data-method", chosen);
  await expect(pick.getByTestId("pick-miss")).toHaveText(final.accuracy[chosen].average_miss.toFixed(1));
  await expect(pick).toContainText("Our pick: the");
  await expect(pick).toContainText("runs off, on average");
  await expect(pick).toContainText("Chosen on the check seasons, before");
  const beside = await page.getByTestId("pick-row").evaluate((row) => [...row.children].map((c) => c.getAttribute("data-testid")));
  expect(beside).toEqual(["pick-card", "verdict"]);
  const expected = [...final.methods].sort((a, b) => final.accuracy[a].average_miss - final.accuracy[b].average_miss);
  expect(await rowIds(page, "race-row")).toEqual(expected);
  expect(await page.getByTestId("race-value").allTextContents()).toEqual(expected.map((m) => final.accuracy[m].average_miss.toFixed(1)));
  const end = Math.ceil(Math.max(...expected.map((m) => final.accuracy[m].average_miss)) / 10 - 1e-9) * 10;
  expect((await page.getByTestId("race-tick").allTextContents()).map(Number)).toEqual(Array.from({ length: end / 10 + 1 }, (_, i) => i * 10));
  for (const m of expected) {
    const w = await page.locator(`[data-testid="race-bar"][data-method="${m}"]`).evaluate((el) => (el as HTMLElement).style.width);
    expect(parseFloat(w)).toBeCloseTo((final.accuracy[m].average_miss / end) * 100, 3);
  }
  await expect(page.getByTestId("final-section-1")).toContainText("Shorter bar = more accurate");
  await expect(page.getByTestId("final-section-1")).toContainText("runs off, on average");
});

test("the chosen model carries the outlined 'our pick' tag, and the methods are told apart without colour", async ({ page }) => {
  await open(page);
  await playToEnd(page);
  await openTab(page, "final-test");
  const final = await finalOf(page);
  const pick = page.getByTestId("race-pick");
  await expect(pick).toHaveCount(1);
  await expect(pick).toHaveText("our pick");
  await expect(page.locator(`[data-testid="race-row"][data-method="${final.winner}"]`).getByTestId("race-pick")).toBeVisible();
  expect(await pick.evaluate((el) => getComputedStyle(el).borderTopWidth)).not.toBe("0px");   // outlined
  expect(await page.locator('[data-testid="race-bar"][data-hatched]').evaluateAll((els) => els.map((e) => e.getAttribute("data-method")))).toEqual(["broadcaster"]);
  const names = await page.locator(".race-method").allTextContents();
  expect(names.length).toBe(final.methods.length);
  for (const n of names) expect(n.length).toBeGreaterThan(5);
});

test("the pick follows the choice made on validation even when it did worse on the test", async ({ page }) => {
  await craft(page, (s) => setScores(s, { vAi: 17.4, vRival: 17.0, tAi: 17.7, tRival: 19.2 }));   // the rival was chosen; the AI did better on the test
  await openTab(page, "final-test");
  await expect(page.getByTestId("pick-card")).toHaveAttribute("data-method", "forward");
  await expect(page.getByTestId("pick-miss")).toHaveText("19.2");
  await expect(page.locator('[data-testid="race-row"][data-method="forward"]').getByTestId("race-pick")).toBeVisible();
  expect((await rowIds(page, "race-row"))[0]).toBe("llm");                   // the shortest bar is still the AI's
});

for (const [name, patch, variant, shape, text] of [
  ["reached", (e: Explanation) => { const v = e.blocks.find((b) => b.id === "verdict")!; v.title = "Goal reached"; v.sentences = ["CRAFTED reached."]; v.visual = { variant: "reached", shape: "tick" }; }, "reached", "tick", "CRAFTED reached."],
  ["beat but short", (e: Explanation) => { const v = e.blocks.find((b) => b.id === "verdict")!; v.title = "Goal missed"; v.sentences = ["CRAFTED short."]; v.visual = { variant: "missed_beat", shape: "dash" }; }, "missed_beat", "dash", "CRAFTED short."],
  ["not beaten", (e: Explanation) => { const v = e.blocks.find((b) => b.id === "verdict")!; v.title = "Goal missed"; v.sentences = ["CRAFTED worse."]; v.visual = { variant: "missed_worse", shape: "cross" }; }, "missed_worse", "cross", "CRAFTED worse."],
] as const) {
  test(`the goal verdict card for "${name}" has its own shape, wording and tint`, async ({ page }) => {
    await craft(page, (s) => patch(s.explanation));
    await openTab(page, "final-test");
    const line = page.getByTestId("verdict");
    await expect(line).toHaveAttribute("data-variant", variant);
    await expect(line).toContainText(text);
    await expect(line).toContainText(/Goal (reached|missed)\./);
    await expect(page.getByTestId("verdict-shape")).toHaveAttribute("data-shape", shape);
    await expect(line).toHaveClass(variant === "reached" ? /win/ : /lose/);
  });
}

// ---------------- too close to call, on both tabs ----------------

test("the design's run says too close to call on both tabs", async ({ page }) => {
  await craft(page, (s) => setScores(s, DESIGN));
  await expect(page.getByTestId("choice-panel")).toHaveAttribute("data-state", "whisker");
  await expect(page.getByTestId("choice-heading")).toContainText("by a whisker");
  await expect(page.getByTestId("choice-text")).toContainText("A gap of 0.4 runs is too close to call");
  await expect(page.getByTestId("choice-panel").getByTestId("too-close")).toHaveCount(1);
  await openTab(page, "final-test");
  await expect(page.getByTestId("compare-line")).toContainText("too close to call (17.7 and 17.8 runs)");
  await expect(page.getByTestId("compare-line").getByTestId("too-close")).toHaveCount(1);
  await expect(page.getByTestId("differ-lead")).toContainText("On the check seasons the rival was ahead; on 2026 the AI edged it.");
  await expect(page.getByTestId("differ-lead")).toContainText("Both gaps are tiny.");
});

test("a gap of 0.5 runs is not too close to call on either exam, and neither is 1.2", async ({ page }) => {
  for (const scores of [{ vAi: 17.5, vRival: 17.0, tAi: 17.7, tRival: 18.2 }, { vAi: 18.2, vRival: 17.0, tAi: 17.7, tRival: 18.9 }]) {
    await craft(page, (s) => setScores(s, scores));
    await expect(page.getByTestId("choice-panel")).toHaveAttribute("data-state", "clear");
    await expect(tooClose(page)).toHaveCount(0);
    await expect(page.getByTestId("choice-text")).toContainText("runs better.");
    await openTab(page, "final-test");
    await expect(tooClose(page)).toHaveCount(0);
    await expect(page.getByTestId("compare-line")).toContainText("was more accurate, by");
    await expect(page.getByTestId("differ-lead")).not.toContainText("Both gaps are tiny.");
  }
});

test("only the exam whose gap is under 0.5 says too close to call", async ({ page }) => {
  await craft(page, (s) => setScores(s, { vAi: 17.4, vRival: 17.0, tAi: 17.7, tRival: 18.9 }));   // validation 0.4, test 1.2
  await expect(page.getByTestId("choice-text").getByTestId("too-close")).toHaveCount(1);
  await openTab(page, "final-test");
  await expect(page.getByTestId("compare-line")).not.toContainText("too close to call");
  await expect(page.getByTestId("differ-lead")).not.toContainText("Both gaps are tiny.");
});

// ---------------- section 2: why the scores differ ----------------

test("section 2 shows both exams with the run's scores on one scale and the three reasons, with the run's count of candidate models", async ({ page }) => {
  await open(page);
  await playToEnd(page);
  await openTab(page, "final-test");
  const state = await stateOf(page);
  const { final, split } = state;
  const section = page.getByTestId("final-section-2");
  await expect(section).toBeVisible();
  await expect(page.getByTestId("differ-lead")).toContainText("The same two models, sat in two different exams.");
  await expect(page.getByTestId("exam-card")).toHaveCount(2);
  const val = page.locator('[data-testid="exam-card"][data-exam="validation"]'), tst = page.locator('[data-testid="exam-card"][data-exam="test"]');
  await expect(val.getByTestId("exam-pill")).toHaveText("VALIDATION");
  await expect(tst.getByTestId("exam-pill")).toHaveText("TEST");
  await expect(val).toContainText(`Check seasons ${split.checks[0].year}–${split.checks[split.checks.length - 1].year}`);
  await expect(val).toContainText("Used to choose. Seen many times while comparing candidate models.");
  await expect(tst).toContainText(`Final test ${split.test_year}`);
  await expect(tst).toContainText("Used once, to judge. Never seen before.");
  const values = async (card: typeof val) => (await card.getByTestId("exam-value").allTextContents()).filter(Boolean);
  expect(await values(val)).toEqual([final.validation_mae.forward!.toFixed(1), final.validation_mae.llm!.toFixed(1)]);
  expect(await values(tst)).toEqual([final.accuracy.forward.average_miss.toFixed(1), final.accuracy.llm.average_miss.toFixed(1)]);
  // one shared scale: the same score has the same bar length in both cards
  const widths = async (card: typeof val) => card.getByTestId("exam-bar").evaluateAll((els) => els.map((e) => (e as HTMLElement).style.width));
  const max = Number(await val.getByTestId("exam-scale").getAttribute("data-max"));
  expect(await tst.getByTestId("exam-scale").getAttribute("data-max")).toBe(String(max));
  const expectWidths = [final.validation_mae.forward!, final.validation_mae.llm!].map((x) => (Math.round(x * 10) / 10 / max) * 100);
  (await widths(val)).forEach((w, i) => expect(parseFloat(w)).toBeCloseTo(expectWidths[i], 3));
  const reasons = await page.getByTestId("reason").evaluateAll((els) => els.map((e) => e.getAttribute("data-reason")));
  expect(reasons).toEqual(["seasons", "flatters", "clean"]);
  await expect(page.locator('[data-reason="seasons"]')).toContainText("Different seasons");
  await expect(page.locator('[data-reason="flatters"]')).toContainText("Choosing flatters the pick");
  await expect(page.locator('[data-reason="clean"]')).toContainText("The test is the clean one");
  await expect(page.locator('[data-reason="clean"]')).toContainText("trust the test");
  const count = state.attempts.filter((a) => a.proposer === "llm").length + state.grid.cells.filter((c) => c.allowed).length;
  await expect(page.getByTestId("reason-count")).toHaveText(String(count));
  await expect(page.locator('[data-reason="flatters"]')).toContainText(`${count} candidate models were tried on the check seasons`);
  await expect(page.locator('[data-reason="flatters"]')).not.toContainText(/dozens/i);
});

test("the count of candidate models follows the run", async ({ page }) => {
  await craft(page, (s) => {
    s.attempts = s.attempts.filter((a) => a.proposer === "llm").slice(0, 2);
    s.grid.cells = s.grid.cells.map((c, i) => ({ ...c, allowed: i < 10 }));
  });
  await openTab(page, "final-test");
  await expect(page.getByTestId("reason-count")).toHaveText("12");
});

// ---------------- section 3: how close ----------------

test("section 3 splits each method's bar into three shares that add to 100, from the displayed figures", async ({ page }) => {
  await open(page);
  await playToEnd(page);
  await openTab(page, "final-test");
  const final = await finalOf(page), split = await splitOf(page);
  const expected = [...final.methods].sort((a, b) => final.accuracy[a].average_miss - final.accuracy[b].average_miss);
  expect(await rowIds(page, "close-row")).toEqual(expected);
  for (const m of expected) {
    const a = final.accuracy[m];
    const w10 = Math.round(a.within_10), w20 = Math.max(w10, Math.round(a.within_20));
    const row = page.locator(`[data-testid="close-row"][data-method="${m}"]`);
    const shown = (await row.getByTestId("close-seg").allTextContents()).map((t) => parseInt(t, 10));
    expect(shown).toEqual([w10, w20 - w10, 100 - w20]);
    expect(shown.reduce((x, y) => x + y, 0)).toBe(100);
    await expect(row.getByTestId("close-bias")).toHaveText(final.bias_phrases[m]);
  }
  await expect(page.getByTestId("final-section-3")).toContainText(`Every ${split.test_year} innings`);
  await expect(page.getByTestId("close-key")).toContainText("within 10 runs");
  await expect(page.getByTestId("close-key")).toContainText("10 to 20 runs off");
  await expect(page.getByTestId("close-key")).toContainText("more than 20 runs off");
  await expect(page.getByTestId("close-note")).toContainText(/^(Even our pick|Our pick) was within 10 runs of the real total/);
  await expect(page.getByTestId("close-note")).toContainText("No method can be perfect from the halfway mark");
});

for (const [name, within10, within20] of [["a low spread", 8.4, 19.9], ["a high spread", 71.3, 93.6], ["equal figures", 40.0, 40.0]] as const) {
  test(`the three shares add to 100 for ${name}`, async ({ page }) => {
    await craft(page, (s) => { for (const m of s.final.methods) { s.final.accuracy[m].within_10 = within10; s.final.accuracy[m].within_20 = within20; } });
    await openTab(page, "final-test");
    const rows = page.getByTestId("close-row");
    for (let i = 0; i < (await rows.count()); i++) {
      const shown = (await rows.nth(i).getByTestId("close-seg").allTextContents()).map((t) => parseInt(t, 10));
      expect(shown.reduce((x, y) => x + y, 0)).toBe(100);
    }
  });
}

test("the TV's bias is emphasised only when the run says it is large", async ({ page }) => {
  await craft(page, (s) => { s.explanation.facts.tv_bias_large = { value: true, display: "yes" }; });
  await openTab(page, "final-test");
  await expect(page.locator('[data-testid="close-row"][data-method="broadcaster"] [data-testid="close-bias"]')).toHaveAttribute("data-large", "true");
  await expect(page.locator('[data-testid="close-row"][data-method="know_nothing"] [data-testid="close-bias"]')).toHaveAttribute("data-large", "false");
  await craft(page, (s) => { s.explanation.facts.tv_bias_large = { value: false, display: "no" }; });
  await openTab(page, "final-test");
  await expect(page.locator('[data-testid="close-bias"][data-large="true"]')).toHaveCount(0);
});

// ---------------- section 4: in cricket terms ----------------

test("section 4 has three takeaways in order and a rule of thumb, written by the model with every number from code", async ({ page }) => {
  await open(page);
  await playToEnd(page);
  await openTab(page, "final-test");
  const expl = await explanationOf(page);
  expect(expl.source).toBe("language model");
  await expect(page.getByTestId("takeaway")).toHaveCount(3);
  expect(await page.getByTestId("takeaway").evaluateAll((els) => els.map((e) => e.getAttribute("data-block")))).toEqual(
    ["takeaway_run_rate", "takeaway_drivers", "takeaway_tv"]);
  for (const [i, card] of (await page.getByTestId("takeaway").all()).entries()) {
    await expect(card).toContainText(`Takeaway ${i + 1}`);
    await expect(card.locator("h4")).not.toBeEmpty();
  }
  await expect(page.getByTestId("rule-of-thumb")).toBeVisible();
  const label = page.getByTestId("writer-label");
  await expect(label).toHaveAttribute("data-source", "language model");
  await expect(label).toHaveText(`Written by ${expl.model} · every number from code`);
  const by = (id: string) => expl.blocks.find((b) => b.id === id)!;
  expect(by("verdict").from_model).toEqual([]);
  expect(by("rule_of_thumb").from_model).toEqual([]);
});

test("takeaway 1 says scores keep climbing when the run says so, and keeps the usual wording otherwise", async ({ page }) => {
  await craft(page, (s) => {
    const b = s.explanation.blocks.find((x) => x.id === "takeaway_run_rate")!;
    b.title = "Scores keep climbing"; b.sentences = ["CRAFTED climbing."];
  });
  await openTab(page, "final-test");
  await expect(page.locator('[data-block="takeaway_run_rate"] h4')).toHaveText("Scores keep climbing");
});

test("the drivers card has a signed bar chart, biggest first, with a text equivalent", async ({ page }) => {
  await open(page);
  await playToEnd(page);
  await openTab(page, "final-test");
  const expl = await explanationOf(page);
  const rows = expl.blocks.find((b) => b.id === "takeaway_drivers")!.visual.rows as { label: string; display: string; effect_runs: number }[];
  const bars = page.locator("[data-testid=drivers-chart] .bar-row");
  await expect(bars).toHaveCount(rows.length);
  for (let i = 0; i < rows.length; i++) {
    await expect(bars.nth(i).locator(".bar-value")).toHaveText(/^[+−]\d+\.\d runs$/);
    expect((await bars.nth(i).locator(".bar").boundingBox())?.width ?? 0).toBeGreaterThan(2);
  }
  const first = rows.reduce((a, b) => (Math.abs(b.effect_runs) > Math.abs(a.effect_runs) ? b : a));
  await expect(bars.first().locator(".bar-label")).toHaveText(first.label);
  await expect(page.getByTestId("drivers-table").locator("tbody tr")).toHaveCount(rows.length);
  expect(await page.getByTestId("drivers-table").evaluate((el) => el.closest(".visually-hidden") !== null)).toBe(true);
});

test("without the model's wording the label says template wording", async ({ page }) => {
  await open(page);
  await page.getByTestId("model-select").selectOption({ label: "Unreliable" });
  await playToEnd(page);
  await openTab(page, "final-test");
  expect((await explanationOf(page)).source).toBe("template");
  await expect(page.getByTestId("writer-label")).toHaveAttribute("data-source", "template");
  await expect(page.getByTestId("writer-label")).toHaveText("Template wording · every number from code");
  await expect(page.getByTestId("takeaway")).toHaveCount(3);
});

test("markup in the model's wording is shown as text", async ({ page }) => {
  await open(page);
  await page.getByTestId("model-select").selectOption({ label: "Markup" });
  await playToEnd(page);
  await openTab(page, "final-test");
  await expect(page.getByTestId("final-section-4")).toContainText("<script>");
  expect(await page.getByTestId("final-section-4").locator("script, b").count()).toBe(0);
  expect(await page.evaluate(() => (window as unknown as { __pwned?: boolean }).__pwned)).toBeUndefined();
});

// ---------------- without the AI model ----------------

test("without the AI model the tab shows the rival alone: three rows, one score per exam card, no comparison, no too close to call", async ({ page }) => {
  await open(page);
  await page.getByTestId("model-select").selectOption({ label: "Unreliable" });
  await playToEnd(page);
  await openTab(page, "final-test");
  const final = await finalOf(page);
  expect(final.llm_took_part).toBe(false);
  expect(await rowIds(page, "race-row")).toHaveLength(3);
  expect(await rowIds(page, "close-row")).toHaveLength(3);
  expect(await rowIds(page, "race-row")).not.toContain("llm");
  await expect(page.getByTestId("pick-card")).toHaveAttribute("data-method", "forward");
  await expect(page.getByTestId("pick-card")).toContainText("the rival's model");
  await expect(page.getByTestId("verdict")).toContainText("rival's model");
  await expect(page.getByTestId("verdict")).not.toContainText("AI agent's model");
  await expect(page.getByTestId("compare-line")).toHaveCount(0);
  for (const card of await page.getByTestId("exam-card").all()) await expect(card.getByTestId("exam-bar")).toHaveCount(1);
  await expect(page.getByTestId("differ-lead")).toHaveText("The same two models, sat in two different exams.");
  await expect(page.getByTestId("reason")).toHaveCount(3);
  await expect(tooClose(page)).toHaveCount(0);
  await openTab(page, "found");
  await expect(tooClose(page)).toHaveCount(0);
});

// ---------------- every number matches the run ----------------

test("every number on the tab is one the run's state holds", async ({ page }) => {
  await open(page);
  await playToEnd(page);
  await openTab(page, "final-test");
  const state = await stateOf(page);
  const { final, explanation: expl, split } = state;
  const allowed = new Set<number>([1, 2, 3, 4, 0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 60, 70, 80, 90, 100, split.test_year, ...split.checks.map((c) => c.year)]);   // sections, takeaways, axes, bands
  const count = state.attempts.filter((a) => a.proposer === "llm").length + state.grid.cells.filter((c) => c.allowed).length;
  allowed.add(count);
  for (const m of final.methods) {
    const a = final.accuracy[m];
    for (const v of [a.average_miss, a.within_10, a.within_20, Math.abs(a.bias), a.n]) allowed.add(Number(v.toFixed(1)));
    const w10 = Math.round(a.within_10), w20 = Math.max(w10, Math.round(a.within_20));
    for (const v of [w10, w20 - w10, 100 - w20]) allowed.add(v);
    for (const t of final.bias_phrases[m].match(/\d+(?:\.\d+)?/g) ?? []) allowed.add(Number(t));
  }
  for (const v of [final.validation_mae.llm, final.validation_mae.forward]) if (v !== null) allowed.add(Number(v.toFixed(1)));
  const pair = (x: number | null, y: number | null) => (x === null || y === null ? [] : [Math.abs(Math.round(x * 10) - Math.round(y * 10)) / 10]);
  for (const g of [...pair(final.validation_mae.llm, final.validation_mae.forward), ...pair(final.accuracy.llm?.average_miss ?? null, final.accuracy.forward.average_miss)]) allowed.add(g);
  for (const f of Object.values(expl.facts)) for (const t of f.display.match(/\d+(?:\.\d+)?/g) ?? []) allowed.add(Number(t));
  for (const b of expl.blocks) for (const r of (b.visual.rows as { display: string }[] | undefined) ?? []) allowed.add(Number(r.display));
  const text = await page.getByTestId("results-final").evaluate((root) => {
    const parts: string[] = [];
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) parts.push(n.textContent ?? "");
    return parts.join(" ");
  });
  const tokens = text.replace(/(\d)(st|nd|rd|th)/g, "$1").match(/\d+(?:\.\d+)?/g) ?? [];
  expect(tokens.length).toBeGreaterThan(30);
  for (const t of tokens) expect(allowed.has(Number(t)), `${t} is not a figure of the run`).toBe(true);
});

// ---------------- replay ----------------

test("stepping back before the final test shows the not-ready sentence; the verdict and takeaways come one step later", async ({ page }) => {
  await open(page);
  await playToEnd(page);
  const names = (await timelineItems(page).allTextContents()).map((t) => t.replace(/^\d+\.\s*/, ""));
  const showStep = async (name: string) => {
    await openTab(page, "working");
    await timelineItems(page).nth(names.indexOf(name)).click();
    await openTab(page, "final-test");
  };
  await showStep("final_test");
  for (const n of [1, 2, 3]) await expect(page.getByTestId(`final-section-${n}`)).toBeVisible();
  await expect(page.getByTestId("pick-card")).toBeVisible();
  await expect(page.getByTestId("exam-card")).toHaveCount(2);              // both exams' scores arrive together
  await expect(page.getByTestId("verdict")).toHaveCount(0);
  await expect(page.getByTestId("close-note")).toHaveCount(0);
  await expect(page.getByTestId("final-section-4")).toHaveCount(0);
  await showStep("explain_in_cricket_terms");
  await expect(page.getByTestId("verdict")).toBeVisible();
  await expect(page.getByTestId("final-section-4")).toBeVisible();
  await expect(page.getByTestId("writer-label")).toHaveAttribute("data-source", "template");
  await showStep("write_in_cricket_terms");
  await expect(page.getByTestId("writer-label")).toHaveAttribute("data-source", "language model");
  await showStep("baseline");
  await expect(page.getByTestId("final-section-1")).toHaveCount(0);
  await expect(page.getByTestId("exam-banner")).toHaveCount(0);
  await expect(page.getByTestId("final-panel").locator(".not-ready")).toBeVisible();
});

// ---------------- layout, themes, motion ----------------

test("the lead runs the full width of the container", async ({ page }) => {
  await page.setViewportSize({ width: 1200, height: 900 });
  await open(page, 40);
  await playToEnd(page);
  await openTab(page, "final-test");
  const widths = await page.evaluate(() => {
    const lead = document.querySelector('[data-testid="final-header"]') as HTMLElement;
    const box = document.querySelector('[data-testid="results-final"]') as HTMLElement;
    return { lead: lead.getBoundingClientRect().width, box: box.getBoundingClientRect().width };
  });
  expect(Math.abs(widths.lead - widths.box)).toBeLessThanOrEqual(1);
});

test("at 360 px the tab fits, the banner wraps, and the cards and reasons stack", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await open(page, 40);
  await playToEnd(page);
  await openTab(page, "final-test");
  const sizes = await page.evaluate(() => {
    const box = document.querySelector('[data-testid="results-final"]')!.getBoundingClientRect();
    return { box: box.right, page: document.documentElement.scrollWidth, window: window.innerWidth };
  });
  expect(sizes.box).toBeLessThanOrEqual(sizes.window + 0.5);
  expect(sizes.page).toBeLessThanOrEqual(sizes.window);
  const banner = page.getByTestId("final-panel").getByTestId("exam-banner");
  const pill = (await banner.getByTestId("exam-pill").boundingBox())!, text = (await banner.locator(".exam-banner-text").boundingBox())!;
  expect(text.y).toBeGreaterThanOrEqual(pill.y + pill.height - 1);        // the text wraps under the pill
  const tops = async (id: string) => new Set((await page.getByTestId(id).evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().top)))));
  expect((await tops("exam-card")).size).toBe(2);
  expect((await tops("reason")).size).toBe(3);
  expect((await tops("takeaway")).size).toBe(3);
  const pickRow = await page.getByTestId("pick-row").evaluate((row) => [...row.children].map((c) => Math.round(c.getBoundingClientRect().top)));
  expect(new Set(pickRow).size).toBe(pickRow.length);
  const row = page.getByTestId("race-row").first();
  const name = (await row.locator(".race-name").boundingBox())!, area = (await row.locator(".race-area").boundingBox())!;
  expect(area.y).toBeGreaterThanOrEqual(name.y + name.height - 1);
});

test("at desktop width the two exam cards and the three reasons and takeaways sit side by side", async ({ page }) => {
  await page.setViewportSize({ width: 1200, height: 900 });
  await open(page, 40);
  await playToEnd(page);
  await openTab(page, "final-test");
  for (const [id, n] of [["exam-card", 1], ["reason", 1], ["takeaway", 1]] as const) {
    const tops = await page.getByTestId(id).evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().top)));
    expect(new Set(tops).size, id).toBe(n);
  }
});

for (const scheme of ["light", "dark"] as const) {
  test(`every new pill, banner, card and panel on the tab keeps 4.5:1 text contrast in the ${scheme} theme`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: scheme });
    await craft(page, (s) => setScores(s, DESIGN));
    const found: [string, string][] = [
      ["#found-exam-banner", '[data-testid="found-panel"] [data-testid="exam-banner"]'],
      ["found banner pill", '[data-testid="found-panel"] [data-testid="exam-pill"]'],
      ["found banner text", '[data-testid="found-panel"] .exam-banner-text'],
      ["season check", '[data-testid="season-check"] strong'],
      ["season caption validation", '[data-testid="season-caption-validation"]'],
      ["season caption test", '[data-testid="season-caption-test"]'],
      ["choice kicker", ".choice-kicker"], ["choice heading", '[data-testid="choice-heading"]'], ["choice text", '[data-testid="choice-text"]'],
    ];
    for (const [name, sel] of found.filter(([n]) => n !== "#found-exam-banner")) expect(await contrastOf(page, sel), `${scheme}: ${name}`).toBeGreaterThanOrEqual(4.5);
    await openTab(page, "final-test");
    const final: [string, string][] = [
      ["final banner pill", '[data-testid="final-panel"] [data-testid="exam-pill"]'],
      ["final banner text", '[data-testid="final-panel"] .exam-banner-text'],
      ["pick title", ".pick-title"], ["pick note", ".pick-note"], ["pick unit", ".pick-unit"],
      ["verdict", '[data-testid="verdict"]'], ["compare line", '[data-testid="compare-line"]'],
      ["race pick tag", '[data-testid="race-pick"]'],
      ["validation card head", '.exam-card-validation .exam-card-head strong'], ["validation caption", ".exam-card-validation .exam-caption"],
      ["validation pill", '.exam-card-validation [data-testid="exam-pill"]'], ["test pill", '.exam-card-test [data-testid="exam-pill"]'],
      ["test card head", ".exam-card-test .exam-card-head strong"], ["exam name", ".exam-name"],
      ["reason title", ".reason h4"], ["reason text", ".reason p"], ["close note", '[data-testid="close-note"]'],
    ];
    for (const [name, sel] of final) expect(await contrastOf(page, sel), `${scheme}: ${name}`).toBeGreaterThanOrEqual(4.5);
  });
}

test("the TEST and VALIDATION pills and banners differ in both look and word", async ({ page }) => {
  await open(page, 40);
  await playToEnd(page);
  await openTab(page, "final-test");
  const pills = await page.evaluate(() => [...document.querySelectorAll('[data-testid="exam-pill"]')].map((p) => ({ exam: p.getAttribute("data-exam"), text: p.textContent, bg: getComputedStyle(p).backgroundColor })));
  const by = (exam: string) => pills.find((p) => p.exam === exam)!;
  expect(by("validation").text).toBe("VALIDATION");
  expect(by("test").text).toBe("TEST");
  expect(by("validation").bg).not.toBe(by("test").bg);
});

test("nothing on the tab is animated", async ({ page }) => {
  await open(page, 40);
  await playToEnd(page);
  await openTab(page, "final-test");
  const running = await page.getByTestId("results-final").evaluate((e) => (e as HTMLElement).getAnimations({ subtree: true }).length);
  expect(running).toBe(0);
  const durations = await page.getByTestId("results-final").locator("*").evaluateAll(
    (els) => els.map((el) => getComputedStyle(el).transitionDuration + "|" + getComputedStyle(el).animationName));
  for (const d of durations) expect(/^(0s)(, 0s)*\|none$/.test(d) || ["|none", "0s|", ""].includes(d)).toBe(true);
});
