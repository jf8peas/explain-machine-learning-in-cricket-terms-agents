import { expect, test, type Page } from "./fixtures";
import { open, playToEnd, serveStructure, timelineItems } from "./helpers";

// Stage badges and rows, the legend, the panel and timeline cues, the done-beforehand item and the loop emphasis,
// against the real app with the scripted fake model. Stage names come from /api/structure, never from this file.

// The numbers follow the order a run first reaches each stage.
const NUMBER_OF: Record<string, number> = {
  load_data: 1, split: 2, explore: 3, baseline: 4, propose_features: 5, check_proposal: 5, evaluate: 5,
  grid_search: 5, fit_model: 6, final_test: 7, explain_in_cricket_terms: 8,
};

const node = (page: Page, id: string) => page.locator(`[data-node="${id}"]`);
// the badge group also holds a tooltip <title>, so the number is read from its <text>
const badge = (page: Page, id: string) => node(page, id).getByTestId("stage-badge");
const badgeNumber = (page: Page, id: string) => badge(page, id).locator("text");

async function structure(page: Page) {
  return (await (await page.request.get("/api/structure")).json()) as {
    stages: { id: string; number: number; name: string; question: string }[];
    nodes: { id: string; kind: string; stage?: string }[];
  };
}

const box = async (loc: ReturnType<Page["locator"]>) => {
  const b = await loc.boundingBox();
  if (!b) throw new Error("no box");
  return b;
};
const overlap = (a: { x: number; y: number; width: number; height: number }, b: typeof a) =>
  a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;

// ---------------- US1: badges and rows ----------------

test("every step shows its stage number on a badge, and the eight numbers differ", async ({ page }) => {
  await open(page);
  for (const [id, n] of Object.entries(NUMBER_OF)) await expect(badgeNumber(page, id)).toHaveText(String(n));
  await expect(page.getByTestId("stage-badge")).toHaveCount(Object.keys(NUMBER_OF).length + 1);   // and the done-beforehand item's
  const numbers = new Set((await page.getByTestId("stage-badge").locator("text").allTextContents()).map((t) => t.trim()));
  expect([...numbers].sort()).toEqual(["1", "2", "3", "4", "5", "6", "7", "8"]);
  await expect(badge(page, "__start__")).toHaveCount(0);
  await expect(badge(page, "__end__")).toHaveCount(0);
});

test("the badge numbers agree with the stage the server sent for each node", async ({ page }) => {
  await open(page);
  const s = await structure(page);
  for (const n of s.nodes.filter((x) => x.kind === "node")) {
    const stage = s.stages.find((x) => x.id === n.stage)!;
    await expect(badgeNumber(page, n.id)).toHaveText(String(stage.number));
    await expect(node(page, n.id)).toHaveAttribute("data-stage", stage.id);
  }
});

test("the graph is one row per stage: Start, the stages in the server's order, then Finish", async ({ page }) => {
  await open(page);
  const s = await structure(page);
  const rows = page.getByTestId("stage-band");
  await expect(rows).toHaveCount(s.stages.length + 2);
  await expect(rows.first()).toHaveAttribute("data-row", "start");
  await expect(rows.last()).toHaveAttribute("data-row", "end");
  for (const [i, st] of s.stages.entries()) {
    const row = rows.nth(i + 1);
    await expect(row).toHaveAttribute("data-stage", st.id);
    await expect(row.locator(".band-name")).toHaveText(st.name);
    await expect(row.locator(".band-number")).toHaveText(String(st.number));
  }
  await expect(rows.first().locator(".band-name")).toHaveText("Start");
  await expect(rows.first().locator(".band-badge")).toHaveCount(0);
  await expect(rows.last().locator(".band-name")).toHaveText("Finish");
});

test("rows are full width, tinted and borderless, stacked with no gaps", async ({ page }) => {
  await open(page);
  const rects = page.getByTestId("stage-band").locator("rect");
  const styles = await rects.evaluateAll((els) => els.map((el) => {
    const cs = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    return { stroke: cs.stroke, opacity: cs.fillOpacity, x: r.x, width: r.width, top: r.top, bottom: r.bottom };
  }));
  for (const st of styles) { expect(st.stroke).toBe("none"); expect(Number(st.opacity)).toBeLessThanOrEqual(0.1); }
  for (const st of styles) { expect(st.x).toBeCloseTo(styles[0].x, 0); expect(st.width).toBeCloseTo(styles[0].width, 0); }
  for (let i = 1; i < styles.length; i++) expect(styles[i].top).toBeCloseTo(styles[i - 1].bottom, 0);
});

test("every step sits inside the row of its stage, and the rows sit behind the nodes", async ({ page }) => {
  await open(page);
  const s = await structure(page);
  for (const n of s.nodes.filter((x) => x.kind === "node")) {
    const row = await box(page.locator(`[data-testid="stage-band"][data-stage="${n.stage}"] rect`));
    const b = await box(node(page, n.id).locator("rect").first());
    expect(b.y, `${n.id} top`).toBeGreaterThanOrEqual(row.y - 0.5);
    expect(b.y + b.height, `${n.id} bottom`).toBeLessThanOrEqual(row.y + row.height + 0.5);
  }
  // bottom layer: the rows come before every edge and node in the SVG
  expect(await page.locator("svg > g").first().getAttribute("class")).toContain("bands");
});

