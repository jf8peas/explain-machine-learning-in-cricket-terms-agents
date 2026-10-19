import { expect, test, type Page } from "./fixtures";
import { open, openTab, playToEnd, serveRun, sse, timelineItems } from "./helpers";

// The final test tab (feature 015): three numbered sections, none collapsible. Against the real app with the scripted fake
// model; no test calls a real model. States are read from the page's own state panel, and crafted ones are served as a
// one-step run so the verdict variants and the figure sets can be varied.

interface Figures { n: number; average_miss: number; within_10: number; within_20: number; bias: number }
interface Final {
  winner: "llm" | "forward"; llm_took_part: boolean; methods: string[]; accuracy: Record<string, Figures>;
  bias_phrases: Record<string, string>; [k: string]: unknown;
}
interface Block { id: string; title: string; sentences: string[]; visual: Record<string, unknown>; from_model?: string[] }
interface Explanation {
  facts: Record<string, { value: unknown; display: string }>; blocks: Block[]; order: string[];
  source: string; model: string | null; fallback_reason: string | null;
}

const panel = async <T>(page: Page, key: string): Promise<T> => JSON.parse((await page.locator(`[data-key="${key}"] pre`).textContent()) ?? "{}");
const finalOf = (page: Page) => panel<Final>(page, "final");
const explanationOf = (page: Page) => panel<Explanation>(page, "explanation");
const splitOf = (page: Page) => panel<{ test_year: number }>(page, "split");

/** The real run's state, then a one-step run served with the patched final and explanation, played to its end. */
async function craft(page: Page, patch: (final: Final, expl: Explanation) => void, model?: string) {
  await open(page, 40);
  if (model) await page.getByTestId("model-select").selectOption({ label: model });
  await playToEnd(page);
  const final = await finalOf(page), expl = await explanationOf(page), split = await splitOf(page);
  patch(final, expl);
  await serveRun(page, sse("step", { step: 1, node: "explain_in_cricket_terms", summary: "x", changes: { final, explanation: expl, split } }) + sse("done", { steps: 1 }));
  await page.reload();
  await openTab(page, "working");
  await page.getByTestId("play").click();
  await expect(page.getByTestId("tab-found")).toHaveAttribute("aria-selected", "true", { timeout: 15_000 });
  await openTab(page, "final-test");
}

const rowIds = (page: Page, testid: string) => page.getByTestId(testid).evaluateAll((els) => els.map((e) => e.getAttribute("data-method")));

// ---------------- structure ----------------

test("the tab has a header and three numbered sections with one heading style and nothing collapsible", async ({ page }) => {
  await open(page);
  await playToEnd(page);
  await openTab(page, "final-test");
  const split = await splitOf(page), final = await finalOf(page);
  await expect(page.getByTestId("final-header")).toContainText(`${split.test_year}: a season nothing learned from or was chosen on`);
  await expect(page.getByTestId("final-header")).toContainText(`each of its ${final.accuracy.broadcaster.n} innings`);
  for (const n of [1, 2, 3]) {
    const section = page.getByTestId(`final-section-${n}`);
    await expect(section).toBeVisible();
    await expect(section.locator("h3").first()).toHaveText(new RegExp(`^${n}\\. `));
  }
  await expect(page.getByTestId("final-section-1").locator("h3")).toHaveText("1. Who won the prediction race?");
  await expect(page.getByTestId("final-section-2").locator("h3")).toHaveText("2. How close did each one get?");
  await expect(page.getByTestId("final-section-3").locator("h3")).toHaveText("3. In cricket terms: what this tells us");
  expect(await page.getByTestId("final-panel").locator("details, summary, [aria-expanded]").count()).toBe(0);
  expect(await page.getByTestId("final-panel").locator(".eyebrow, .hero-eyebrow").count()).toBe(0);
});

test("the removed parts are gone: no comparison box, accuracy table, scatter plot, share-of-a-typical-total or R squared", async ({ page }) => {
  await open(page);
  await playToEnd(page);
  await openTab(page, "final-test");
  for (const id of ["comparison", "accuracy-table", "accuracy-chart", "chart-toggle", "winner", "reference-finding", "expectations-note"]) {
    await expect(page.getByTestId(id)).toHaveCount(0);
  }
  const text = (await page.getByTestId("final-panel").textContent()) ?? "";
  expect(text).not.toMatch(/R²|R2|typical total|How it was chosen|share of a typical/i);
});

