// SC-007: the same <graph-replay>, given an unrelated graph and event stream, renders it
// with no changes to the component.
import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { serveRun, serveStructure, sse, timelineItems } from "./helpers";

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