test("the main sequence is one vertical line and fit_model sits under check_proposal", async ({ page }) => {
  await open(page);
  const centre = async (id: string) => { const b = await box(node(page, id).locator("rect, circle").first()); return b.x + b.width / 2; };
  const spine = [];
  for (const id of ["load_data", "split", "explore", "baseline", "propose_features"]) spine.push(await centre(id));
  for (const x of spine) expect(x).toBeCloseTo(spine[0], 0);
  expect(await centre("fit_model")).toBeCloseTo(await centre("check_proposal"), 0);
  expect((await box(node(page, "fit_model"))).y).toBeGreaterThan((await box(node(page, "check_proposal"))).y);
});

test("badge, visit tick and the LLM tag do not overlap on the busiest nodes after a run", async ({ page }) => {
  await open(page);
  await playToEnd(page);
  for (const id of ["fit_model", "propose_features"]) {
    const b = await box(badge(page, id));
    const tick = node(page, id).locator(".tick");
    await expect(tick).toBeVisible();
    expect(overlap(b, await box(tick))).toBe(false);
    await expect(node(page, id).locator(".count-bg, .count")).toHaveCount(0);
  }
  const tag = node(page, "propose_features").locator(".actor-tag-bg");
  await expect(tag).toBeVisible();
  expect(overlap(await box(node(page, "propose_features").locator(".tick")), await box(tag))).toBe(false);
  expect(overlap(await box(badge(page, "propose_features")), await box(tag))).toBe(false);
});

test("the run states and the language-model marking are unchanged on nodes that show a badge", async ({ page }) => {
  await open(page);
  await expect(node(page, "propose_features")).toHaveAttribute("data-actor", "llm");
  await expect(node(page, "propose_features").locator(".actor-tag")).toHaveText("LLM");
  await expect(node(page, "fit_model")).toHaveAttribute("data-actor", "code");
  await playToEnd(page);
  await timelineItems(page).first().click();                 // jump back to the first step
  await expect(page.locator(".node.active")).toHaveCount(1);
  await expect(node(page, "load_data")).toHaveClass(/active/);
  await expect(node(page, "load_data")).toHaveClass(/visited/);
  await timelineItems(page).nth(1).click();
  await expect(node(page, "load_data")).not.toHaveClass(/active/);
  await expect(node(page, "load_data")).toHaveClass(/visited/);
  await expect(badge(page, "load_data")).toBeVisible();
});

for (const scheme of ["light", "dark"] as const) {
  test(`badges are drawn in the ${scheme} theme with that theme's stage colours`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: scheme });
    await open(page);
    await expect(page.getByTestId("stage-badge")).toHaveCount(12);                  // 11 steps and the item
    const fills = await page.getByTestId("stage-badge").evaluateAll((els) =>
      els.map((e) => getComputedStyle(e.querySelector("circle") as SVGCircleElement).fill));
    expect(new Set(fills).size).toBe(8);                       // eight stages, eight colours
    const stage1 = await badge(page, "load_data").locator("circle").evaluate((c) => getComputedStyle(c).fill);
    expect(stage1).toBe(scheme === "light" ? "rgb(138, 90, 0)" : "rgb(184, 134, 63)");
  });
}

// ---------------- US2: the legend ----------------

const legendStage = (page: Page, id: string) => page.locator(`[data-testid="legend-stage"][data-stage="${id}"]`);
const live = (page: Page) => page.getByTestId("legend-live");
const dimmed = (page: Page) => page.locator("[data-node].dim");

test("the legend lists the eight stages in order with badge, name and question", async ({ page }) => {
  await open(page);
  const s = await structure(page);
  const entries = page.getByTestId("legend-stage");
  await expect(entries).toHaveCount(8);
  for (const [i, st] of s.stages.entries()) {
    const entry = entries.nth(i);
    await expect(entry).toHaveAttribute("data-stage", st.id);
    await expect(entry.locator(".badge")).toHaveText(String(st.number));
    await expect(entry.locator(".name")).toHaveText(st.name);
    await expect(entry.locator(".question")).toHaveText(st.question);
  }
  await expect(page.getByTestId("legend-all")).toBeVisible();
});

test("Choose the setup explains hyperparameters and says this is the first time the site tunes them", async ({ page }) => {
  await open(page);
  const note = legendStage(page, "choose").locator(".stage-note");
  await expect(note).toContainText("training window");
  await expect(note).toContainText("recency weighting");
  await expect(note).toContainText("hyperparameters: settings chosen before fitting");
  await expect(note).toContainText("first app on the site to tune them");
  await expect(note).not.toContainText("later apps");
});