// ---------------- section 1 ----------------

test("section 1 ranks the methods by average miss as bars from zero, with the values from the run", async ({ page }) => {
  await open(page);
  await playToEnd(page);
  await openTab(page, "final-test");
  const final = await finalOf(page);
  const expected = [...final.methods].sort((a, b) => final.accuracy[a].average_miss - final.accuracy[b].average_miss);
  expect(await rowIds(page, "race-row")).toEqual(expected);
  const values = await page.getByTestId("race-value").allTextContents();
  expect(values).toEqual(expected.map((m) => final.accuracy[m].average_miss.toFixed(1)));
  const places = await page.getByTestId("race-row").evaluateAll((els) => els.map((e) => e.getAttribute("data-place")));
  expect(places).toEqual(expected.map((_, i) => String(i + 1)));
  // one shared scale from zero: a bar's width is its miss over the scale's end, the next 10 runs up
  const end = Math.ceil(Math.max(...expected.map((m) => final.accuracy[m].average_miss)) / 10 - 1e-9) * 10;
  const ticks = await page.getByTestId("race-tick").allTextContents();
  expect(ticks.map(Number)).toEqual(Array.from({ length: end / 10 + 1 }, (_, i) => i * 10));
  for (const m of expected) {
    const w = await page.locator(`[data-testid="race-bar"][data-method="${m}"]`).evaluate((el) => (el as HTMLElement).style.width);
    expect(parseFloat(w)).toBeCloseTo((final.accuracy[m].average_miss / end) * 100, 3);
  }
  await expect(page.getByTestId("final-section-1")).toContainText("Shorter bar = more accurate");
  await expect(page.getByTestId("final-section-1")).toContainText("runs off, on average");
});

test("section 1 marks the chosen model with 'our pick', and tells the methods apart without colour", async ({ page }) => {
  await open(page);
  await playToEnd(page);
  await openTab(page, "final-test");
  const final = await finalOf(page);
  const pick = page.getByTestId("race-pick");
  await expect(pick).toHaveCount(1);
  await expect(pick).toHaveText("our pick, chosen before the test");
  await expect(page.locator(`[data-testid="race-row"][data-method="${final.winner}"]`).getByTestId("race-pick")).toBeVisible();
  const hatched = await page.locator('[data-testid="race-bar"][data-hatched]').evaluateAll((els) => els.map((e) => e.getAttribute("data-method")));
  expect(hatched).toEqual(["broadcaster"]);
  const names = await page.locator(".race-method").allTextContents();
  expect(names.length).toBe(final.methods.length);
  for (const n of names) expect(n.length).toBeGreaterThan(5);                  // every bar carries a word label
});

for (const [name, patch, variant, shape, text] of [
  ["reached", (e: Explanation) => { const v = e.blocks.find((b) => b.id === "verdict")!; v.title = "Goal reached"; v.sentences = ["CRAFTED reached."]; v.visual = { variant: "reached", shape: "tick", race_leader_differs: false }; }, "reached", "tick", "CRAFTED reached."],
  ["beat but short", (e: Explanation) => { const v = e.blocks.find((b) => b.id === "verdict")!; v.title = "Goal missed"; v.sentences = ["CRAFTED short."]; v.visual = { variant: "missed_beat", shape: "dash", race_leader_differs: false }; }, "missed_beat", "dash", "CRAFTED short."],
  ["not beaten", (e: Explanation) => { const v = e.blocks.find((b) => b.id === "verdict")!; v.title = "Goal missed"; v.sentences = ["CRAFTED worse."]; v.visual = { variant: "missed_worse", shape: "cross", race_leader_differs: false }; }, "missed_worse", "cross", "CRAFTED worse."],
] as const) {
  test(`the verdict line for "${name}" has its own shape, wording and tint`, async ({ page }) => {
    await craft(page, (_f, e) => patch(e));
    const line = page.getByTestId("verdict");
    await expect(line).toHaveAttribute("data-variant", variant);
    await expect(line).toContainText(text);
    await expect(line).toContainText(/Goal (reached|missed)\./);
    await expect(page.getByTestId("verdict-shape")).toHaveAttribute("data-shape", shape);
    await expect(line).toHaveClass(variant === "reached" ? /win/ : /lose/);
    await expect(page.getByTestId("verdict-leader")).toHaveCount(0);
  });
}

