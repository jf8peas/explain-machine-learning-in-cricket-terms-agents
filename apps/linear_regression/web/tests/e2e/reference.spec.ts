import { expect, test, type Page } from "./fixtures";
import { open, playToEnd, serveRun, sse, timelineItems } from "./helpers";

// How good the references are: the introduction before any run, and the final results after one. Every figure on the
// page is compared with what the server sent, never with a number typed in here.

interface Figures { n: number; average_miss: number; within_10: number; within_20: number; miss_percent: number; bias: number }
interface Reference {
  goal: { reference: string; margin_runs: number; text: string };
  methods: { id: string; name: string; note: string; marker: string }[];
  training: { first_year: number; last_year: number; innings: number } | null;
  figures: { know_nothing: Figures; broadcaster: Figures } | null;
  gap: { average_miss_runs: number; average_miss_percent: number; within_10_points: number } | null;
  finding: string | null;
  sentences: { headline: string; gap: string; finding: string; bias: string } | null;
  words: Record<string, { bias: string; bias_short: string }> | null;
  message: string | null;
}

const reference = async (page: Page) => (await (await page.request.get("/api/reference")).json()) as Reference;
const row = (page: Page, method: string) => page.locator(`[data-testid="reference-row"][data-method="${method}"]`);
const cell = (page: Page, method: string, col: string) => row(page, method).locator(`[data-col="${col}"]`);

/** Answer /api/reference with the real response changed by `change`. */
async function serveReference(page: Page, change: (body: Reference) => Reference) {
  const real = await reference(page);
  await page.route("**/api/reference", (route) => route.fulfill({ json: change(structuredClone(real)) }));
}

// ---------------- US1: the introduction ----------------

test("before any run the introduction shows both references with every measure, equal to the server's figures", async ({ page }) => {
  await page.goto("/");
  const ref = await reference(page);
  await expect(page.getByTestId("reference-table")).toBeVisible();
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
  expect(ref.finding).toBe("clearly_better");
  await expect(page.getByTestId("reference-lead")).toHaveText(ref.sentences!.headline);
  await expect(page.getByTestId("reference-note")).toContainText(ref.sentences!.gap);
  await expect(page.getByTestId("reference-note")).not.toContainText("only slightly better");
  await expect(page.getByTestId("reference-lead")).toContainText(String(ref.training!.first_year));
  await expect(page.getByTestId("reference-lead")).toContainText(String(ref.training!.last_year));
});

test("when the projection is barely better than, or worse than, knowing nothing the introduction says so plainly", async ({ page }) => {
  for (const finding of ["slightly_better", "no_better"]) {
    await serveReference(page, (b) => ({ ...b, finding, sentences: { ...b.sentences!, finding: `FINDING ${finding}: beating it means little.` } }));
    await page.goto("/");
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
  await expect(page.getByTestId("reference-table")).toBeVisible();                       // the block has arrived
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
    message: "The accuracy figures could not be loaded." }));
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
  await expect(page.getByTestId("reference-table")).toBeVisible();
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
    await page.getByTestId("play").click();
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
  await toggle(page, "know_nothing").click();
  await page.keyboard.press("ArrowLeft");
  await page.keyboard.press("ArrowRight");
  await expect(toggle(page, "know_nothing")).toHaveAttribute("aria-pressed", "true");
});

test("the plot is square, with the same range on both axes and the diagonal corner to corner", async ({ page }) => {
  await open(page, 40);
  await playToEnd(page);
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
  await toggle(page, "know_nothing").click();
  const running = await page.getByTestId("accuracy-chart").evaluate((e) => (e as HTMLElement).getAnimations({ subtree: true }).length);
  expect(running).toBe(0);
});


// ---------------- US4: the verdict, and setting expectations ----------------

test("near the final results the page says no method can be perfect, in plain words and without any figure", async ({ page }) => {
  await open(page, 40);
  await playToEnd(page);
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
  await expect(page.getByTestId("reference-table")).toBeVisible();
  const sizes = await page.evaluate(() => {
    const box = document.querySelector('[data-testid="reference-table"]')!.closest(".table-scroll") as HTMLElement;
    return { scroll: box.scrollWidth, client: box.clientWidth };
  });
  expect(sizes.scroll).toBeLessThanOrEqual(sizes.client);
});