test("Split the data describes the three check years", async ({ page }) => {
  await open(page);
  const note = legendStage(page, "split").locator(".stage-note");
  await expect(note).toContainText("three check years");
  await expect(note).toContainText("only from the years before it");
  await expect(note).toContainText("ICC full members");
});

test("a stage with no node is marked 'Not a step in this agent' with its reason", async ({ page }) => {
  await serveStructure(page, {
    nodes: [{ id: "__start__", kind: "start" }, { id: "a", kind: "node", stage: "s1" }, { id: "__end__", kind: "end" }],
    edges: [{ source: "__start__", target: "a", conditional: false, branch: null },
            { source: "a", target: "__end__", conditional: false, branch: null }],
    stages: [
      { id: "s1", number: 1, name: "First", question: "Q1?", description: "One." },
      { id: "s2", number: 2, name: "Second", question: "Q2?", description: "Two." },
    ],
    notes: { stages: { s2: "This agent has no second stage." } },
  });
  await page.goto("/");
  const empty = legendStage(page, "s2");
  await expect(empty).toContainText("Not a step in this agent");
  await expect(empty).toContainText("This agent has no second stage.");
  await expect(legendStage(page, "s1")).not.toContainText("Not a step in this agent");
});

test("selecting a stage highlights its nodes and row and dims the rest; again, or All, clears it", async ({ page }) => {
  await open(page);
  await expect(dimmed(page)).toHaveCount(0);
  await legendStage(page, "fit").click();
  await expect(legendStage(page, "fit")).toHaveAttribute("aria-pressed", "true");
  await expect(node(page, "fit_model")).not.toHaveClass(/dim/);
  await expect(node(page, "fit_model")).toHaveClass(/stage-selected/);
  for (const id of ["load_data", "split", "propose_features", "evaluate", "final_test", "__start__"]) {
    await expect(node(page, id)).toHaveClass(/dim/);
  }
  await expect(page.locator('[data-testid="stage-band"][data-stage="choose"]')).toHaveClass(/dim/);
  await expect(page.locator('[data-testid="stage-band"][data-row="start"]')).toHaveClass(/dim/);
  await expect(page.locator('[data-testid="stage-band"][data-stage="fit"]')).not.toHaveClass(/dim/);
  await legendStage(page, "fit").click();                                    // again clears
  await expect(dimmed(page)).toHaveCount(0);
  await legendStage(page, "choose").click();
  await expect(node(page, "evaluate")).not.toHaveClass(/dim/);
  await expect(node(page, "fit_model")).toHaveClass(/dim/);
  await page.getByTestId("legend-all").click();                              // All clears
  await expect(dimmed(page)).toHaveCount(0);
  await expect(page.locator('[aria-pressed="true"]')).toHaveCount(0);
});

test("the legend works by keyboard and announces the selection", async ({ page }) => {
  await open(page);
  await legendStage(page, "split").focus();
  await page.keyboard.press("Enter");
  await expect(legendStage(page, "split")).toHaveAttribute("aria-pressed", "true");
  await expect(node(page, "split")).not.toHaveClass(/dim/);
  const s = await structure(page);
  const split = s.stages.find((x) => x.id === "split")!;
  await expect(live(page)).toContainText(`stage ${split.number}`);
  await expect(live(page)).toContainText(split.name);
  await page.keyboard.press("Space");                                        // Space toggles it off again
  await expect(dimmed(page)).toHaveCount(0);
  await expect(live(page)).toContainText("cleared");
  await expect(live(page)).toHaveAttribute("role", "status");
  await expect(live(page)).toHaveAttribute("aria-live", "polite");
});

test("keyboard focus on a legend button is visible", async ({ page }) => {
  await open(page);
  await page.getByTestId("legend-all").focus();
  await page.keyboard.press("Shift+Tab");                                    // back to the last stage, by keyboard
  const outline = await page.evaluate(() => {
    const el = document.querySelector("graph-replay")!.shadowRoot!.activeElement as HTMLElement;
    const cs = getComputedStyle(el);
    return { id: el.dataset.stage ?? "", style: cs.outlineStyle, width: parseFloat(cs.outlineWidth) };
  });
  expect(outline.id).toBe("interpret");
  expect(outline.style).not.toBe("none");
  expect(outline.width).toBeGreaterThanOrEqual(2);
});

test.describe("by touch", () => {
  test.use({ hasTouch: true });
  test("a tap selects a stage and a second tap clears it", async ({ page }) => {
    await open(page);
    await legendStage(page, "assess").tap();
    await expect(legendStage(page, "assess")).toHaveAttribute("aria-pressed", "true");
    await expect(node(page, "final_test")).not.toHaveClass(/dim/);
    await expect(node(page, "split")).toHaveClass(/dim/);
    await legendStage(page, "assess").tap();
    await expect(dimmed(page)).toHaveCount(0);
  });
});

