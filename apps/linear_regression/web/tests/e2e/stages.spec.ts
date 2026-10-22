import { expect, test, type Page } from "./fixtures";
import { open, openIdle, openPath, playToEnd, serveStructure, timelineItems, toPlayer } from "./helpers";

// Stage badges, the legend, the Event panel and timeline cues, the done-beforehand item and the round pill, against the real app
// running the scripted fake model. Stage names come from /api/structure, never from this file. The rows
// themselves are in graph-rows.spec.ts.

// The numbers follow the order a run first reaches each stage.
const NUMBER_OF: Record<string, number> = {
  load_data: 1, split: 2, explore: 3, baseline: 4, propose_features: 5, check_proposal: 5, evaluate: 5,
  grid_search: 5, fit_model: 6, final_test: 7, explain_in_cricket_terms: 8, write_in_cricket_terms: 8,
};

const node = (page: Page, id: string) => page.locator(`[data-node="${id}"]`);
const badge = (page: Page, id: string) => node(page, id).getByTestId("stage-badge");

async function structure(page: Page) {
  return (await (await page.request.get("/api/structure")).json()) as {
    stages: { id: string; number: number; name: string; question: string }[];
    nodes: { id: string; kind: string; stage?: string }[];
  };
}

// ---------------- badges ----------------

test("every step shows its stage number on a badge, and the eight numbers differ", async ({ page }) => {
  await open(page);
  for (const [id, n] of Object.entries(NUMBER_OF)) await expect(badge(page, id)).toHaveText(String(n));
  await expect(page.getByTestId("stage-badge")).toHaveCount(Object.keys(NUMBER_OF).length + 1);   // and the done-beforehand item's
  const numbers = new Set((await page.getByTestId("stage-badge").allTextContents()).map((t) => t.trim()));
  expect([...numbers].sort()).toEqual(["1", "2", "3", "4", "5", "6", "7", "8"]);
});

test("the badge numbers agree with the stage the server sent for each node", async ({ page }) => {
  await open(page);
  const s = await structure(page);
  for (const n of s.nodes.filter((x) => x.kind === "node")) {
    const stage = s.stages.find((x) => x.id === n.stage)!;
    await expect(badge(page, n.id)).toHaveText(String(stage.number));
    await expect(node(page, n.id)).toHaveAttribute("data-stage", stage.id);
  }
});

test("the run states and the language-model marking show on nodes that carry a badge", async ({ page }) => {
  await open(page);
  await expect(node(page, "propose_features")).toHaveAttribute("data-actor", "llm");
  await expect(node(page, "propose_features").locator(".actor-tag")).toHaveText("AI");
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
    await expect(page.getByTestId("stage-badge")).toHaveCount(13);                  // 12 steps and the item
    const fills = await page.getByTestId("stage-badge").evaluateAll((els) => els.map((e) => getComputedStyle(e).backgroundColor));
    expect(new Set(fills).size).toBe(8);                       // eight stages, eight colours
    const stage1 = await badge(page, "load_data").evaluate((b) => getComputedStyle(b).backgroundColor);
    expect(stage1).toBe(scheme === "light" ? "rgb(138, 90, 0)" : "rgb(184, 134, 63)");
  });
}

test("a badge keeps its stage colour and a readable number on visited and active nodes", async ({ page }) => {
  await open(page, 40);
  await playToEnd(page);
  await timelineItems(page).nth(10).click();                                   // fit_model is active; most others are visited
  const legendFill = async (stage: string) => legendStage(page, stage).locator(".badge").evaluate((b) => getComputedStyle(b).backgroundColor);
  const states = await page.locator("[data-node][data-stage]").evaluateAll((els) => els.map((el) => {
    const b = el.querySelector(".stage-badge") as HTMLElement;
    return { id: el.getAttribute("data-node"), stage: el.getAttribute("data-stage"), cls: el.getAttribute("class") ?? "",
             fill: getComputedStyle(b).backgroundColor, number: getComputedStyle(b).color };
  }));
  expect(states.some((x) => x.cls.includes("active"))).toBe(true);
  expect(states.some((x) => x.cls.includes("visited"))).toBe(true);
  for (const st of states) {
    expect(st.fill, `${st.id} badge fill`).toBe(await legendFill(st.stage!));
    expect(st.number, `${st.id} number colour`).not.toBe(st.fill);
  }
});

