import { expect, test, type Page } from "./fixtures";
import { afterRunOpen, open, openTab, playToEnd, serveRun, sse, timelineItems } from "./helpers";

// How good the references are: the introduction before any run, and the final results after one. Every figure on the
// page is compared with what the server sent, never with a number typed in here.

interface Figures { n: number; average_miss: number; within_10: number; within_20: number; miss_percent: number; bias: number }
interface Reference {
  goal: { reference: string; margin_runs: number; text: string; lead: string };
  methods: { id: string; name: string; note: string; marker: string }[];
  training: { first_year: number; last_year: number; innings: number } | null;
  figures: { know_nothing: Figures; broadcaster: Figures } | null;
  gap: { average_miss_runs: number; average_miss_percent: number; within_10_points: number } | null;
  finding: string | null;
  sentences: { headline: string; gap: string; finding: string; bias: string } | null;
  words: Record<string, { bias: string; bias_short: string }> | null;
  meter: Meter | null;
  message: string | null;
}
interface Mark { id: string; label: string; value: number }
interface Meter { scale: { min: number; max: number }; marks: Mark[]; caption: string; text: string }

const reference = async (page: Page) => (await (await page.request.get("/api/reference")).json()) as Reference;
const row = (page: Page, method: string) => page.locator(`[data-testid="reference-row"][data-method="${method}"]`);
const cell = (page: Page, method: string, col: string) => row(page, method).locator(`[data-col="${col}"]`);

/** Open the section of full figures (it is closed on a fresh load). */
async function openFigures(page: Page) {
  await expect(page.getByTestId("reference-details")).toBeVisible();
  await page.getByTestId("reference-details").locator("summary").click();
  await expect(page.getByTestId("reference-table")).toBeVisible();
}

/** Answer /api/reference with the real response changed by `change`. */
async function serveReference(page: Page, change: (body: Reference) => Reference) {
  const real = await reference(page);
  await page.route("**/api/reference", (route) => route.fulfill({ json: change(structuredClone(real)) }));
}

// ---------------- US1: the introduction ----------------

test("before any run the introduction shows both references with every measure, equal to the server's figures", async ({ page }) => {
  await page.goto("/");
  const ref = await reference(page);
  await openFigures(page);
  for (const method of ["know_nothing", "broadcaster"] as const) {
    const f = ref.figures![method];
    const name = ref.methods.find((m) => m.id === method)!.name;
    await expect(row(page, method)).toContainText(name);
    await expect(cell(page, method, "average_miss")).toContainText(f.average_miss.toFixed(1));
    await expect(cell(page, method, "within_10")).toContainText(f.within_10.toFixed(1));
    await expect(cell(page, method, "within_20")).toContainText(f.within_20.toFixed(1));
    await expect(cell(page, method, "miss_percent")).toContainText(f.miss_percent.toFixed(1));
    await expect(cell(page, method, "bias")).toContainText(ref.words![method].bias_short);
  }
  await expect(page.getByTestId("reference-row")).toHaveCount(2);                       // two references, no more
});

test("the introduction says how good the bar is, and what knowing the score at 10 overs is worth", async ({ page }) => {
  await page.goto("/");
  const ref = await reference(page);
  await openFigures(page);
  await expect(page.getByTestId("reference-lead")).toHaveText(ref.sentences!.headline);
  await expect(page.getByTestId("reference-note")).toContainText(ref.sentences!.gap);
  // plainly: when the projection is not clearly better than knowing nothing, the note says so before the gap
  if (ref.finding === "clearly_better") await expect(page.getByTestId("reference-note")).not.toContainText("only slightly better");
  else await expect(page.getByTestId("reference-note")).toContainText(ref.sentences!.finding);
  await expect(page.getByTestId("reference-lead")).toContainText(String(ref.training!.first_year));
  await expect(page.getByTestId("reference-lead")).toContainText(String(ref.training!.last_year));
});

test("when the projection is barely better than, or worse than, knowing nothing the introduction says so plainly", async ({ page }) => {
  for (const finding of ["slightly_better", "no_better"]) {
    await serveReference(page, (b) => ({ ...b, finding, sentences: { ...b.sentences!, finding: `FINDING ${finding}: beating it means little.` } }));
    await page.goto("/");
    await openFigures(page);
    await expect(page.getByTestId("reference-note")).toContainText(`FINDING ${finding}`);
    await expect(page.getByTestId("reference-note")).toContainText(((await reference(page)).sentences!.gap));
    await page.unroute("**/api/reference");
  }
});

test("the goal comes from the server and is in the introduction", async ({ page }) => {
  await page.goto("/");
  const ref = await reference(page);
  await expect(page.getByTestId("goal")).toContainText("The goal:");
  await expect(page.getByTestId("goal")).toContainText(ref.goal.text);
  await expect(page.getByTestId("goal")).toContainText("at least 3 runs");
});

test("in a 1280 by 800 window Play is still in view without scrolling", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await open(page);
  await expect(page.getByTestId("meter")).toBeVisible();                                 // the block has arrived
  const play = await page.evaluate(() => {
    const b = document.querySelector("graph-replay")!.shadowRoot!.querySelector("[data-testid=play]")!.getBoundingClientRect();
    return { top: b.top, bottom: b.bottom, scrolled: window.scrollY };
  });
  expect(play.scrolled).toBe(0);
  expect(play.bottom).toBeLessThanOrEqual(784);                 // 800 less a little breathing room
  expect(play.top).toBeGreaterThan(0);
});

test("with the figures missing the introduction still shows the goal and says the figures could not be loaded", async ({ page }) => {
  await serveReference(page, (b) => ({ ...b, training: null, figures: null, gap: null, finding: null, sentences: null, words: null,
    meter: null, message: "The accuracy figures could not be loaded." }));
  await page.goto("/");
  await expect(page.getByTestId("goal")).toContainText("at least 3 runs");
  await expect(page.getByTestId("reference-error")).toContainText("could not be loaded");
  await expect(page.getByTestId("reference-table")).toHaveCount(0);
  await expect(page.locator('[data-node="load_data"]')).toBeVisible();               // the rest of the page works
});