test("selecting a stage mid-run does not interrupt the run, and the active node is never dimmed", async ({ page }) => {
  await open(page, 250);
  await page.getByTestId("play").click();
  await expect(page.locator(".node.active")).toHaveCount(1);
  await page.evaluate(() => {                                                // watch for any moment an active node is dimmed
    const root = document.querySelector("graph-replay")!.shadowRoot!;
    const w = window as unknown as { __activeDimmed: boolean; __sawDim: boolean };
    w.__activeDimmed = false; w.__sawDim = false;
    new MutationObserver(() => {
      if (root.querySelector(".node.active.dim")) w.__activeDimmed = true;
      if (root.querySelector(".node.dim")) w.__sawDim = true;
    }).observe(root, { subtree: true, attributes: true, attributeFilter: ["class"] });
  });
  const before = await timelineItems(page).count();
  await legendStage(page, "assess").click();                                 // a stage the run has not reached yet
  await expect(page.getByTestId("explanation")).toBeVisible({ timeout: 60_000 });
  expect(await timelineItems(page).count()).toBeGreaterThan(before);         // the run carried on, to the end
  await expect(page.getByTestId("pause")).toBeDisabled();
  const seen = await page.evaluate(() => {
    const w = window as unknown as { __activeDimmed: boolean; __sawDim: boolean };
    return { activeDimmed: w.__activeDimmed, sawDim: w.__sawDim };
  });
  expect(seen.sawDim).toBe(true);
  expect(seen.activeDimmed).toBe(false);
  await expect(page.locator(".node.active.dim")).toHaveCount(0);
});

test("the selection survives Pause, Step, Back, Reset and a new run", async ({ page }) => {
  await open(page, 100);
  await legendStage(page, "choose").click();
  await playToEnd(page);
  await expect(legendStage(page, "choose")).toHaveAttribute("aria-pressed", "true");
  await page.keyboard.press("ArrowLeft");
  await page.keyboard.press("ArrowRight");
  await expect(legendStage(page, "choose")).toHaveAttribute("aria-pressed", "true");
  await expect(node(page, "fit_model")).toHaveClass(/dim/);
  await page.getByTestId("reset").click();
  await expect(legendStage(page, "choose")).toHaveAttribute("aria-pressed", "true");
  await expect(node(page, "fit_model")).toHaveClass(/dim/);
  await page.getByTestId("play").click();
  await expect(page.locator(".node.active")).toHaveCount(1);
  await expect(legendStage(page, "choose")).toHaveAttribute("aria-pressed", "true");
  await expect(node(page, "fit_model")).toHaveClass(/dim/);
});

test.describe("on a phone", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });
  test("the legend is a row of numbered chips with the selected stage's name and question shown", async ({ page }) => {
    await open(page);
    const s = await structure(page);
    await expect(page.getByTestId("legend-stage")).toHaveCount(8);
    await expect(legendStage(page, "fit").locator(".name")).toBeHidden();       // chips show the number only
    await expect(legendStage(page, "fit").locator(".badge")).toBeVisible();
    await legendStage(page, "fit").tap();
    const fit = s.stages.find((x) => x.id === "fit")!;
    await expect(page.getByTestId("legend-detail")).toContainText(fit.name);
    await expect(page.getByTestId("legend-detail")).toContainText(fit.question);
    await expect(node(page, "fit_model")).not.toHaveClass(/dim/);
    // the legend sits above the graph, and the page does not scroll sideways
    const legendTop = (await box(page.getByTestId("legend"))).y;
    const graphTop = (await box(page.getByTestId("graph"))).y;
    expect(legendTop).toBeLessThan(graphTop);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
});

// ---------------- US3: the stage wherever a step appears ----------------

test("the graph, the Event panel and the timeline show the same stage for every step of a run", async ({ page }) => {
  await open(page, 60);
  await playToEnd(page);
  const s = await structure(page);
  const items = timelineItems(page);
  const total = await items.count();
  expect(total).toBeGreaterThan(20);
  for (let i = 0; i < total; i++) {
    await items.nth(i).click();
    const name = ((await items.nth(i).textContent()) ?? "").replace(/^\d+\.\s*/, "").trim();
    const stage = s.stages.find((x) => x.id === s.nodes.find((n) => n.id === name)!.stage)!;
    // the graph: the active node's badge
    await expect(page.locator(".node.active").getByTestId("stage-badge").locator("text")).toHaveText(String(stage.number));
    // the panel: badge, name, question
    const line = page.getByTestId("event-stage");
    await expect(line.locator(".badge")).toHaveText(String(stage.number));
    await expect(line).toContainText(stage.name);
    await expect(line).toContainText(stage.question);
    // the timeline: the entry's own cue
    await expect(items.nth(i)).toHaveAttribute("data-stage-number", String(stage.number));
    await expect(items.nth(i)).toHaveAttribute("data-stage", stage.id);
  }
});

