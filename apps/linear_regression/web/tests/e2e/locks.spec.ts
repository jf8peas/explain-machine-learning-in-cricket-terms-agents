// The result is earned by a run (feature 022): the verdict, "Your turn" and the Scorebook's run-dependent cards are locked until the
// reader's run reaches its final test, stay unlocked through a later run (going or failed), and are locked again after a reload.
import { expect, test, type Page } from "./fixtures";
import { fakeRun, runToEnd, sse, visitorOf } from "./helpers";

const verdictLocked = (page: Page) => page.getByTestId("verdict-locked");
const tryLocked = (page: Page) => page.getByTestId("try-locked");
const sbCard = (page: Page, id: string) => page.getByTestId(`scorebook-card-${id}`);

/** A stream that stops after `n` steps with no `done`, as a lost connection does. */
const cutStream = (events: { step: number; node: string }[], n: number) =>
  events.slice(0, n).map((e) => sse("start", { step: e.step, node: e.node }) + sse("step", e)).join("") + sse("start", { step: n + 1, node: "split" });

async function failedRun(page: Page) {
  await page.getByTestId("play-button").scrollIntoViewIfNeeded();
  await page.getByTestId("play-button").click();
  await expect(page.getByTestId("player-status")).toHaveText(/^Stopped: /, { timeout: 30_000 });
}

test("before a run: all four are locked, with the before wording and the test season's year", async ({ page }) => {
  await page.goto("/");
  const ref = await (await page.request.get("/api/reference")).json();
  await expect(verdictLocked(page)).toBeVisible();
  await expect(page.getByTestId("verdict-title")).toHaveText("Press play to see how it does.");
  await expect(verdictLocked(page)).toContainText(`${ref.test.year} stays locked until the agent has chosen its model. Then it is used once, to judge it against the goal.`);
  await expect(page.getByTestId("verdict-bars")).toHaveCount(0);
  await expect(tryLocked(page)).toContainText("Run the experiment first. Your turn uses the model the agent builds.");
  await expect(tryLocked(page).getByRole("link", { name: /player/i })).toHaveAttribute("href", "#watch");
  await expect(page.getByTestId("tryit")).toBeHidden();
  for (const id of ["models", "graph"]) {
    await expect(sbCard(page, id)).toContainText("Available after a run");
    await expect(sbCard(page, id)).toHaveAttribute("aria-disabled", "true");
  }
  await sbCard(page, "models").dispatchEvent("click");                                  // a disabled card: Playwright would wait for it to be enabled
  await expect(page.getByTestId("scorebook-panel")).toBeHidden();
  await expect(sbCard(page, "data")).not.toContainText("Available after a run");
  await sbCard(page, "data").click();
  await expect(page.getByTestId("scorebook-panel")).toBeVisible();                     // the data does not need a run
});

test("during a run the verdict says the result appears when the agent finishes", async ({ page }) => {
  await page.goto("/?interval=40");
  await page.getByTestId("model-select").selectOption({ label: "Thorough" });
  await page.getByTestId("play-button").click();
  await expect(page.getByTestId("verdict-title")).toHaveText("The result appears when the agent finishes.");
  await expect(verdictLocked(page)).toBeVisible();
  await expect(tryLocked(page)).toBeVisible();
});

test("after a run all four unlock, the strip appears, and the bar names the model", async ({ page }) => {
  await runToEnd(page, "?interval=40");
  await expect(verdictLocked(page)).toHaveCount(0);
  await expect(page.getByTestId("verdict-bars")).toBeVisible();
  await expect(page.getByTestId("verdict-bar").first().locator(".vname")).toHaveText("AI agent (Fast)");
  await expect(tryLocked(page)).toBeHidden();
  await expect(page.getByTestId("tryit")).toBeVisible();
  for (const id of ["models", "graph"]) await expect(sbCard(page, id)).not.toContainText("Available after a run");
  await sbCard(page, "models").click();
  await expect(page.getByTestId("scorebook-panel")).toBeVisible();
  const strip = page.getByTestId("result-strip");
  await expect(strip).toBeVisible();
  await expect(strip).toHaveText(/^Result: (goal reached|short of the goal|goal missed|search only)\. The (agent|brute-force search) was [\d.]+ runs out, the broadcaster [\d.]+\. See the verdict ↓$/);
  await expect(page.getByTestId("result-link")).toHaveAttribute("href", "#verdict");
  await expect(page.getByTestId("see-result")).toBeVisible();
});