test("if the request fails the introduction says so briefly and the rest of the page still works", async ({ page }) => {
  await page.route("**/api/reference", (route) => route.abort());
  await page.goto("/");
  await expect(page.getByTestId("reference-error")).toContainText("could not be loaded");
  await expect(page.locator('[data-node="load_data"]')).toBeVisible();
  await expect(page.getByTestId("play")).toBeEnabled();
});

test("at phone width the introduction's figures do not make the page scroll sideways", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.getByTestId("meter")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await openFigures(page);                                                                // and not with the table open either
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});


// ---------------- US2: every method side by side at the end ----------------

interface Final {
  winner: "llm" | "forward"; llm_took_part: boolean; methods: string[]; identical: string[][];
  accuracy: Record<string, Figures>; bias_words: Record<string, string>; bias_sentence: string | null;
  bias_finding: { same_direction_large: boolean; direction: string | null };
  reference_finding: { finding: string; gap_runs: number; gap_percent: number | null; sentence: string };
  verdict: { improvement_runs: number; improvement_percent: number | null; beat: boolean; reached: boolean };
  verdict_sentence: string;
  method_defs: { id: string; name: string; note: string; marker: string }[];
}
interface RunState { final: Final; chart_points: { actual: number[]; predicted: Record<string, number[]> } }

/** The state the server sends for a whole run (the fake model is deterministic, so a second run matches the first). */
async function runState(page: Page, model = ""): Promise<RunState> {
  const text = await (await page.request.get(`/api/run${model}`)).text();
  const state: Record<string, unknown> = {};
  for (const block of text.trim().split("\n\n")) {
    const [event, data] = block.split("\n");
    if (event === "event: step") Object.assign(state, JSON.parse(data.replace("data: ", "")).changes);
  }
  return state as unknown as RunState;
}
const accRow = (page: Page, method: string) => page.locator(`[data-testid="accuracy-row"][data-method="${method}"]`);
const accCell = (page: Page, method: string, col: string) => accRow(page, method).locator(`[data-col="${col}"]`);
const modelOption = async (page: Page, label: string) => page.getByTestId("model-select").selectOption({ label });

test("after a run the results show all four methods side by side, with the server's figures", async ({ page }) => {
  await open(page, 40);
  await playToEnd(page);
  const state = await runState(page);
  const f = state.final;
  await expect(page.getByTestId("accuracy-row")).toHaveCount(4);
  expect(f.methods).toEqual(["know_nothing", "broadcaster", "llm", "forward"]);
  for (const m of f.methods) {
    const a = f.accuracy[m];
    await expect(accRow(page, m)).toContainText(f.method_defs.find((d) => d.id === m)!.name);
    await expect(accCell(page, m, "average_miss")).toContainText(a.average_miss.toFixed(1));
    await expect(accCell(page, m, "within_10")).toContainText(a.within_10.toFixed(1));
    await expect(accCell(page, m, "within_20")).toContainText(a.within_20.toFixed(1));
    await expect(accCell(page, m, "miss_percent")).toContainText(a.miss_percent.toFixed(1));
    await expect(accCell(page, m, "bias")).toHaveText(f.bias_words[m]);
    await expect(accCell(page, m, "n")).toHaveText(String(a.n));
  }
});

test("each heading gives the plain name and the technical name once, in brackets", async ({ page }) => {
  await open(page, 40);
  await playToEnd(page);
  const head = page.getByTestId("accuracy-table").locator("thead");
  for (const [plain, technical] of [["Average miss", "mean absolute error"], ["Hit rate", "share within a tolerance"],
    ["Miss as a share of a typical total", "relative error"], ["Bias", "mean signed error"]]) {
    await expect(head).toContainText(`${plain} (${technical})`);
  }
  expect(((await head.textContent()) ?? "").match(/\(/g)?.length).toBe(4);       // once each, nowhere else
  await expect(head).toContainText("Within 10 runs");
  await expect(head).toContainText("Within 20 runs");
});

test("bias reads in words and runs, and the table says how many innings it rests on", async ({ page }) => {
  await open(page, 40);
  await playToEnd(page);
  await expect(accCell(page, "broadcaster", "bias")).toContainText(/guesses \d+\.\d runs? too (low|high)|leans neither way/);
  const state = await runState(page);
  await expect(page.getByTestId("accuracy-caption")).toContainText(String(state.final.accuracy.broadcaster.n));
});

test("the existing comparison block and its test ids are still there, with the know-nothing figure beside them", async ({ page }) => {
  await open(page, 40);
  await playToEnd(page);
  await openTab(page, "final-test");
  for (const id of ["comparison", "final-llm", "final-forward", "final-tv", "winner", "verdict"]) await expect(page.getByTestId(id)).toBeVisible();
  const state = await runState(page);
  await expect(page.getByTestId("final-know-nothing")).toContainText(state.final.accuracy.know_nothing.average_miss.toFixed(1));
  await expect(page.getByTestId("verdict")).toContainText(state.final.verdict_sentence);
});

test("without the language model there are three rows and a plain note that its model is absent", async ({ page }) => {
  await open(page, 40);
  await modelOption(page, "Unreliable");
  await playToEnd(page);
  await expect(page.getByTestId("accuracy-row")).toHaveCount(3);
  await expect(accRow(page, "llm")).toHaveCount(0);
  await expect(page.getByTestId("accuracy-absent")).toContainText("language model");
  await expect(page.getByTestId("accuracy-absent")).toContainText("did not take part");
});

test("beside the table the page says how the projection compared with knowing nothing on the test year", async ({ page }) => {
  await open(page, 40);
  await playToEnd(page);
  const state = await runState(page);
  await expect(page.getByTestId("reference-finding")).toContainText(state.final.reference_finding.sentence);
});

test("crafted states: the weak-projection findings and the same-direction large bias show in words", async ({ page }) => {
  await open(page, 40);
  await playToEnd(page);
  const state = await runState(page);
  for (const finding of ["slightly_better", "no_better"]) {
    const crafted = structuredClone(state) as RunState;
    crafted.final.reference_finding = { ...crafted.final.reference_finding, finding, sentence: `CRAFTED ${finding} sentence.` };
    crafted.final.bias_finding = { same_direction_large: true, direction: "low" };
    crafted.final.bias_sentence = "CRAFTED every method leans low.";
    await serveRun(page, sse("step", { step: 1, node: "final_test", summary: "x", changes: { final: crafted.final, chart_points: crafted.chart_points } })
      + sse("done", { steps: 1 }));
    await page.reload();
    await openTab(page, "working");
    await page.getByTestId("play").click();
    await afterRunOpen(page, "final-test");
    await expect(page.getByTestId("reference-finding")).toContainText(`CRAFTED ${finding}`);
    await expect(page.getByTestId("bias-finding")).toContainText("CRAFTED every method leans low.");
    await page.unroute("**/api/run*");
  }
});

test("the state panel shows a count for the chart points, not the numbers", async ({ page }) => {
  await open(page, 40);
  await playToEnd(page);
  const names = (await timelineItems(page).allTextContents()).map((t) => t.replace(/^\d+\.\s*/, ""));
  await timelineItems(page).nth(names.indexOf("final_test")).click();
  const row = page.locator('[data-key="chart_points"]');
  await expect(row).toHaveAttribute("data-changed", "true");
  const text = (await row.textContent()) ?? "";
  expect(text).toMatch(/\d+ items/);
  expect(text.length).toBeLessThan(400);
});

test("at phone width the table scrolls inside its own box and the page does not scroll sideways", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await open(page, 40);
  await playToEnd(page);
  await openTab(page, "final-test");
  const sizes = await page.evaluate(() => {
    const box = document.querySelector('[data-testid="accuracy-table"]')!.closest(".table-scroll") as HTMLElement;
    return { scroll: box.scrollWidth, client: box.clientWidth, overflow: getComputedStyle(box).overflowX,
             page: document.documentElement.scrollWidth, window: window.innerWidth };
  });
  expect(sizes.overflow).toBe("auto");
  expect(sizes.scroll).toBeGreaterThan(sizes.client);
  expect(sizes.page).toBeLessThanOrEqual(sizes.window);
});