test("every timeline entry carries a stage cue that shows, and the existing timeline behaviour is unchanged", async ({ page }) => {
  await open(page, 60);
  await playToEnd(page);
  const items = timelineItems(page);
  const cues = await items.evaluateAll((els) => els.map((e) => ({
    number: e.getAttribute("data-stage-number"),
    shown: getComputedStyle(e, "::before").content.replace(/"/g, ""),
    label: e.getAttribute("aria-label") ?? "",
    text: (e.textContent ?? "").trim(),
  })));
  for (const c of cues) {
    expect(c.number).toMatch(/^[1-8]$/);
    expect(c.shown).toBe(c.number);                           // the badge is drawn, from the same number
    expect(c.label).toMatch(/stage \d/);                      // and spoken
    expect(c.text).toMatch(/^\d+\. [a-z_]+$/);                // the visible text is exactly what it was before
  }
  await expect(items.nth(3)).toHaveText("4. baseline");
});

test("the timeline shows the run moving between Fit the model and Choose the setup", async ({ page }) => {
  await open(page, 60);
  await playToEnd(page);
  const numbers = (await timelineItems(page).evaluateAll((els) => els.map((e) => e.getAttribute("data-stage-number")))).join("");
  expect(numbers.startsWith("1234")).toBe(true);              // load_data, split, explore, baseline: in order
  expect((numbers.match(/565/g) ?? []).length).toBeGreaterThanOrEqual(3);   // choose, fit, choose, once per fitted round
  expect(numbers.endsWith("78")).toBe(true);
});

test("the Event panel shows the stage's note when the app supplied one", async ({ page }) => {
  await open(page, 60);
  await playToEnd(page);
  const items = timelineItems(page);
  const choose = items.filter({ hasText: "propose_features" }).first();
  await choose.click();
  await expect(page.getByTestId("event-stage")).toContainText("hyperparameters");
  await items.filter({ hasText: "fit_model" }).first().click();
  await expect(page.getByTestId("event-stage")).not.toContainText("hyperparameters");
});

// ---------------- US4: the done-beforehand item ----------------

const itemNode = (page: Page) => page.getByTestId("item");
const itemPanel = (page: Page) => page.getByTestId("item-panel");

test("the item is drawn differently, with a tag and a stage 1 badge, ahead of load_data", async ({ page }) => {
  await open(page);
  await expect(itemNode(page)).toBeVisible();
  await expect(itemNode(page)).toHaveClass(/item/);
  await expect(itemNode(page).locator(".item-tag")).toContainText("done beforehand");
  await expect(itemNode(page).getByTestId("stage-badge").locator("text")).toHaveText("1");
  await expect(page.locator('[data-edge="item:prepare_data->load_data"]')).toHaveClass(/item-edge/);
  const dash = await itemNode(page).locator("rect.body").evaluate((r) => getComputedStyle(r).strokeDasharray);
  expect(dash).not.toBe("none");
  const itemBox = await box(itemNode(page));
  const loadBox = await box(node(page, "load_data"));
  expect(itemBox.y).toBeLessThan(loadBox.y);                                     // ahead of load_data
  const startRow = await box(page.locator('[data-testid="stage-band"][data-row="start"] rect'));      // it is done before the run
  expect(itemBox.y).toBeGreaterThanOrEqual(startRow.y - 0.5);
  expect(itemBox.y + itemBox.height).toBeLessThanOrEqual(startRow.y + startRow.height + 0.5);
  expect(itemBox.x + itemBox.width).toBeLessThan((await box(node(page, "__start__"))).x);          // left of the start node
});

test("the item never becomes active or visited, is not in the timeline, and is not counted as a step", async ({ page }) => {
  await open(page, 60);
  await playToEnd(page);
  await expect(itemNode(page)).not.toHaveClass(/active|visited/);
  await expect(itemNode(page)).not.toHaveAttribute("data-visits", /.*/);
  const names = (await timelineItems(page).allTextContents()).map((t) => t.replace(/^\d+\.\s*/, ""));
  expect(names).not.toContain("prepare_data");
  expect(names.filter((n) => n.includes("item")).length).toBe(0);
  expect(await timelineItems(page).count()).toBe(23);                            // 23 steps: the rival is one grid-search step
  await expect(page.locator(".node.visited")).toHaveCount(13);                   // 11 steps, start and end: not the item
});

test("selecting the item by click shows what was excluded and the columns created, with a link to the Data tab", async ({ page }) => {
  await open(page);
  await expect(itemPanel(page)).toBeHidden();
  await itemNode(page).click();
  await expect(itemPanel(page)).toBeVisible();
  const api = (await (await page.request.get("/api/structure")).json()).items[0].summary;
  await expect(itemPanel(page)).toContainText("scripts/prepare_data.py");
  for (const row of api.rows) {
    await expect(itemPanel(page)).toContainText(row.label);
    await expect(itemPanel(page)).toContainText(row.value);
  }
  await expect(itemPanel(page)).toContainText("Competition columns");
  const link = page.getByTestId("item-link");
  await expect(link).toHaveAttribute("href", "#data");
  await link.click();
  await expect(page).toHaveURL(/#data$/);
  await expect(page.getByRole("tab", { name: /data/i }).first()).toHaveAttribute("aria-selected", "true");
});

test("the item opens and closes by keyboard, and Close closes it", async ({ page }) => {
  await open(page);
  await itemNode(page).focus();
  await page.keyboard.press("Enter");
  await expect(itemPanel(page)).toBeVisible();
  await page.keyboard.press("Enter");                                            // selecting it again closes it
  await expect(itemPanel(page)).toBeHidden();
  await itemNode(page).focus();
  await page.keyboard.press("Space");
  await expect(itemPanel(page)).toBeVisible();
  await page.getByTestId("item-close").click();
  await expect(itemPanel(page)).toBeHidden();
  await expect(itemNode(page)).toHaveAttribute("role", "button");
  await expect(itemNode(page)).toHaveAttribute("tabindex", "0");
});

test.describe("item by touch", () => {
  test.use({ hasTouch: true });
  test("a tap opens the item's summary", async ({ page }) => {
    await open(page);
    await itemNode(page).tap();
    await expect(itemPanel(page)).toBeVisible();
  });
});

test("opening the item mid-run does not interrupt the run or change the Event panel", async ({ page }) => {
  await open(page, 200);
  await page.getByTestId("play").click();
  await expect(page.locator(".node.active")).toHaveCount(1);
  const before = await timelineItems(page).count();
  await itemNode(page).click();
  await expect(itemPanel(page)).toBeVisible();
  await expect(page.getByTestId("explanation")).toBeVisible({ timeout: 60_000 });
  expect(await timelineItems(page).count()).toBeGreaterThan(before);
  await expect(itemPanel(page)).toBeVisible();                                   // the replay did not close it
  await expect(page.getByTestId("event-node")).toBeVisible();                    // and the Event panel still shows the step
});

// ---------------- US5: the inner and outer loop ----------------

const loopEdges = (page: Page) => page.locator(".edge.loop");
const pills = (page: Page) => page.locator('[data-testid="loop-round"]:not([hidden])');
/** The index of the nth visit (1-based) to a node in the timeline. */
async function visitIndex(page: Page, nodeName: string, nth: number) {
  const names = (await timelineItems(page).allTextContents()).map((t) => t.replace(/^\d+\.\s*/, ""));
  let seen = 0;
  for (const [i, n] of names.entries()) if (n === nodeName && ++seen === nth) return i;
  throw new Error(`no visit ${nth} of ${nodeName}`);
}

test("the loop note sits near the legend and names the real years", async ({ page }) => {
  await open(page);
  // the years the data really spans: the latest year in the Data tab's rows is the test year, the three before it are the checks
  const data = await (await page.request.get("/api/data")).json();
  const dateColumn = data.columns.findIndex((c: { key: string }) => c.key === "match_date");
  const latest = Math.max(...data.rows.map((r: string[]) => Number(String(r[dateColumn]).slice(0, 4))));
  const note = page.getByTestId("legend-note");
  await expect(note).toContainText("new setup (stage 5)");
  await expect(note).toContainText("fits the model again (stage 6)");
  await expect(note).toContainText(`check years (${latest - 3}, ${latest - 2} and ${latest - 1})`);
  await expect(note).toContainText(`test year (${latest})`);
  await expect(note).toContainText("used once");
});

test("the loop edges look like any others until the run returns to Fit the model, then show the round", async ({ page }) => {
  await open(page, 60);
  await playToEnd(page);
  const items = timelineItems(page);
  await items.nth(await visitIndex(page, "fit_model", 1)).click();
  await expect(loopEdges(page)).toHaveCount(0);                   // round 1: nothing special yet
  await expect(pills(page)).toHaveCount(0);

  await items.nth(await visitIndex(page, "fit_model", 2)).click();
  await expect(loopEdges(page)).toHaveCount(2);                   // check_proposal -> fit_model and fit_model -> evaluate
  await expect(page.locator('[data-edge="check_proposal->fit_model"]')).toHaveClass(/loop/);
  await expect(page.locator('[data-edge="fit_model->evaluate"]')).toHaveClass(/loop/);
  await expect(page.locator('[data-edge="evaluate->propose_features"]')).not.toHaveClass(/loop/);
  await expect(pills(page)).toHaveCount(2);
  await expect(pills(page).first()).toContainText("round 2");
  const heavier = await page.locator('[data-edge="fit_model->evaluate"] path').evaluate((p) => parseFloat(getComputedStyle(p).strokeWidth));
  const ordinary = await page.locator('[data-edge="explore->baseline"] path').evaluate((p) => parseFloat(getComputedStyle(p).strokeWidth));
  expect(heavier).toBeGreaterThan(ordinary);

  await items.nth(await visitIndex(page, "fit_model", 3)).click();
  await expect(pills(page).first()).toContainText("round 3");     // the count rises on each return
});

test("Back lowers the round, jumping recomputes it, and Reset clears it", async ({ page }) => {
  await open(page, 60);
  await playToEnd(page);
  const items = timelineItems(page);
  await items.nth(await visitIndex(page, "fit_model", 3)).click();
  await expect(pills(page).first()).toContainText("round 3");
  await page.keyboard.press("ArrowLeft");                          // propose/check/fit/evaluate: back from fit to check_proposal
  await expect(pills(page).first()).toContainText("round 2");
  await items.nth(await visitIndex(page, "fit_model", 1)).click();
  await expect(loopEdges(page)).toHaveCount(0);                    // a jump back to round 1 clears the emphasis
  await items.nth(await visitIndex(page, "fit_model", 2)).click();
  await expect(loopEdges(page)).toHaveCount(2);
  await page.getByTestId("reset").click();
  await expect(loopEdges(page)).toHaveCount(0);
  await expect(pills(page)).toHaveCount(0);
});

test("the loop emphasis does not rely on animation", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await open(page, 60);
  await playToEnd(page);
  await timelineItems(page).nth(await visitIndex(page, "fit_model", 2)).click();
  await expect(loopEdges(page)).toHaveCount(2);
  await expect(pills(page).first()).toContainText("round 2");
  const motion = await page.locator('[data-edge="fit_model->evaluate"]').evaluate((e) => {
    const cs = getComputedStyle(e.querySelector("path") as SVGPathElement);
    return { animation: cs.animationName, transition: cs.transitionDuration };
  });
  expect(motion.animation).toBe("none");
  expect(["0s", ""]).toContain(motion.transition);
});

// ---------------- the graph's size ----------------

/** What the right-hand column measured when the page loaded: the legend and the side panels at their natural heights. */
async function rightColumnStart(page: Page) {
  return page.evaluate(() => {
    const root = document.querySelector("graph-replay")!.shadowRoot!;
    const legend = root.querySelector(".legend") as HTMLElement;
    const panels = (Array.from(root.querySelector(".side")!.children) as HTMLElement[]).filter((el) => !el.hidden);
    const sideHeight = panels.reduce((sum, el) => sum + el.offsetHeight, 0) + 10 * Math.max(0, panels.length - 1);
    return legend.offsetHeight + 12 + sideHeight;
  });
}
const graphHeight = (page: Page) => page.evaluate(() => (document.querySelector("graph-replay")!.shadowRoot!.querySelector(".graph") as HTMLElement).offsetHeight);
/** How much the drawing is scaled: 1 is its natural size, where the text is the size it was designed at. */
const graphScale = (page: Page) => page.evaluate(() => {
  const svg = document.querySelector("graph-replay")!.shadowRoot!.querySelector("svg")!;
  const vb = svg.getAttribute("viewBox")!.split(" ").map(Number);
  return svg.getBoundingClientRect().width / vb[2];
});

test("on a wide screen the graph is at least as tall as the right-hand column was at the start, and stays so", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await open(page, 40);
  const start = await rightColumnStart(page);
  expect(start).toBeGreaterThan(300);
  expect(await graphHeight(page)).toBeGreaterThanOrEqual(start);
  await playToEnd(page);                                                   // the panels fill with content and grow
  expect(await rightColumnStart(page)).toBeGreaterThan(start);
  expect(await graphHeight(page)).toBeGreaterThanOrEqual(start);
});