test("the visit count sits beside the tick from the first visit", async ({ page }) => {
  await open(page, 40);
  await playToEnd(page);
  const ticks = await page.locator("[data-node]").evaluateAll((els) => els.map((el) => {
    const t = el.querySelector(".tick") as HTMLElement | null;
    return { id: el.getAttribute("data-node"), visits: el.getAttribute("data-visits"), text: t?.textContent ?? null,
             hidden: t?.hasAttribute("hidden") ?? true, color: t ? getComputedStyle(t).color : "" };
  }));
  const visited = ticks.filter((t) => t.text !== null && !t.hidden);
  expect(visited.length).toBeGreaterThanOrEqual(11);
  for (const t of visited) expect(t.text, `${t.id} tick`).toBe(`✓${t.visits ?? 1}`);   // data-visits is only set from the second visit
  expect(visited.find((t) => t.id === "load_data")?.text).toBe("✓1");              // shown from the first visit
  expect(visited.filter((t) => Number(t.visits) >= 2).length).toBeGreaterThanOrEqual(3);   // fit_model, propose_features, ...
  expect(new Set(visited.map((t) => t.color)).size).toBe(1);
});

// ---------------- the legend ----------------

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

test("every stage card shows its question and its technical note, and stage 5 is named for the candidate model", async ({ page }) => {
  await open(page);
  const body = (await (await page.request.get("/api/structure")).json()) as {
    stages: { id: string; name: string; question: string }[]; notes: { stages: Record<string, string> };
  };
  expect(body.stages[4].name).toBe("Choose the candidate model");
  expect(body.stages[4].id).toBe("choose");
  for (const st of body.stages) {
    const card = legendStage(page, st.id);
    await expect(card).toContainText(st.question);
    await expect(card.locator(".stage-note")).toHaveText(body.notes.stages[st.id]);
  }
  await expect(page.getByText("Choose the setup")).toHaveCount(0);
});

test("the notes start closed; each opens and closes on its own, and Open all and Close all work together", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await open(page);
  const notes = page.locator(".legend-stage .stage-note");
  const toggles = page.getByTestId("note-toggle");
  const count = await notes.count();
  expect(count).toBe(8);
  for (let i = 0; i < count; i++) await expect(notes.nth(i)).toBeHidden();
  await expect(toggles.first()).toHaveAttribute("aria-expanded", "false");
  await toggles.nth(1).click();                                                       // one at a time
  await expect(notes.nth(1)).toBeVisible();
  await expect(notes.nth(0)).toBeHidden();
  await expect(toggles.nth(1)).toHaveAttribute("aria-expanded", "true");
  await expect(legendStage(page, "split")).toHaveAttribute("aria-pressed", "false");   // opening a note does not select the stage
  await toggles.nth(1).click();
  await expect(notes.nth(1)).toBeHidden();
  const all = page.getByTestId("notes-toggle-all");
  await expect(all).toHaveText("Open all details");
  await all.click();
  for (let i = 0; i < count; i++) await expect(notes.nth(i)).toBeVisible();
  await expect(all).toHaveText("Close all details");
  await toggles.nth(2).click();                                                        // one closed, so the button offers Open again
  await expect(all).toHaveText("Open all details");
  await all.click();
  await all.click();
  for (let i = 0; i < count; i++) await expect(notes.nth(i)).toBeHidden();
});

test("selecting a stage does not open its note, and the note buttons are reachable by keyboard", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await open(page);
  await legendStage(page, "choose").click();
  await expect(legendStage(page, "choose").locator(".stage-note")).toBeHidden();
  const toggle = page.locator('[data-testid="note-toggle"][data-stage="choose"]');
  await toggle.focus();
  await page.keyboard.press("Enter");
  await expect(legendStage(page, "choose").locator(".stage-note")).toBeVisible();
  await expect(legendStage(page, "choose")).toHaveAttribute("aria-pressed", "true");     // still selected
});