test("the unlock happens when the final test arrives and the takeaways fill in by the end", async ({ page }) => {
  await page.goto("/?interval=40");
  await page.getByTestId("model-select").selectOption({ label: "Thorough" });
  await page.getByTestId("play-button").click();
  await expect(page.getByTestId("verdict-bars")).toBeVisible({ timeout: 90_000 });
  await expect(page.getByTestId("player-status")).toHaveText(/^Finished with/, { timeout: 90_000 });
  await page.getByTestId("view-switch").click();
  await expect(page.getByTestId("vcard-drivers").getByTestId("drivers-chart")).toBeVisible();
});

test("a second run keeps the first run's results until its own final test replaces them", async ({ page }) => {
  await runToEnd(page, "?interval=40");
  await page.getByTestId("model-select").selectOption({ label: "Thorough" });
  await page.getByTestId("play-button").click();
  await expect(page.getByTestId("player-status")).toHaveText(/^Live with/);
  await expect(page.getByTestId("verdict-bars")).toBeVisible();                        // still the first run's
  await expect(verdictLocked(page)).toHaveCount(0);
  await expect(page.getByTestId("tryit")).toBeVisible();
  await expect(page.getByTestId("verdict-bar").first().locator(".vname")).toHaveText("AI agent (Fast)");
  await expect(page.getByTestId("verdict-bar").first().locator(".vname")).toHaveText("AI agent (Thorough)", { timeout: 90_000 });
});

test("a failed first run leaves everything locked, with the failure wording and the way to try again", async ({ page, request }, info) => {
  const real = await fakeRun(request, visitorOf(info.testId, "real"));
  await page.route("**/api/run*", (route) => route.fulfill({ status: 200, headers: { "content-type": "text/event-stream" }, body: cutStream(real.events, 3) }));
  await page.goto("/?interval=40");
  await failedRun(page);
  await expect(page.getByTestId("verdict-title")).toHaveText(/^The run didn't finish: .*\. Press play to try again, or choose another AI\.$/);
  await expect(tryLocked(page)).toBeVisible();
  await expect(sbCard(page, "models")).toContainText("Available after a run");
  await expect(page.getByTestId("play-button")).toHaveText("▶ Play");
  await expect(page.getByTestId("watch-again")).toBeHidden();
});

test("a failed second run keeps the first run's results", async ({ page, request }, info) => {
  const real = await fakeRun(request, visitorOf(info.testId, "real"));
  let n = 0;
  await page.route("**/api/run*", (route) => (++n === 1
    ? route.continue()
    : route.fulfill({ status: 200, headers: { "content-type": "text/event-stream" }, body: cutStream(real.events, 3) })));
  await runToEnd(page, "?interval=40");
  await failedRun(page);
  await expect(page.getByTestId("run-message")).not.toBeEmpty();
  await expect(verdictLocked(page)).toHaveCount(0);
  await expect(page.getByTestId("verdict-bars")).toBeVisible();
  await expect(page.getByTestId("tryit")).toBeVisible();
  await expect(page.getByTestId("play-button")).toHaveText("▶ Run again");
  await expect(page.getByTestId("watch-again")).toBeVisible();
});

test("a reload locks everything again, and #verdict and #try land on the locked cards", async ({ page }) => {
  await runToEnd(page, "?interval=40");
  await page.reload();
  await expect(verdictLocked(page)).toBeVisible();
  await expect(tryLocked(page)).toBeVisible();
  await page.goto("/#verdict");
  await expect(verdictLocked(page)).toBeInViewport();
  await page.goto("/#try");
  await expect(tryLocked(page)).toBeInViewport();
});