test("the graph is drawn large enough to read, and never larger than its natural size", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await open(page);
  const scale = await graphScale(page);
  expect(scale).toBeGreaterThanOrEqual(0.55);                              // the rows are about 930 px wide in a column of about 560 px
  expect(scale).toBeLessThanOrEqual(1.001);
});

test("on a phone the graph is also drawn at a readable size", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await open(page);
  expect(await graphScale(page)).toBeGreaterThanOrEqual(0.8);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test("a small graph from another app still fills the card's minimum height", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await serveStructure(page, JSON.parse((await import("node:fs")).readFileSync("tests/fixtures/other-structure.json", "utf8")));
  await page.goto("/");
  await expect(page.locator('[data-node="fetch"]')).toBeVisible();
  expect(await graphHeight(page)).toBeGreaterThanOrEqual(await rightColumnStart(page));
});

test("each row's label fits inside its row", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await open(page);
  for (const band of await page.getByTestId("stage-band").all()) {
    const rect = await box(band.locator("rect").first());
    const label = await box(band.locator(".band-name"));
    const stage = await band.getAttribute("data-stage");
    expect(label.x, `${stage} label starts inside`).toBeGreaterThanOrEqual(rect.x - 0.5);
    expect(label.x + label.width, `${stage} label ends inside`).toBeLessThanOrEqual(rect.x + rect.width + 0.5);
  }
});

