// SC-007: the same <graph-replay>, given an unrelated graph and event stream, renders it
// with no changes to the component.
import { readFileSync } from "node:fs";
import { expect, test } from "./fixtures";
import { afterRunOpen, serveRun, serveStructure, sse, timelineItems } from "./helpers";

const structure = JSON.parse(readFileSync("tests/fixtures/other-structure.json", "utf8"));
const step = (n: number, node: string, summary: string, changes: object) => sse("step", { step: n, node, summary, changes });
const body =
  step(1, "fetch", "Downloaded 3 pages", { pages: 3 }) +
  step(2, "parse", "Read 41 records", { records: 41 }) +
  step(3, "validate", "2 records were invalid", { invalid: 2 }) +
  step(4, "retry", "Retrying the invalid ones", { attempt: 1 }) +
  step(5, "fetch", "Downloaded 1 page", { pages: 1 }) +
  step(6, "parse", "Read 2 records", { records: 2 }) +
  step(7, "validate", "All records valid", { invalid: 0 }) +
  step(8, "store", "Saved 43 records", { saved: 43 }) +
  sse("done", { steps: 8 });

test("an unrelated graph and stream display correctly", async ({ page }) => {
  await serveStructure(page, structure);
  await serveRun(page, body);
  await page.goto("/?interval=80");
  for (const id of ["fetch", "parse", "validate", "retry", "store"]) {
    await expect(page.locator(`[data-node="${id}"]`)).toBeVisible();
  }
  const labels = (await page.locator(".edge.conditional text").allTextContents()).sort();
  expect(labels).toEqual(["invalid", "valid"]);

  await page.getByTestId("play").click();
  await expect(timelineItems(page)).toHaveCount(8, { timeout: 20_000 });
  await expect(page.getByTestId("pause")).toBeDisabled();
  await expect(page.locator('[data-node="fetch"]')).toHaveAttribute("data-visits", "2");
  await expect(page.locator('[data-edge="validate->retry"]')).toHaveClass(/taken/);
  await expect(page.locator('[data-edge="validate->store"]')).toHaveClass(/taken/);
  await expect(page.getByTestId("event-summary")).toHaveText("Saved 43 records");
  await expect(page.locator('[data-key="saved"]')).toHaveAttribute("data-changed", "true");
  await expect(page.locator('[data-key="pages"]')).toHaveAttribute("data-changed", "false");
});

// ---------------- feature 005 (US6): the same visualiser, another app's stages ----------------
// The fixture has its own stage set (different names, six stages), a loop, notes with markup-like text, a stage with no
// node, and two items. Nothing in the visualiser changes for it.

const stageBody =
  step(1, "fetch", "Downloaded 3 pages", { pages: 3 }) +
  step(2, "parse", "Read 41 records", { records: 41 }) +
  step(3, "validate", "2 records were invalid", { invalid: 2 }) +
  step(4, "retry", "Retrying the invalid ones", { attempt: 1 }) +
  step(5, "fetch", "Downloaded 1 page", { pages: 1 }) +
  step(6, "parse", "Read 2 records", { records: 2 }) +
  step(7, "validate", "All records valid", { invalid: 0 }) +
  step(8, "store", "Saved 43 records", { saved: 43 }) +
  sse("done", { steps: 8 });

async function openOther(page: import("@playwright/test").Page, changed: (s: typeof structure) => typeof structure = (s) => s) {
  await serveStructure(page, changed(structure));
  await serveRun(page, stageBody);
  await page.goto("/?interval=80");
  await expect(page.locator('[data-node="fetch"]')).toBeVisible();
}

test("another app's stages: legend, badges, bands and highlight come from its own structure", async ({ page }) => {
  await openOther(page);
  const entries = page.getByTestId("legend-stage");
  await expect(entries).toHaveCount(6);
  await expect(entries.nth(0).locator(".name")).toHaveText("Bring it in");
  await expect(entries.nth(2).locator(".question")).toHaveText("Is every record valid?");
  const numbers = await page.getByTestId("stage-badge").locator("text").allTextContents();
  expect(numbers.sort()).toEqual(["1", "1", "1", "2", "3", "4", "5"]);     // five steps and the two items, all in stage 1 or later
  await expect(page.locator('[data-node="validate"] [data-testid="stage-badge"] text')).toHaveText("3");
  expect(await page.getByTestId("stage-band").count()).toBeGreaterThanOrEqual(5);
  await page.locator('[data-testid="legend-stage"][data-stage="check"]').click();
  await expect(page.locator('[data-node="validate"]')).not.toHaveClass(/dim/);
  await expect(page.locator('[data-node="fetch"]')).toHaveClass(/dim/);
  await page.getByTestId("legend-all").click();
  await expect(page.locator("[data-node].dim")).toHaveCount(0);
});