test("the extra sentence under the verdict appears when another method had the shortest bar", async ({ page }) => {
  await craft(page, (_f, e) => {
    const v = e.blocks.find((b) => b.id === "verdict")!;
    v.sentences = ["CRAFTED main.", "CRAFTED The rival's model had the shortest bar, but the choice was made before the test."];
    v.visual = { ...v.visual, race_leader_differs: true };
  });
  await expect(page.getByTestId("verdict-leader")).toContainText("choice was made before the test");
});

// ---------------- section 2 ----------------

test("section 2 splits each method's bar into three shares that add to 100, from the displayed figures", async ({ page }) => {
  await open(page);
  await playToEnd(page);
  await openTab(page, "final-test");
  const final = await finalOf(page);
  const expected = [...final.methods].sort((a, b) => final.accuracy[a].average_miss - final.accuracy[b].average_miss);
  expect(await rowIds(page, "close-row")).toEqual(expected);                         // section 1's order
  for (const m of expected) {
    const a = final.accuracy[m];
    const w10 = Math.round(a.within_10), w20 = Math.max(w10, Math.round(a.within_20));
    const row = page.locator(`[data-testid="close-row"][data-method="${m}"]`);
    const shown = (await row.getByTestId("close-seg").allTextContents()).map((t) => parseInt(t, 10));
    expect(shown).toEqual([w10, w20 - w10, 100 - w20]);
    expect(shown.reduce((x, y) => x + y, 0)).toBe(100);
    await expect(row.getByTestId("close-bias")).toHaveText(final.bias_phrases[m]);
  }
  await expect(page.getByTestId("close-key")).toContainText("within 10 runs");
  await expect(page.getByTestId("close-key")).toContainText("10 to 20 runs off");
  await expect(page.getByTestId("close-key")).toContainText("more than 20 runs off");
  await expect(page.getByTestId("close-note")).toContainText("No method can be perfect from the halfway mark");
});

for (const [name, within10, within20] of [["a low spread", 8.4, 19.9], ["a high spread", 71.3, 93.6], ["equal figures", 40.0, 40.0]] as const) {
  test(`the three shares add to 100 for ${name}`, async ({ page }) => {
    await craft(page, (f) => {
      for (const m of f.methods) { f.accuracy[m].within_10 = within10; f.accuracy[m].within_20 = within20; }
    });
    const rows = page.getByTestId("close-row");
    for (let i = 0; i < (await rows.count()); i++) {
      const shown = (await rows.nth(i).getByTestId("close-seg").allTextContents()).map((t) => parseInt(t, 10));
      expect(shown.reduce((x, y) => x + y, 0)).toBe(100);
    }
  });
}

test("the TV's bias is emphasised only when the run says it is large", async ({ page }) => {
  await craft(page, (_f, e) => { e.facts.tv_bias_large = { value: true, display: "yes" }; });
  await expect(page.locator('[data-testid="close-row"][data-method="broadcaster"] [data-testid="close-bias"]')).toHaveAttribute("data-large", "true");
  await expect(page.locator('[data-testid="close-row"][data-method="know_nothing"] [data-testid="close-bias"]')).toHaveAttribute("data-large", "false");
  await craft(page, (_f, e) => { e.facts.tv_bias_large = { value: false, display: "no" }; });
  await expect(page.locator('[data-testid="close-bias"][data-large="true"]')).toHaveCount(0);
});

// ---------------- section 3 ----------------