test("the technical notes say where selection happens and what is held out", async ({ page }) => {
  await open(page);
  await expect(legendStage(page, "split").locator(".stage-note")).toContainText("test season, read once");
  await expect(legendStage(page, "choose").locator(".stage-note")).toContainText("cross-validated MAE wins, before the test season is read");
  await expect(legendStage(page, "fit").locator(".stage-note")).toContainText("A separate fit is made for each of the check seasons");
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
  await page.goto("/?view=everything");
  const empty = legendStage(page, "s2");
  await expect(empty).toContainText("Not a step in this agent");
  await expect(empty).toContainText("This agent has no second stage.");
  await expect(legendStage(page, "s1")).not.toContainText("Not a step in this agent");
});

test("selecting a stage highlights its nodes and dims the rest; again, or All, clears it", async ({ page }) => {
  await open(page);
  await expect(dimmed(page)).toHaveCount(0);
  await legendStage(page, "fit").click();
  await expect(legendStage(page, "fit")).toHaveAttribute("aria-pressed", "true");
  await expect(node(page, "fit_model")).not.toHaveClass(/dim/);
  await expect(node(page, "fit_model")).toHaveClass(/stage-selected/);
  for (const id of ["load_data", "split", "propose_features", "evaluate", "final_test"]) {
    await expect(node(page, id)).toHaveClass(/dim/);
  }
  await legendStage(page, "fit").click();                                    // again clears
  await expect(dimmed(page)).toHaveCount(0);
  await legendStage(page, "choose").click();
  await expect(node(page, "evaluate")).not.toHaveClass(/dim/);
  await expect(node(page, "fit_model")).toHaveClass(/dim/);
  await page.getByTestId("legend-all").click();                              // All clears
  await expect(dimmed(page)).toHaveCount(0);
  await expect(page.locator("graph-replay [aria-pressed=\"true\"]")).toHaveCount(0);
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

test("selecting a stage while the run plays does not interrupt it, and the active node is never dimmed", async ({ page }) => {
  await openIdle(page, 250);
  await toPlayer(page);
  await page.getByTestId("model-select").selectOption({ label: "Thorough" });
  await page.getByTestId("play-button").click();
  await expect(page.locator(".node.active")).toHaveCount(1, { timeout: 30_000 });
  await page.evaluate(() => {                                                // watch for any moment an active node is dimmed
    const root = document.querySelector("graph-replay")!.shadowRoot!;
    const w = window as unknown as { __activeDimmed: boolean; __sawDim: boolean };
    w.__activeDimmed = false; w.__sawDim = false;
    new MutationObserver(() => {
      if (root.querySelector(".node.active.dim")) w.__activeDimmed = true;
      if (root.querySelector(".node.dim")) w.__sawDim = true;
    }).observe(root, { subtree: true, attributes: true, attributeFilter: ["class"] });
  });
  await legendStage(page, "assess").click();                                 // a stage the run has not reached yet
  await playToEnd(page);
  await openPath(page);
  expect(await timelineItems(page).count()).toBeGreaterThan(20);             // the run carried on, to the end
  const seen = await page.evaluate(() => {
    const w = window as unknown as { __activeDimmed: boolean; __sawDim: boolean };
    return { activeDimmed: w.__activeDimmed, sawDim: w.__sawDim };
  });
  expect(seen.sawDim).toBe(true);
  expect(seen.activeDimmed).toBe(false);
  await expect(page.locator(".node.active.dim")).toHaveCount(0);
});

test("the selection survives Back, Step, Reset and watching again", async ({ page }) => {
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
  await page.getByTestId("watch-again").click();
  await expect(page.locator(".node.active")).toHaveCount(1);
  await expect(legendStage(page, "choose")).toHaveAttribute("aria-pressed", "true");
  await expect(node(page, "fit_model")).toHaveClass(/dim/);
});

test.describe("on a phone", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });
  test("the legend is a row of numbered chips with the selected stage's name and question shown, below the rows", async ({ page }) => {
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
    // the rows come first, then the state card, then the legend; the page does not scroll sideways
    const rowsBox = (await page.getByTestId("graph").boundingBox())!;
    const legendTop = (await page.getByTestId("legend").boundingBox())!.y;
    expect(legendTop).toBeGreaterThan(rowsBox.y + rowsBox.height - 1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
});

// ---------------- the stage wherever a step appears ----------------

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
    if (i < total - 1) await expect(page.locator(".node.active").getByTestId("stage-badge")).toHaveText(String(stage.number));      // the graph (the last step rings nothing: the run is over)
    const line = page.getByTestId("event-stage");                                                               // the panel
    await expect(line.locator(".badge")).toHaveText(String(stage.number));
    await expect(line).toContainText(stage.name);
    await expect(line).toContainText(stage.question);
    await expect(items.nth(i)).toHaveAttribute("data-stage-number", String(stage.number));                       // the timeline
    await expect(items.nth(i)).toHaveAttribute("data-stage", stage.id);
  }
});