test("the round pills sit beside their edges, clear of every node", async ({ page }) => {
  await open(page, 60);
  await playToEnd(page);
  const items = timelineItems(page);
  const names = (await items.allTextContents()).map((t) => t.replace(/^\d+\.\s*/, ""));
  await items.nth(names.indexOf("fit_model", names.indexOf("fit_model") + 1)).click();
  const shown = page.locator('[data-testid="loop-round"]:not([hidden])');
  await expect(shown).toHaveCount(2);
  for (const pill of await shown.all()) {
    const p = await box(pill);
    for (const id of Object.keys(NUMBER_OF)) {
      expect(overlap(p, await box(node(page, id).locator("rect:not(.stage-halo)").first())), `pill over ${id}`).toBe(false);
    }
  }
});

test("a badge keeps its stage colour and a readable number on visited and active nodes", async ({ page }) => {
  await open(page, 40);
  await playToEnd(page);
  await timelineItems(page).nth(10).click();                                   // fit_model is active; most others are visited
  const legendFill = async (stage: string) => legendStage(page, stage).locator(".badge").evaluate((b) => getComputedStyle(b).backgroundColor);
  const states = await page.locator("[data-node][data-stage]").evaluateAll((els) => els.map((el) => {
    const circle = el.querySelector(".stage-badge circle") as SVGCircleElement;
    const text = el.querySelector(".stage-badge text") as SVGTextElement;
    return { id: el.getAttribute("data-node"), stage: el.getAttribute("data-stage"), cls: el.getAttribute("class") ?? "",
             fill: getComputedStyle(circle).fill, number: getComputedStyle(text).fill, dash: getComputedStyle(circle).strokeDasharray };
  }));
  expect(states.some((x) => x.cls.includes("active"))).toBe(true);
  expect(states.some((x) => x.cls.includes("visited"))).toBe(true);
  for (const st of states) {
    expect(st.fill, `${st.id} badge fill`).toBe(await legendFill(st.stage!));
    expect(st.number, `${st.id} number colour`).not.toBe(st.fill);
    expect(st.dash, `${st.id} badge outline`).toBe("none");
  }
});