test("section 3 has three takeaways in order and a rule of thumb, written by the model with every number from code", async ({ page }) => {
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
  expect(by("verdict").from_model).toEqual([]);                                        // code only
  expect(by("rule_of_thumb").from_model).toEqual([]);
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
  const table = page.getByTestId("drivers-table").locator("tbody tr");
  await expect(table).toHaveCount(rows.length);
  expect(await page.getByTestId("drivers-table").evaluate((el) => el.closest(".visually-hidden") !== null)).toBe(true);
});

test("without the model's wording the label says template wording", async ({ page }) => {
  await open(page);
  await page.getByTestId("model-select").selectOption({ label: "Unreliable" });
  await playToEnd(page);
  await openTab(page, "final-test");
  const expl = await explanationOf(page);
  expect(expl.source).toBe("template");
  await expect(page.getByTestId("writer-label")).toHaveAttribute("data-source", "template");
  await expect(page.getByTestId("writer-label")).toHaveText("Template wording · every number from code");
  await expect(page.getByTestId("takeaway")).toHaveCount(3);
});

test("markup in the model's wording is shown as text", async ({ page }) => {
  await open(page);
  await page.getByTestId("model-select").selectOption({ label: "Markup" });
  await playToEnd(page);
  await openTab(page, "final-test");
  await expect(page.getByTestId("final-section-3")).toContainText("<script>");
  expect(await page.getByTestId("final-section-3").locator("script, b").count()).toBe(0);
  expect(await page.evaluate(() => (window as unknown as { __pwned?: boolean }).__pwned)).toBeUndefined();
});

// ---------------- without the AI model ----------------

test("without the AI model there are three rows in sections 1 and 2 and the verdict names the rival's model", async ({ page }) => {
  await open(page);
  await page.getByTestId("model-select").selectOption({ label: "Unreliable" });
  await playToEnd(page);
  await openTab(page, "final-test");
  const final = await finalOf(page);
  expect(final.llm_took_part).toBe(false);
  expect(await rowIds(page, "race-row")).toHaveLength(3);
  expect(await rowIds(page, "close-row")).toHaveLength(3);
  expect(await rowIds(page, "race-row")).not.toContain("llm");
  await expect(page.getByTestId("verdict")).toContainText("rival's model");
  await expect(page.getByTestId("verdict")).not.toContainText("AI agent's model");
});

// ---------------- every number matches the run ----------------

test("every number on the tab is one the run's state holds", async ({ page }) => {
  await open(page);
  await playToEnd(page);
  await openTab(page, "final-test");
  const final = await finalOf(page), expl = await explanationOf(page), split = await splitOf(page);
  const allowed = new Set<number>([1, 2, 3, 4, 0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100, split.test_year]);   // places, sections, takeaways, axis, bands
  for (const m of final.methods) {
    const a = final.accuracy[m];
    for (const v of [a.average_miss, a.within_10, a.within_20, Math.abs(a.bias), a.n]) allowed.add(Number(v.toFixed(1)));
    const w10 = Math.round(a.within_10), w20 = Math.max(w10, Math.round(a.within_20));
    for (const v of [w10, w20 - w10, 100 - w20]) allowed.add(v);
    for (const t of final.bias_phrases[m].match(/\d+(?:\.\d+)?/g) ?? []) allowed.add(Number(t));
  }
  for (const f of Object.values(expl.facts)) for (const t of f.display.match(/\d+(?:\.\d+)?/g) ?? []) allowed.add(Number(t));
  for (const b of expl.blocks) {
    const rows = (b.visual.rows as { display: string }[] | undefined) ?? [];
    for (const r of rows) allowed.add(Number(r.display));
  }
  // every text node on its own, so a value is never run into the next label (the "17.8" before "2nd")
  const text = await page.getByTestId("results-final").evaluate((root) => {
    const parts: string[] = [];
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) parts.push(n.textContent ?? "");
    return parts.join(" ");
  });
  const tokens = text.replace(/(\d)(st|nd|rd|th)/g, "$1").match(/\d+(?:\.\d+)?/g) ?? [];
  expect(tokens.length).toBeGreaterThan(20);
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
  await expect(page.getByTestId("final-section-1")).toBeVisible();
  await expect(page.getByTestId("final-section-2")).toBeVisible();
  await expect(page.getByTestId("race-row").first()).toBeVisible();
  await expect(page.getByTestId("verdict")).toHaveCount(0);
  await expect(page.getByTestId("close-note")).toHaveCount(0);
  await expect(page.getByTestId("final-section-3")).toHaveCount(0);
  await showStep("explain_in_cricket_terms");
  await expect(page.getByTestId("verdict")).toBeVisible();
  await expect(page.getByTestId("final-section-3")).toBeVisible();
  await expect(page.getByTestId("writer-label")).toHaveAttribute("data-source", "template");     // the code step: template wording
  await showStep("write_in_cricket_terms");
  await expect(page.getByTestId("writer-label")).toHaveAttribute("data-source", "language model");
  await showStep("baseline");
  await expect(page.getByTestId("final-section-1")).toHaveCount(0);
  await expect(page.getByTestId("final-panel").locator(".not-ready")).toBeVisible();
});