// ---------------- US3: the predicted-versus-actual chart ----------------

const toggle = (page: Page, method: string) => page.locator(`[data-testid="chart-toggle"][data-method="${method}"]`);
const marks = (page: Page, method: string) => page.locator(`[data-testid="chart-mark"][data-method="${method}"]`);
const allMarks = (page: Page) => page.locator('[data-testid="chart-mark"]');

test("the chart opens with the winning model and the TV projection, and its toggles are real buttons", async ({ page }) => {
  await open(page, 40);
  await playToEnd(page);
  const state = await runState(page);
  const shown = ["broadcaster", state.final.winner];
  await expect(page.getByTestId("chart-toggle")).toHaveCount(4);
  for (const m of state.final.methods) {
    await expect(toggle(page, m)).toHaveAttribute("aria-pressed", String(shown.includes(m)));
    expect(await toggle(page, m).evaluate((e) => e.tagName)).toBe("BUTTON");
  }
});

test("each shown method draws one mark per test innings, and switching it off removes exactly its marks", async ({ page }) => {
  await open(page, 40);
  await playToEnd(page);
  await openTab(page, "final-test");
  const state = await runState(page);
  const n = state.final.accuracy.broadcaster.n;
  expect(state.chart_points.actual).toHaveLength(n);
  await expect(marks(page, "broadcaster")).toHaveCount(n);
  await expect(marks(page, state.final.winner)).toHaveCount(n);
  await expect(marks(page, "know_nothing")).toHaveCount(0);
  await toggle(page, "know_nothing").click();
  await expect(marks(page, "know_nothing")).toHaveCount(n);
  await expect(allMarks(page)).toHaveCount(3 * n);
  await toggle(page, "broadcaster").click();
  await expect(marks(page, "broadcaster")).toHaveCount(0);
  await expect(allMarks(page)).toHaveCount(2 * n);
});

test("with no method chosen the chart shows only the diagonal and a prompt", async ({ page }) => {
  await open(page, 40);
  await playToEnd(page);
  await openTab(page, "final-test");
  const state = await runState(page);
  for (const m of ["broadcaster", state.final.winner]) await toggle(page, m).click();
  await expect(allMarks(page)).toHaveCount(0);
  await expect(page.getByTestId("chart-prompt")).toBeVisible();
  await expect(page.getByTestId("chart-prompt")).toContainText("Choose a method");
  await expect(page.getByTestId("chart-diagonal")).toBeVisible();
  await toggle(page, "broadcaster").click();
  await expect(page.getByTestId("chart-prompt")).toBeHidden();
});

test("the choice survives the replay moving on and back", async ({ page }) => {
  await open(page, 40);
  await playToEnd(page);
  await openTab(page, "final-test");
  await toggle(page, "know_nothing").click();
  await page.keyboard.press("ArrowLeft");
  await page.keyboard.press("ArrowRight");
  await expect(toggle(page, "know_nothing")).toHaveAttribute("aria-pressed", "true");
});

test("the plot is square, with the same range on both axes and the diagonal corner to corner", async ({ page }) => {
  await open(page, 40);
  await playToEnd(page);
  await openTab(page, "final-test");
  const area = await page.getByTestId("chart-plot-area").boundingBox();
  expect(Math.abs(area!.width - area!.height)).toBeLessThan(1.5);
  const diagonal = await page.getByTestId("chart-diagonal").evaluate((l) => {
    const n = (a: string) => Number(l.getAttribute(a));
    return { x1: n("x1"), y1: n("y1"), x2: n("x2"), y2: n("y2") };
  });
  const frame = await page.getByTestId("chart-plot-area").evaluate((r) => {
    const n = (a: string) => Number(r.getAttribute(a));
    return { x: n("x"), y: n("y"), w: n("width"), h: n("height") };
  });
  expect(diagonal.x1).toBeCloseTo(frame.x, 0);
  expect(diagonal.y1).toBeCloseTo(frame.y + frame.h, 0);
  expect(diagonal.x2).toBeCloseTo(frame.x + frame.w, 0);
  expect(diagonal.y2).toBeCloseTo(frame.y, 0);
  const ticks = await page.locator('[data-testid="chart-tick"]').evaluateAll((els) => els.map((e) => ({ axis: e.getAttribute("data-axis"), value: e.getAttribute("data-value") })));
  const x = ticks.filter((t) => t.axis === "x").map((t) => t.value);
  const y = ticks.filter((t) => t.axis === "y").map((t) => t.value);
  expect(x.length).toBeGreaterThanOrEqual(3);
  expect(x).toEqual(y);                                                  // the same ticks, so the same range, on both axes
});