test("every timeline entry carries a stage cue that shows", async ({ page }) => {
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

test("the timeline shows the run moving between Fit the model and Choose the candidate model", async ({ page }) => {
  await open(page, 60);
  await playToEnd(page);
  const numbers = (await timelineItems(page).evaluateAll((els) => els.map((e) => e.getAttribute("data-stage-number")))).join("");
  expect(numbers.startsWith("1234")).toBe(true);              // load_data, split, explore, baseline: in order
  expect((numbers.match(/565/g) ?? []).length).toBeGreaterThanOrEqual(3);   // choose, fit, choose, once per fitted round
  expect(numbers.endsWith("788")).toBe(true);                    // final test, then the two steps of stage 8
});

test("the Event panel shows the stage's note when the app supplied one", async ({ page }) => {
  await open(page, 60);
  await playToEnd(page);
  const items = timelineItems(page);
  await items.filter({ hasText: "propose_features" }).first().click();
  await expect(page.getByTestId("event-stage")).toContainText("hyperparameters");
  await items.filter({ hasText: "fit_model" }).first().click();
  await expect(page.getByTestId("event-stage")).not.toContainText("hyperparameters");
});

// ---------------- the done-beforehand item ----------------

const itemNode = (page: Page) => page.getByTestId("item");
const itemPanel = (page: Page) => page.getByTestId("item-panel");

test("the item is drawn differently, with a tag and a stage 1 badge, ahead of load_data in the first row", async ({ page }) => {
  await open(page);
  await expect(itemNode(page)).toBeVisible();
  await expect(itemNode(page)).toHaveClass(/item-node/);
  await expect(itemNode(page).locator(".item-tag")).toContainText("done beforehand");
  await expect(itemNode(page).getByTestId("stage-badge")).toHaveText("1");
  const dash = await itemNode(page).evaluate((r) => getComputedStyle(r).borderTopStyle);
  expect(dash).toBe("dashed");
  const first = page.locator('graph-replay [data-row="start"]');
  await expect(first.getByTestId("item")).toHaveCount(1);
  const itemBox = (await itemNode(page).boundingBox())!, loadBox = (await node(page, "load_data").boundingBox())!;
  expect(itemBox.x + itemBox.width).toBeLessThanOrEqual(loadBox.x + 1);        // ahead of load_data, on the same line
});

test("the item never becomes active or visited, is not in the timeline, and is not counted as a step", async ({ page }) => {
  await open(page, 60);
  await playToEnd(page);
  await expect(itemNode(page)).not.toHaveClass(/active|visited/);
  await expect(itemNode(page)).not.toHaveAttribute("data-visits", /.*/);
  const names = (await timelineItems(page).allTextContents()).map((t) => t.replace(/^\d+\.\s*/, ""));
  expect(names).not.toContain("prepare_data");
  expect(await timelineItems(page).count()).toBe(24);                            // 24 steps: the rival is one grid-search step
  await expect(page.locator(".node.visited")).toHaveCount(12);                   // the 12 steps, not the item
});

test("selecting the item by click shows what was excluded and the columns created, with a link to the data", async ({ page }) => {
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
  await expect(page.getByTestId("item-link")).toHaveAttribute("href", "#data");       // the old link; the page sends it to the Scorebook
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
  expect(await itemNode(page).evaluate((el) => el.tagName)).toBe("BUTTON");        // a real button: reachable and operable by keyboard
});

test.describe("item by touch", () => {
  test.use({ hasTouch: true });
  test("a tap opens the item's summary", async ({ page }) => {
    await open(page);
    await itemNode(page).tap();
    await expect(itemPanel(page)).toBeVisible();
  });
});

test("opening the item while the run plays does not interrupt it or change the Event panel", async ({ page }) => {
  await openIdle(page, 200);
  await toPlayer(page);
  await page.getByTestId("model-select").selectOption({ label: "Thorough" });
  await page.getByTestId("play-button").click();
  await expect(page.locator(".node.active")).toHaveCount(1, { timeout: 30_000 });
  await itemNode(page).click();
  await expect(itemPanel(page)).toBeVisible();
  await playToEnd(page);
  await openPath(page);
  expect(await timelineItems(page).count()).toBeGreaterThan(20);
  await expect(itemPanel(page)).toBeVisible();                                   // the replay did not close it
  await expect(page.getByTestId("event-node")).toBeVisible();                    // and the Event panel still shows the step
});

// ---------------- the loop ----------------

const pills = (page: Page) => page.locator('[data-testid="loop-round"]:not([hidden])');
/** The index of the nth visit (1-based) to a node in the timeline. */
async function visitIndex(page: Page, nodeName: string, nth: number) {
  const names = (await timelineItems(page).allTextContents()).map((t) => t.replace(/^\d+\.\s*/, ""));
  let seen = 0;
  for (const [i, n] of names.entries()) if (n === nodeName && ++seen === nth) return i;
  throw new Error(`no visit ${nth} of ${nodeName}`);
}

test("the general note under All names the validation and test years from the data, in one sentence", async ({ page }) => {
  await open(page);
  // the years the data really spans: the latest year in the data rows is the test year, the three before it are the checks
  const data = await (await page.request.get("/api/data")).json();
  const dateColumn = data.columns.findIndex((c: { key: string }) => c.key === "match_date");
  const latest = Math.max(...data.rows.map((r: string[]) => Number(String(r[dateColumn]).slice(0, 4))));
  await expect(page.getByTestId("legend-note")).toHaveText(
    `Check seasons: ${latest - 3}, ${latest - 2} and ${latest - 1}; test season: ${latest}, used once.`);
});

test("with no general note in the structure the legend shows none", async ({ page }) => {
  const real = await (await page.request.get("/api/structure")).json();
  const { general: _gone, ...notes } = real.notes;
  await serveStructure(page, { ...real, notes });
  await page.goto("/?view=everything");
  await expect(page.locator('[data-node="load_data"]')).toBeVisible();
  await expect(page.getByTestId("legend-note")).toHaveCount(0);
});

test("the round shows only once the run returns to Fit the model, and counts up on each return", async ({ page }) => {
  await open(page, 60);
  await playToEnd(page);
  const items = timelineItems(page);
  await items.nth(await visitIndex(page, "fit_model", 1)).click();
  await expect(pills(page)).toHaveCount(0);                       // round 1: nothing special yet
  await items.nth(await visitIndex(page, "fit_model", 2)).click();
  await expect(pills(page)).toHaveCount(1);
  await expect(pills(page).first()).toContainText("round 2");
  await expect(page.locator('graph-replay [data-row="round"]').getByTestId("loop-round")).toBeVisible();   // in the row that holds Fit the model
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
  await expect(pills(page)).toHaveCount(0);                        // a jump back to round 1 clears it
  await items.nth(await visitIndex(page, "fit_model", 2)).click();
  await expect(pills(page)).toHaveCount(1);
  await page.getByTestId("reset").click();
  await expect(pills(page)).toHaveCount(0);
});

test("the round pill does not rely on animation", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await open(page, 60);
  await playToEnd(page);
  await timelineItems(page).nth(await visitIndex(page, "fit_model", 2)).click();
  await expect(pills(page).first()).toContainText("round 2");
  const motion = await pills(page).first().evaluate((e) => {
    const cs = getComputedStyle(e);
    return { animation: cs.animationName, transition: cs.transitionDuration };
  });
  expect(motion.animation).toBe("none");
  expect(["0s", ""]).toContain(motion.transition);
});