// ---------------- phone, themes, motion ----------------

test("at 360 px the tab fits and the page does not scroll sideways", async ({ page }) => {
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
  // the takeaways stack, the method name sits above its bar
  const cards = await page.getByTestId("takeaway").evaluateAll((els) => els.map((e) => e.getBoundingClientRect().top));
  expect(new Set(cards.map(Math.round)).size).toBe(3);
  const row = page.getByTestId("race-row").first();
  const name = (await row.locator(".race-name").boundingBox())!, area = (await row.locator(".race-area").boundingBox())!;
  expect(area.y).toBeGreaterThanOrEqual(name.y + name.height - 1);
});

test("at desktop width the takeaways sit side by side", async ({ page }) => {
  await page.setViewportSize({ width: 1200, height: 900 });
  await open(page, 40);
  await playToEnd(page);
  await openTab(page, "final-test");
  const tops = await page.getByTestId("takeaway").evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().top)));
  expect(new Set(tops).size).toBe(1);
});

for (const scheme of ["light", "dark"] as const) {
  test(`the tab is drawn in the ${scheme} theme with text that contrasts with its box`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: scheme });
    await open(page, 40);
    await playToEnd(page);
    await openTab(page, "final-test");
    const colours = await page.evaluate(() => {
      const css = (sel: string, prop: string) => getComputedStyle(document.querySelector(sel) as Element).getPropertyValue(prop);
      return {
        verdictText: css('[data-testid="verdict"]', "color"), verdictBg: css('[data-testid="verdict"]', "background-color"),
        ruleText: css('[data-testid="rule-of-thumb"]', "color"), ruleBg: css('[data-testid="rule-of-thumb"]', "background-color"),
        d: css('[data-band="within10"]', "color"), dBg: css('[data-band="within10"]', "background-color"),
        m: css('[data-band="within20"]', "color"), mBg: css('[data-band="within20"]', "background-color"),
        l: css('[data-band="over20"]', "color"), lBg: css('[data-band="over20"]', "background-color"),
        bar: css('[data-testid="race-bar"]', "background-color"), page: css("body", "background-color"),
      };
    });
    expect(colours.verdictText).not.toBe(colours.verdictBg);
    expect(colours.ruleText).not.toBe(colours.ruleBg);
    expect(colours.d).not.toBe(colours.dBg);
    expect(colours.m).not.toBe(colours.mBg);
    expect(colours.l).not.toBe(colours.lBg);
    expect(new Set([colours.dBg, colours.mBg, colours.lBg]).size).toBe(3);               // three distinct shades
    expect(colours.bar).not.toBe(colours.page);
  });
}

test("nothing on the tab is animated", async ({ page }) => {
  await open(page, 40);
  await playToEnd(page);
  await openTab(page, "final-test");
  const running = await page.getByTestId("results-final").evaluate((e) => (e as HTMLElement).getAnimations({ subtree: true }).length);
  expect(running).toBe(0);
  const durations = await page.getByTestId("results-final").locator("*").evaluateAll(
    (els) => els.map((el) => getComputedStyle(el).transitionDuration + "|" + getComputedStyle(el).animationName));
  for (const d of durations) expect(["0s|none", "|none", "0s|", ""].some((ok) => d === ok) || /^0s(, 0s)*\|none$/.test(d)).toBe(true);
});
