// The graph during and after a live run (feature 022): the node that has started and not completed is ringed (exactly one while the run
// goes), completed nodes are done and never go back, and "Right now" says what is happening. Uses the slow scripted model so there is
// time to watch.
import { expect, test, type Page } from "./fixtures";

const node = (page: Page, state: string) => page.locator(`graph-replay [data-node][data-state="${state}"]`);

test("exactly one node is ringed while the run goes, done nodes never decrease, and after it none is ringed", async ({ page }) => {
  await page.goto("/?interval=40");
  await expect(page.getByTestId("hero-title")).toBeVisible();
  await expect(page.locator("graph-replay [data-node]").first()).toBeVisible();
  await page.getByTestId("model-select").selectOption({ label: "Thorough" });
  await page.getByTestId("play-button").click();

  const samples: { running: number; done: number }[] = [];
  const finished = page.getByTestId("player-status");
  for (let i = 0; i < 600; i++) {
    samples.push({ running: await node(page, "running").count(), done: await node(page, "done").count() });
    if (/^Finished with/.test((await finished.textContent()) ?? "")) break;
    await page.waitForTimeout(100);
  }
  expect(samples.length).toBeGreaterThan(10);
  expect(Math.max(...samples.map((s) => s.running))).toBe(1);                              // never two rings
  const ringed = samples.filter((s) => s.running === 1).length;
  expect(ringed / samples.length).toBeGreaterThan(0.6);                                    // one ring almost all the time (a node's start to its step)
  const done = samples.map((s) => s.done);
  expect(done).toEqual([...done].sort((a, b) => a - b));                                   // done only grows
  expect(Math.max(...done)).toBeGreaterThan(8);
  await expect(node(page, "running")).toHaveCount(0);
  await expect(node(page, "error")).toHaveCount(0);
  const visited = await page.locator("graph-replay [data-node].visited").count();
  expect(await node(page, "done").count()).toBe(visited);                                  // every visited node is done
});

test("the AI's nodes keep their dashed purple style, and Right now follows the run", async ({ page }) => {
  await page.goto("/?interval=40");
  await expect(page.locator("graph-replay [data-node]").first()).toBeVisible();
  for (const id of ["propose_features", "write_in_cricket_terms"]) await expect(page.locator(`graph-replay [data-node="${id}"]`)).toHaveClass(/actor-llm/);
  await expect(page.getByTestId("right-now-step")).toHaveText("—");
  await page.getByTestId("model-select").selectOption({ label: "Thorough" });
  await page.getByTestId("play-button").click();
  await expect(page.getByTestId("right-now-step")).not.toHaveText("—");
  await expect(page.getByTestId("right-now-doing")).not.toHaveText("—");
  const doing = (await (await page.request.get("/api/structure")).json()).doing;
  await expect(page.getByTestId("right-now-doing")).toHaveText(await page.getByTestId("right-now-doing").textContent() ?? "");
  await expect(page.getByTestId("right-now-step")).toHaveText("propose_features", { timeout: 30_000 });
  await expect(page.getByTestId("right-now-doing")).toHaveText(doing.propose_features);
  await expect(page.getByTestId("right-now-round")).toHaveText(/^\d of up to \d$|^—$/);
  await expect(page.getByTestId("player-status")).toHaveText(/^Finished with/, { timeout: 90_000 });
  await expect(page.getByTestId("right-now-best")).toHaveText(/^\d+\.\d$/);
});

test("the eight-stage legend and the replay controls come only with Show me everything, after a run", async ({ page }) => {
  await page.goto("/?interval=40");
  await expect(page.locator("graph-replay [data-node]").first()).toBeVisible();
  await expect(page.locator("graph-replay [data-testid=legend]")).toBeHidden();
  await expect(page.locator("graph-replay [data-testid=back]")).toBeHidden();
  await page.getByTestId("view-switch").click();
  await expect(page.locator("graph-replay [data-testid=legend]")).toBeVisible();
  await expect(page.locator("graph-replay [data-testid=back]")).toBeHidden();             // no run to step through yet
  await page.getByTestId("play-button").click();
  await expect(page.getByTestId("player-status")).toHaveText(/^Finished with/, { timeout: 90_000 });
  for (const id of ["back", "step", "reset", "speed"]) await expect(page.locator(`graph-replay [data-testid=${id}]`)).toBeVisible();
  await page.locator("graph-replay [data-testid=back]").click();
  await expect(page.locator("graph-replay [data-testid=step]")).toBeEnabled();
});

test("the graph is shown by default, outside Commentary, with the explanation and its legend above it", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("graph-replay [data-node]").first()).toBeVisible();
  const inCommentary = await page.getByTestId("run-graph").evaluate((el) => !!el.closest(".commentary"));
  expect(inCommentary).toBe(false);
  await expect(page.locator("h3.agent-question")).toHaveText("What makes it an agent?");
  await expect(page.getByTestId("agent-explainer")).toContainText("A language model working in a loop");
  await expect(page.getByTestId("agent-legend")).toHaveText("Purple dashed: the AI decides · Solid: code · Green: done · Ringed: happening now");
  await expect(page.getByTestId("agent-commentary")).toBeHidden();
  await page.getByTestId("view-switch").click();
  await expect(page.getByTestId("agent-commentary")).toContainText("Built with LangGraph.");
  await expect(page.getByTestId("agent-commentary")).toContainText("conditional");
});