test("the key tells methods apart by shape, and no two methods share a marker", async ({ page }) => {
  await open(page, 40);
  await playToEnd(page);
  const markers = await page.getByTestId("chart-toggle").evaluateAll((els) => els.map((e) => e.querySelector("[data-marker]")!.getAttribute("data-marker")));
  expect(new Set(markers).size).toBe(4);
  expect(markers.sort()).toEqual(["circle", "diamond", "square", "triangle"]);
  const style = await marks(page, "broadcaster").first().evaluate((e) => {
    const cs = getComputedStyle(e);
    return { stroke: cs.stroke, fillOpacity: parseFloat(cs.fillOpacity), strokeWidth: parseFloat(cs.strokeWidth) };
  });
  expect(style.stroke).not.toMatch(/none|transparent/);
  expect(style.fillOpacity).toBeLessThan(0.5);                           // open shapes: dense areas show, nothing hides another
  expect(style.strokeWidth).toBeGreaterThan(0);
});

test("two methods with identical predictions both draw all their marks, and the page says they are identical", async ({ page }) => {
  await open(page, 40);
  await playToEnd(page);
  const state = await runState(page);
  const crafted = structuredClone(state) as RunState;
  crafted.chart_points.predicted.forward = [...crafted.chart_points.predicted.llm];
  crafted.final.identical = [["llm", "forward"]];
  await serveRun(page, sse("step", { step: 1, node: "final_test", summary: "x", changes: { final: crafted.final, chart_points: crafted.chart_points } })
    + sse("done", { steps: 1 }));
  await page.reload();
  await page.getByTestId("play").click();
    await afterRunOpen(page, "final-test");
  await toggle(page, "llm").click().catch(() => undefined);
  const n = crafted.final.accuracy.broadcaster.n;
  for (const m of ["llm", "forward"]) {
    if ((await toggle(page, m).getAttribute("aria-pressed")) !== "true") await toggle(page, m).click();
  }
  await expect(marks(page, "llm")).toHaveCount(n);
  await expect(marks(page, "forward")).toHaveCount(n);
  await expect(page.getByTestId("chart-identical")).toContainText("identical");
  await expect(page.getByTestId("chart-identical")).toContainText("language model");
  await expect(page.getByTestId("chart-identical")).toContainText("forward selection");
});

test("without the language model its toggle is not offered", async ({ page }) => {
  await open(page, 40);
  await modelOption(page, "Unreliable");
  await playToEnd(page);
  await expect(page.getByTestId("chart-toggle")).toHaveCount(3);
  await expect(toggle(page, "llm")).toHaveCount(0);
  await expect(toggle(page, "forward")).toHaveAttribute("aria-pressed", "true");
});

test("a caption says what the chart shows in words, and the table above it holds every figure", async ({ page }) => {
  await open(page, 40);
  await playToEnd(page);
  await expect(page.getByTestId("chart-caption")).toContainText("below the line");
  await expect(page.getByTestId("chart-caption")).toContainText("too low");
  const order = await page.evaluate(() => {
    const t = document.querySelector('[data-testid="accuracy-table"]')!;
    const c = document.querySelector('[data-testid="accuracy-chart"]')!;
    return !!(t.compareDocumentPosition(c) & Node.DOCUMENT_POSITION_FOLLOWING);
  });
  expect(order).toBe(true);                                              // the table comes first
  await expect(page.getByTestId("chart-plot")).toHaveAttribute("role", "img");
  expect(await page.getByTestId("chart-plot").getAttribute("aria-label")).toContain("table above");
});

for (const scheme of ["light", "dark"] as const) {
  test(`the marks can be seen in the ${scheme} theme`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: scheme });
    await open(page, 40);
    await playToEnd(page);
    const seen = await marks(page, "broadcaster").first().evaluate((e) => {
      const cs = getComputedStyle(e);
      const card = getComputedStyle(e.closest("section.card") as HTMLElement).backgroundColor;
      return { stroke: cs.stroke, card };
    });
    expect(seen.stroke).not.toBe(seen.card);
    expect(seen.stroke).toMatch(/^rgb/);
  });
}

test("at phone width the chart fits its container and the page does not scroll sideways", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await open(page, 40);
  await playToEnd(page);
  await openTab(page, "final-test");
  const sizes = await page.evaluate(() => {
    const svg = document.querySelector('[data-testid="chart-plot"]')!.getBoundingClientRect();
    const box = document.querySelector('[data-testid="accuracy-chart"]')!.getBoundingClientRect();
    return { svg: svg.width, box: box.width, page: document.documentElement.scrollWidth, window: window.innerWidth };
  });
  expect(sizes.svg).toBeLessThanOrEqual(sizes.box + 0.5);
  expect(sizes.page).toBeLessThanOrEqual(sizes.window);
  expect(sizes.svg).toBeGreaterThan(250);                                // still big enough to read
});

test("nothing on the chart is animated", async ({ page }) => {
  await open(page, 40);
  await playToEnd(page);
  await openTab(page, "final-test");
  await toggle(page, "know_nothing").click();
  const running = await page.getByTestId("accuracy-chart").evaluate((e) => (e as HTMLElement).getAnimations({ subtree: true }).length);
  expect(running).toBe(0);
});


// ---------------- US4: the verdict, and setting expectations ----------------

test("near the final results the page says no method can be perfect, in plain words and without any figure", async ({ page }) => {
  await open(page, 40);
  await playToEnd(page);
  await openTab(page, "final-test");
  const note = page.getByTestId("expectations-note");
  await expect(note).toBeVisible();
  const text = (await note.textContent()) ?? "";
  expect(text).toContain("perfectly");
  expect(text).toContain("halfway mark");
  expect(text).toMatch(/last 10 overs/);
  expect(text).toMatch(/collapse/);
  expect(text).toMatch(/clearly better than the references, not perfect/);
  expect(text).not.toMatch(/\d+\.\d|%/);                                     // it is wording, not a figure
  const after = await page.evaluate(() => {
    const t = document.querySelector('[data-testid="accuracy-table"]')!;
    const n = document.querySelector('[data-testid="expectations-note"]')!;
    return !!(t.compareDocumentPosition(n) & Node.DOCUMENT_POSITION_FOLLOWING);
  });
  expect(after).toBe(true);                                                   // beside the results, after the table
});