test("another app's stage with no node says so, with the reason that app gave", async ({ page }) => {
  await openOther(page);
  const empty = page.locator('[data-testid="legend-stage"][data-stage="archive"]');
  await expect(empty).toContainText("Not a step in this agent");
  await expect(empty).toContainText("Nothing is archived in this pipeline.");
});

test("another app's loop is emphasised from its second round, with its count", async ({ page }) => {
  await openOther(page);
  await page.getByTestId("play").click();
  await expect(timelineItems(page)).toHaveCount(8, { timeout: 20_000 });
  await expect(page.getByTestId("pause")).toBeDisabled();
  await afterRunOpen(page, "working");
  await timelineItems(page).nth(0).click();
  await expect(page.locator(".edge.loop")).toHaveCount(0);
  await timelineItems(page).nth(4).click();                                // the second visit to fetch, the loop's fit stage
  await expect(page.locator('[data-edge="fetch->parse"]')).toHaveClass(/loop/);
  await expect(page.locator('[data-testid="loop-round"]:not([hidden])').first()).toContainText("round 2");
});

test("another app's notes and items are shown as plain text, and only a same-page link is a link", async ({ page }) => {
  await openOther(page);
  const note = page.getByTestId("legend-note");
  await expect(note).toContainText("<b>markup</b>");                       // the markup is text, not markup
  await expect(note.locator("b, script")).toHaveCount(0);
  await expect(page.locator('[data-testid="legend-stage"][data-stage="check"] .stage-note')).toHaveText("<i>Check</i> carefully.");

  await page.locator('[data-item="seed"]').click();
  const panel = page.getByTestId("item-panel");
  await expect(panel).toContainText("<b>Loaded</b> before the run.");
  await expect(panel).toContainText("<script>x</script>");
  await expect(panel.locator("b, script")).toHaveCount(0);
  await expect(page.getByTestId("item-link")).toHaveAttribute("href", "#docs");

  await page.locator('[data-item="ext"]').click();                         // switching items: the other one's summary
  await expect(panel).toContainText("Kept elsewhere.");
  await expect(page.getByTestId("item-link")).toHaveCount(0);              // an off-page link is not a link
  await expect(page.getByTestId("item-link-text")).toContainText("http://example.com/");
});

test("a node with no stage is drawn neutral and flagged in the legend as unassigned", async ({ page }) => {
  await openOther(page, (s) => ({ ...s, nodes: s.nodes.map((n: { id: string }) => (n.id === "retry" ? { id: "retry", kind: "node" } : n)) }));
  const badge = page.locator('[data-node="retry"] [data-testid="stage-badge"]');
  await expect(badge).toHaveClass(/unassigned/);
  await expect(badge.locator("text")).toHaveText("–");
  await expect(page.locator('[data-node="retry"]')).toHaveClass(/stage-unassigned/);
  const flag = page.getByTestId("legend-unassigned");
  await expect(flag).toBeVisible();
  await expect(flag).toContainText("retry");
  await expect(flag).toContainText("No stage assigned");
  for (const id of ["fetch", "parse", "validate", "store"]) {                // the others keep their stage
    await expect(page.locator(`[data-node="${id}"] [data-testid="stage-badge"]`)).not.toHaveClass(/unassigned/);
  }
});

test("a node naming a stage that is not in the set is unassigned too, and no flag appears when all are assigned", async ({ page }) => {
  await openOther(page, (s) => ({ ...s, nodes: s.nodes.map((n: { id: string }) => (n.id === "store" ? { id: "store", kind: "node", stage: "nonsense" } : n)) }));
  await expect(page.locator('[data-node="store"] [data-testid="stage-badge"]')).toHaveClass(/unassigned/);
  await expect(page.getByTestId("legend-unassigned")).toContainText("store");
  await openOther(page);
  await expect(page.getByTestId("legend-unassigned")).toHaveCount(0);
});