test("the visit count sits beside the tick from the first visit, and there is no count circle", async ({ page }) => {
  await open(page, 40);
  await playToEnd(page);
  const ticks = await page.locator("[data-node]").evaluateAll((els) => els.map((el) => {
    const t = el.querySelector(".tick") as SVGTextElement | null;
    return { id: el.getAttribute("data-node"), visits: el.getAttribute("data-visits"), text: t?.textContent ?? null,
             hidden: t?.hasAttribute("hidden") ?? true, fill: t ? getComputedStyle(t).fill : "", circles: el.querySelectorAll(".count-bg, .count").length };
  }));
  const visited = ticks.filter((t) => t.text !== null && !t.hidden);
  expect(visited.length).toBeGreaterThanOrEqual(11);
  for (const t of visited) {
    expect(t.text, `${t.id} tick`).toBe(`\u2713${t.visits ?? 1}`);   // data-visits is only set from the second visit
    expect(t.circles).toBe(0);
  }
  expect(visited.find((t) => t.id === "load_data")?.text).toBe("\u27131");              // shown from the first visit
  expect(visited.filter((t) => Number(t.visits) >= 2).length).toBeGreaterThanOrEqual(3);   // fit_model, propose_features, ...
  const colours = new Set(visited.map((t) => t.fill));
  expect(colours.size).toBe(1);
  expect([...colours][0]).not.toBe("rgb(29, 111, 224)");                                  // not the accent: it is not the old blue count
});

for (const scheme of ["light", "dark"] as const) {
  test(`rows, their labels and the visit tick are legible in the ${scheme} theme`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: scheme });
    await open(page, 40);
    await playToEnd(page);
    const read = await page.evaluate(() => {
      const root = document.querySelector("graph-replay")!.shadowRoot!;
      const fill = (el: Element) => getComputedStyle(el).fill;
      const names = Array.from(root.querySelectorAll(".stage-row .band-name"));
      const surface = getComputedStyle(root.querySelector(".graph") as HTMLElement).backgroundColor;
      return {
        surface, names: names.map((n) => fill(n)), tick: fill(root.querySelector(".node .tick") as Element),
        tints: Array.from(root.querySelectorAll(".stage-row rect")).map((r) => getComputedStyle(r).fillOpacity),
      };
    });
    for (const f of read.names) expect(f).not.toBe(read.surface);                // text is not the card's own colour
    expect(new Set(read.names).size).toBeLessThanOrEqual(2);                      // text colour and the muted one for Start and Finish
    expect(read.tick).not.toBe(read.surface);
    for (const t of read.tints) expect(Number(t)).toBeLessThanOrEqual(0.1);       // a light tint, so the text stays legible on it
  });
}

test("the drawing fills the height of the column beside it, and keeps filling it as the panels grow", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await open(page, 40);
  const gap = () => page.evaluate(() => {
    const r = document.querySelector("graph-replay")!.shadowRoot!;
    const g = r.querySelector(".graph") as HTMLElement;
    const s = r.querySelector("svg")!.getBoundingClientRect();
    return g.getBoundingClientRect().height - 14 - s.height;       // card minus its padding and border, less the drawing
  });
  await expect.poll(gap).toBeLessThan(6);
  expect(await gap()).toBeGreaterThan(-6);
  await playToEnd(page);                                           // the panels fill and the column grows
  await expect.poll(gap).toBeLessThan(6);
  expect(await gap()).toBeGreaterThan(-6);
  expect(await graphScale(page)).toBeLessThanOrEqual(1.001);       // taller, not larger: the text is the same size
});