test("the explanation compares the winner with the know-nothing guess, the projection and the hit rate", async ({ page }) => {
  await open(page, 40);
  await playToEnd(page);
  const state = await runState(page);
  const f = state.final as Final & { versus_know_nothing: { improvement_runs: number; improvement_percent: number } };
  const explanation = page.getByTestId("explanation");
  await expect(explanation).toContainText("know-nothing guess");
  await expect(explanation).toContainText(f.verdict_sentence);
  await expect(explanation).toContainText(`${Math.abs(f.versus_know_nothing.improvement_runs).toFixed(1)} runs`);
  await expect(explanation).toContainText("within 10 runs");
  await expect(explanation).toContainText("a boundary or two");
  await expect(explanation).toContainText(f.bias_words[f.winner]);
});

test("the verdict reads in the goal's words, with the runs and the percentage, and says whether the goal was reached", async ({ page }) => {
  await open(page, 40);
  await playToEnd(page);
  const state = await runState(page);
  const v = page.getByTestId("verdict");
  await expect(v).toContainText(state.final.verdict_sentence);
  await expect(v).toContainText(/\(\d+\.\d%\)/);
  await expect(v).toContainText(/(reaches|is short of) the goal of at least 3 runs/);
  const sentence = (await v.textContent()) ?? "";
  // checkable by hand from the table: the percentage is the runs gap over the TV projection's displayed average miss
  const tvMiss = Number(((await accCell(page, "broadcaster", "average_miss").textContent()) ?? "").trim());
  const runs = Number(/by (\d+\.\d) runs/.exec(sentence)![1]);
  const percent = Number(/\((\d+\.\d)%\)/.exec(sentence)![1]);
  expect(percent).toBeCloseTo(Math.round((runs / tvMiss) * 1000) / 10, 1);
});


// ---------------- US5: one goal, in one wording ----------------

test("the goal in the introduction is the server's text, and the verdict names the same margin", async ({ page }) => {
  await open(page, 40);
  const ref = await reference(page);
  await expect(page.getByTestId("goal")).toContainText(ref.goal.text);
  await playToEnd(page);
  await expect(page.getByTestId("goal")).toContainText(ref.goal.text);                       // still the same after a run
  await expect(page.getByTestId("verdict")).toContainText(`at least ${ref.goal.margin_runs} runs`);
  await expect(page.getByTestId("explanation")).toContainText(`at least ${ref.goal.margin_runs} runs`);
});

test("the page itself holds no hand-written goal", async ({ page }) => {
  await page.route("**/api/reference", (route) => route.abort());
  await page.goto("/");
  await expect(page.getByTestId("reference-error")).toBeVisible();
  await expect(page.getByTestId("goal")).toBeHidden();                                         // nothing is shown that the server did not send
  expect((await page.locator("main").first().textContent()) ?? "").not.toMatch(/at least 3 runs/);
});


test("in a 1280 window the introduction's table fits without scrolling or clipping any column", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/");
  await openFigures(page);
  const sizes = await page.evaluate(() => {
    const box = document.querySelector('[data-testid="reference-table"]')!.closest(".table-scroll") as HTMLElement;
    return { scroll: box.scrollWidth, client: box.clientWidth };
  });
  expect(sizes.scroll).toBeLessThanOrEqual(sizes.client);
});


// ---------------- 007: the lighter goal section (the miss meter) ----------------

const OLD_PARAGRAPHS = [
  "This app uses LangGraph to build an agent: a graph of steps, each doing one job and passing its results on. Press Play to " +
    "watch it work one step at a time. One step is different from the rest: a language model decides which features to try " +
    "next, using what it knows about cricket and the results so far. Every other step is ordinary code, and every number you " +
    "see comes from that code, never from the language model.",
  "The problem: predict a T20 first innings' final total after 10 overs, from measurements taken at that point (runs, wickets, " +
    "boundaries, the current partnership and more) in past men's T20 internationals, IPL and BBL innings. Linear regression " +
    "fits a straight line, so each feature gets a simple \"runs per unit\" effect we can explain in cricket terms. Forward " +
    "selection, a simple mechanical method, runs alongside as a rival.",
];
const squash = (t: string) => t.replace(/\s+/g, " ").trim();
const mark = (page: Page, id: string) => page.locator(`[data-testid="meter-mark"][data-mark="${id}"]`);
const numbersIn = (t: string) => (t.replace(/,/g, "").match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number);

interface Box { x: number; y: number; width: number; height: number }
async function boxOf(locator: ReturnType<Page["locator"]>): Promise<Box> {
  const b = await locator.boundingBox();
  expect(b).not.toBeNull();
  return b as Box;
}
const right = (b: Box) => b.x + b.width;
const bottom = (b: Box) => b.y + b.height;
const overlap = (a: Box, b: Box) => a.x < right(b) - 0.5 && b.x < right(a) - 0.5 && a.y < bottom(b) - 0.5 && b.y < bottom(a) - 0.5;
const inside = (inner: Box, outer: Box) => inner.x >= outer.x - 0.5 && right(inner) <= right(outer) + 0.5 &&
  inner.y >= outer.y - 0.5 && bottom(inner) <= bottom(outer) + 0.5;

/** Each mark's centre is where the server's scale puts it, inside the track. */
async function expectMarksOnScale(page: Page, meter: Meter) {
  const track = await boxOf(page.locator(".meter-track"));
  const span = meter.scale.max - meter.scale.min;
  let last = -Infinity;
  for (const m of [...meter.marks].sort((a, b) => a.value - b.value)) {
    const shape = await boxOf(mark(page, m.id).locator(".mark-shape"));
    const centre = shape.x + shape.width / 2;
    expect(Math.abs(centre - (track.x + ((m.value - meter.scale.min) / span) * track.width)), `${m.id} position`).toBeLessThanOrEqual(1.5);
    expect(centre).toBeGreaterThanOrEqual(track.x - 0.5);
    expect(centre).toBeLessThanOrEqual(right(track) + 0.5);
    expect(centre, "a lower value is further left").toBeGreaterThan(last);
    last = centre;
  }
}

/** Nothing clips, nothing overlaps, and the page does not scroll sideways. */
async function expectMeterFits(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), "no sideways scroll").toBe(true);
  const card = await boxOf(page.getByTestId("meter"));
  const parts: { what: string; box: Box }[] = [];
  for (const m of await page.getByTestId("meter-mark").all()) {
    const id = await m.getAttribute("data-mark");
    for (const part of ["mark-name", "mark-value"]) parts.push({ what: `${id} ${part}`, box: await boxOf(m.locator(`.${part}`)) });
  }
  for (const p of parts) expect(inside(p.box, card), `${p.what} inside the card`).toBe(true);
  for (let i = 0; i < parts.length; i++) {
    for (let j = i + 1; j < parts.length; j++) expect(overlap(parts[i].box, parts[j].box), `${parts[i].what} and ${parts[j].what} overlap`).toBe(false);
  }
}

// --- US1: the lead line and the meter, equal to the server's figures

test("the lead line is the server's sentence and the meter's marks equal the server's figures", async ({ page }) => {
  await page.goto("/");
  const ref = await reference(page);
  const meter = ref.meter!;
  await expect(page.getByTestId("intro-lead")).toHaveText(ref.goal.lead);
  await expect(page.getByTestId("meter-mark")).toHaveCount(3);
  for (const m of meter.marks) {
    await expect(mark(page, m.id).locator(".mark-name")).toHaveText(m.label);
    await expect(mark(page, m.id).locator(".mark-value")).toHaveText(m.value.toFixed(1));
  }
  const goal = meter.marks.find((m) => m.id === "goal")!.value;
  const tv = ref.figures!.broadcaster.average_miss;
  expect(goal).toBe(Math.round((tv - ref.goal.margin_runs) * 10) / 10);                    // 21.8 less the margin, as displayed
  await expect(mark(page, "broadcaster").locator(".mark-value")).toHaveText(tv.toFixed(1));
  await expect(mark(page, "know_nothing").locator(".mark-value")).toHaveText(ref.figures!.know_nothing.average_miss.toFixed(1));
});

test("each mark sits where the scale puts it and the shaded zone runs from the left end to the goal", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/");
  const meter = (await reference(page)).meter!;
  await expect(page.getByTestId("meter")).toBeVisible();
  await expectMarksOnScale(page, meter);
  const track = await boxOf(page.locator(".meter-track"));
  const zone = await boxOf(page.getByTestId("meter-zone"));
  const goal = await boxOf(mark(page, "goal").locator(".mark-shape"));
  expect(Math.abs(zone.x - track.x)).toBeLessThanOrEqual(1);
  expect(Math.abs(right(zone) - (goal.x + goal.width / 2))).toBeLessThanOrEqual(1.5);
});

test("the caption and the footer are the server's, and the meter shows no number the server did not send", async ({ page }) => {
  await page.goto("/");
  const ref = await reference(page);
  await expect(page.getByTestId("meter-caption")).toHaveText(ref.meter!.caption);
  await expect(page.getByTestId("goal")).toContainText("The goal:");
  await expect(page.getByTestId("goal")).toContainText(ref.goal.text);
  const sent = new Set(numbersIn(JSON.stringify(ref)));
  for (const n of numbersIn(await page.getByTestId("meter").innerText())) expect(sent.has(n), `${n} was sent by the server`).toBe(true);
});

// --- US2: the chips and the two closed sections

test("five chips, in order, with the language-model chip in the accent colour", async ({ page }) => {
  await page.goto("/");
  const chips = page.getByTestId("chips").locator("li");
  await expect(chips).toHaveCount(5);
  const terms = await chips.locator("strong").allTextContents();
  expect(terms).toEqual(["Agent", "Language model", "Code", "Linear regression", "Rival"]);
  await expect(chips.nth(1)).toContainText("picks features");
  const colours = await page.evaluate(() => {
    const llm = document.querySelector(".chip-llm strong") as HTMLElement;
    const link = document.querySelector(".eyebrow a") as HTMLElement;                      // links use the accent colour
    const other = document.querySelectorAll(".chip strong")[0] as HTMLElement;
    return { llm: getComputedStyle(llm).color, accent: getComputedStyle(link).color, other: getComputedStyle(other).color };
  });
  expect(colours.llm).toBe(colours.accent);
  expect(colours.other).not.toBe(colours.accent);
});

test("both sections are closed on a fresh load and what is inside them is not visible", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("meter")).toBeVisible();
  for (const id of ["intro-full", "reference-details"]) {
    await expect(page.getByTestId(id)).toBeVisible();
    expect(await page.getByTestId(id).evaluate((el) => (el as HTMLDetailsElement).open)).toBe(false);
  }
  await expect(page.getByTestId("intro-full").locator("p").first()).toBeHidden();
  await expect(page.getByTestId("reference-table")).toBeHidden();
  await expect(page.getByTestId("reference-lead")).toBeHidden();
});

test("opening the first section shows the two original paragraphs word for word", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("intro-full").locator("summary").click();
  const paragraphs = await page.getByTestId("intro-full").locator("p").allInnerTexts();
  expect(paragraphs.map(squash)).toEqual(OLD_PARAGRAPHS);
});

test("opening the second section shows the headline, the table and the note, equal to the server's", async ({ page }) => {
  await page.goto("/");
  const ref = await reference(page);
  await openFigures(page);
  await expect(page.getByTestId("reference-lead")).toHaveText(ref.sentences!.headline);
  await expect(page.getByTestId("reference-row")).toHaveCount(2);
  await expect(page.getByTestId("reference-note")).toContainText(ref.sentences!.gap);
  await expect(page.getByTestId("reference-details").getByRole("columnheader")).toHaveCount(6);
});

test("with both sections closed the section is short, and Play stays high in a 1280 by 800 window", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await open(page);
  await expect(page.getByTestId("meter")).toBeVisible();
  const words = await page.evaluate(() => {
    const count = (el: Element | null) => ((el as HTMLElement | null)?.innerText ?? "").split(/\s+/).filter(Boolean).length;
    return count(document.querySelector("section.intro")) - count(document.querySelector(".eyebrow")) - count(document.querySelector("#intro-title"));
  });
  // 120 when feature 007 shipped (about 104 words); feature 008 added the one-sentence description of what the agent is tested
  // on (15 words), so the limit is 135, still under half of the roughly 292 words the introduction had before 007.
  expect(words).toBeLessThanOrEqual(135);
  const play = await page.evaluate(() => document.querySelector("graph-replay")!.shadowRoot!.querySelector("[data-testid=play]")!.getBoundingClientRect().bottom);
  expect(play).toBeLessThanOrEqual(750);                                                   // no lower than before the redesign
});

test("opening and closing a section animates nothing and leaves the meter alone", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("meter")).toBeVisible();
  const before = await page.getByTestId("meter").innerText();
  await page.getByTestId("intro-full").locator("summary").click();
  await page.getByTestId("reference-details").locator("summary").click();
  expect(await page.evaluate(() => document.getAnimations().length)).toBe(0);
  expect(await page.getByTestId("meter").innerText()).toBe(before);
  await page.getByTestId("intro-full").locator("summary").click();
  expect(await page.evaluate(() => (document.querySelector("[data-testid=intro-full]") as HTMLDetailsElement).open)).toBe(false);
});

// --- US3: everyone can read it

test("the meter is one labelled image with the server's text, its parts are hidden and the footer is outside it", async ({ page }) => {
  await page.goto("/");
  const meter = (await reference(page)).meter!;
  const figure = page.getByTestId("meter-figure");
  await expect(figure).toHaveAttribute("role", "img");
  await expect(figure).toHaveAttribute("aria-label", meter.text);
  const label = (await figure.getAttribute("aria-label")) ?? "";
  for (const m of meter.marks) expect(label).toContain(m.value.toFixed(1));
  await expect(figure.locator(".meter-track")).toHaveAttribute("aria-hidden", "true");
  await expect(figure.locator("[data-testid=goal]")).toHaveCount(0);
  await expect(page.getByTestId("goal")).toBeVisible();
  await expect(page.getByTestId("reference")).toHaveAttribute("aria-live", "polite");
});

test("the marks are told apart by shape as well as colour: a dot for each reference, a line for the goal", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("meter")).toBeVisible();
  await expect(mark(page, "know_nothing")).toHaveAttribute("data-shape", "dot");
  await expect(mark(page, "broadcaster")).toHaveAttribute("data-shape", "dot");
  await expect(mark(page, "goal")).toHaveAttribute("data-shape", "line");
  const shapes = await page.evaluate(() => ["know_nothing", "goal"].map((id) => {
    const el = document.querySelector(`[data-mark=${id}] .mark-shape`) as HTMLElement;
    const after = getComputedStyle(el, "::after");
    return { radius: getComputedStyle(el).borderTopLeftRadius, afterWidth: after.width, afterContent: after.content };
  }));
  expect(shapes[0].radius).not.toBe("0px");                                                // a round dot
  expect(shapes[1].afterWidth).toBe("2px");                                                // a thin vertical line
});

for (const scheme of ["light", "dark"] as const) {
  test(`in ${scheme} mode the marks, the line and the zone stand out from the card`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: scheme });
    await page.goto("/");
    await expect(page.getByTestId("meter")).toBeVisible();
    const c = await page.evaluate(() => {
      const css = (sel: string, prop: string, pseudo?: string) => getComputedStyle(document.querySelector(sel)!, pseudo)[prop as never] as string;
      return {
        card: css("[data-testid=meter]", "backgroundColor"),
        dot: css("[data-mark=broadcaster] .mark-shape", "backgroundColor"),
        goalLine: css("[data-mark=goal] .mark-shape", "backgroundColor", "::after"),
        zone: css("[data-testid=meter-zone]", "backgroundColor"),
        zoneBorder: css("[data-testid=meter-zone]", "borderTopColor"),
        line: css(".meter-line", "backgroundColor"),
        know: css("[data-mark=know_nothing] .mark-shape", "backgroundColor"),
      };
    });
    for (const k of ["dot", "goalLine", "zoneBorder", "line", "know"] as const) expect(c[k], `${k} differs from the card`).not.toBe(c.card);
    expect(c.zone).not.toBe(c.card);
    expect(c.goalLine).not.toBe(c.dot);
  });
}

test("each section can be reached and toggled from the keyboard and shows a focus outline", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("reference-details")).toBeVisible();
  const summary = page.getByTestId("intro-full").locator("summary");
  for (let i = 0; i < 30 && !(await summary.evaluate((el) => el === document.activeElement)); i++) await page.keyboard.press("Tab");
  expect(await summary.evaluate((el) => el === document.activeElement)).toBe(true);
  const outline = await summary.evaluate((el) => { const s = getComputedStyle(el); return { style: s.outlineStyle, width: s.outlineWidth }; });
  expect(outline.style).not.toBe("none");
  expect(parseFloat(outline.width)).toBeGreaterThan(0);
  await page.keyboard.press("Enter");
  expect(await page.getByTestId("intro-full").evaluate((el) => (el as HTMLDetailsElement).open)).toBe(true);
  await page.keyboard.press("Space");
  expect(await page.getByTestId("intro-full").evaluate((el) => (el as HTMLDetailsElement).open)).toBe(false);
  await page.keyboard.press("Tab");
  await page.keyboard.press("Space");
  expect(await page.getByTestId("reference-details").evaluate((el) => (el as HTMLDetailsElement).open)).toBe(true);
});

// --- US4: phones

const ref007 = (known: number, tv: number, goal: number, scale: { min: number; max: number }, labels?: [string, string, string]) =>
  (b: Reference): Reference => ({
    ...b,
    meter: {
      ...b.meter!, scale,
      marks: [
        { id: "know_nothing", label: labels?.[0] ?? "Know-nothing guess", value: known },
        { id: "broadcaster", label: labels?.[1] ?? "TV projection", value: tv },
        { id: "goal", label: labels?.[2] ?? "The goal", value: goal },
      ],
    },
  });

const CRAFTED: [string, (b: Reference) => Reference][] = [
  ["the real figures", (b) => b],
  ["the projection worse than knowing nothing", ref007(20.0, 25.0, 22.0, { min: 17, max: 28 })],
  ["a goal below zero", ref007(30.0, 2.0, -1.0, { min: -8, max: 37 })],
  ["two references with close values", ref007(22.5, 21.8, 18.8, { min: 15, max: 26 })],
  ["the goal and the projection close on a wide scale", ref007(40.0, 22.0, 19.0, { min: 14, max: 45 })],
  ["long names", ref007(29.4, 21.8, 18.8, { min: 15, max: 33 },
    ["The know-nothing guess: always the average", "The TV projection: run rate times twenty", "The goal: a few runs better"])],
];

for (const width of [360, 390, 768, 1280]) {
  for (const [name, change] of CRAFTED) {
    if (name === "long names" && width >= 760) continue;     // names wrap below 760 px; on wide screens they are one line and short
    test(`at ${width} px, ${name}: every name and value is inside the card, none overlap, and each mark is on the scale`, async ({ page }) => {
      await serveReference(page, change);
      await page.setViewportSize({ width, height: 800 });
      await page.goto("/");
      await expect(page.getByTestId("meter")).toBeVisible();
      await expectMeterFits(page);
      await expectMarksOnScale(page, (await page.evaluate(async () => (await (await fetch("/api/reference")).json()).meter)) as Meter);
    });
  }
}

test("below 760 px the end labels go, the values shrink, the goal sits above the line and the references below", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.getByTestId("meter")).toBeVisible();
  for (const end of await page.locator(".meter-end").all()) await expect(end).toBeHidden();
  expect(await page.locator("[data-mark=goal] .mark-value").evaluate((el) => getComputedStyle(el).fontSize)).toBe("17.6px");
  const line = await boxOf(page.locator(".meter-line"));
  const goal = await boxOf(mark(page, "goal"));
  expect(bottom(goal)).toBeLessThanOrEqual(line.y + 8);
  for (const id of ["know_nothing", "broadcaster"]) expect((await boxOf(mark(page, id).locator(".mark-name"))).y).toBeGreaterThan(line.y);
  await page.setViewportSize({ width: 1280, height: 800 });
  for (const end of await page.locator(".meter-end").all()) await expect(end).toBeVisible();
  expect(await page.locator("[data-mark=goal] .mark-value").evaluate((el) => getComputedStyle(el).fontSize)).toBe("22.4px");
});

test("at 360 px the chips wrap and the opened table scrolls inside its own box", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto("/");
  await expect(page.getByTestId("meter")).toBeVisible();
  const tops = new Set(await page.getByTestId("chips").locator("li").evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().top))));
  expect(tops.size).toBeGreaterThan(1);
  await openFigures(page);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  expect(await page.locator(".table-scroll").evaluate((el) => getComputedStyle(el).overflowX)).toBe("auto");
});

test("with the text size increased the meter still has no overlap or clipping", async ({ page }) => {
  await page.setViewportSize({ width: 768, height: 900 });
  await page.goto("/");
  await expect(page.getByTestId("meter")).toBeVisible();
  await page.evaluate(() => { document.documentElement.style.fontSize = "150%"; });
  await expectMeterFits(page);
});

// --- US5: honest when the figures are missing

test("when the request fails there is no lead, meter or goal, only the message; the chips and the first section remain", async ({ page }) => {
  await page.route("**/api/reference", (route) => route.abort());
  await page.goto("/");
  await expect(page.getByTestId("reference-error")).toContainText("could not be loaded");
  for (const id of ["intro-lead", "meter", "goal", "reference-details"]) await expect(page.getByTestId(id)).toBeHidden();
  await expect(page.getByTestId("chips")).toBeVisible();
  await expect(page.getByTestId("intro-full").locator("summary")).toBeVisible();
  await expect(page.getByTestId("play")).toBeEnabled();
});

test("when the server has no figures the lead and a plain goal line show but the meter and the figures section do not", async ({ page }) => {
  await serveReference(page, (b) => ({ ...b, training: null, figures: null, gap: null, finding: null, sentences: null, words: null,
    meter: null, message: "The accuracy figures could not be loaded." }));
  await page.goto("/");
  const ref = await reference(page);
  await expect(page.getByTestId("reference-error")).toContainText("could not be loaded");
  await expect(page.getByTestId("intro-lead")).toHaveText(ref.goal.lead);
  await expect(page.getByTestId("goal")).toContainText(ref.goal.text);
  await expect(page.getByTestId("meter")).toHaveCount(0);
  await expect(page.getByTestId("reference-details")).toBeHidden();
  await expect(page.getByTestId("chips")).toBeVisible();
  await expect(page.getByTestId("play")).toBeEnabled();
});

test("until the figures arrive the meter area is empty and shows no number", async ({ page }) => {
  let release: () => void = () => undefined;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  await page.route("**/api/reference", async (route) => { await gate; await route.continue(); });
  await page.goto("/");
  await expect(page.getByTestId("chips")).toBeVisible();
  await page.waitForTimeout(300);
  expect(((await page.getByTestId("reference").textContent()) ?? "").trim()).toBe("");
  await expect(page.getByTestId("meter")).toHaveCount(0);
  release();
  await expect(page.getByTestId("meter")).toBeVisible();
});


// ---------------- 008: the test population ----------------

test("the introduction says what the agent is tested on, in words only", async ({ page }) => {
  await page.goto("/");
  const sentence = page.getByTestId("intro-population");
  await expect(sentence).toBeVisible();
  await expect(sentence).toContainText("IPL");
  await expect(sentence).toContainText("BBL");
  await expect(sentence).toContainText("T20 internationals");
  await expect(sentence).toContainText("ICC full members");
  expect(((await sentence.textContent()) ?? "").replace(/T20/g, "")).not.toMatch(/\d/);
});

test("the reference figures are on the test population before the first check year and equal the server's", async ({ page }) => {
  await page.goto("/");
  const ref = await reference(page);
  await expect(page.getByTestId("meter")).toBeVisible();
  expect(ref.training!.innings).toBeLessThan(4000);                      // fewer than all the early innings (about 4,000)
  await expect(page.getByTestId("meter-caption")).toContainText(ref.training!.innings.toLocaleString("en-US"));
});
