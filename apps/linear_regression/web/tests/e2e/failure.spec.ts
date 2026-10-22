// A refused or failed run leaves the page usable and says so in plain words (feature 022, User Story 4): the gate's refusal as an alert under
// the button, a run that stops part-way with the node that was working marked, "Stopped: …" in Right now, and the rounds already shown kept.
import { expect, test, type Page } from "./fixtures";
import { fakeRun, sse, visitorOf } from "./helpers";

const status = (page: Page) => page.getByTestId("player-status");

/** The first `n` steps, then the start of the next node, and no `done`: a connection that drops in the middle of a node. */
const cut = (events: { step: number; node: string }[], n: number) =>
  events.slice(0, n).map((e) => sse("start", { step: e.step, node: e.node }) + sse("step", e)).join("") + sse("start", { step: n + 1, node: events[n].node });

test("a refused start shows the gate's message as an alert and leaves the page usable", async ({ page }) => {
  await page.route("**/api/run*", (route) => route.fulfill({
    status: 429, contentType: "application/json", headers: { "Retry-After": "600" },
    body: JSON.stringify({ reason: "hourly_limit", message: "You've used your 5 live runs for this hour. Try again in 10 minutes.", retry_after_seconds: 600 }),
  }));
  await page.goto("/?interval=40");
  await page.getByTestId("play-button").click();
  const message = page.getByTestId("run-message");
  await expect(message).toHaveText("You've used your 5 live runs for this hour. Try again in 10 minutes.");
  await expect(message).toHaveAttribute("role", "alert");
  await expect(status(page)).toHaveText("Ready. Choose the AI and press play.");
  await expect(page.getByTestId("play-button")).toBeEnabled();
  await expect(page.getByTestId("model-select")).toBeEnabled();
  await expect(page.getByTestId("verdict-locked")).toBeVisible();
  await expect(page.getByTestId("start-experiment")).toBeVisible();              // the rest of the page works
});

test("pressing Play again after a refusal clears the message and tries again", async ({ page }) => {
  let n = 0;
  await page.route("**/api/run*", (route) => (++n === 1
    ? route.fulfill({ status: 429, contentType: "application/json", body: JSON.stringify({ reason: "daily_limit", message: "The site's runs for today are used up. Try again tomorrow." }) })
    : route.continue()));
  await page.goto("/?interval=40");
  await page.getByTestId("play-button").click();
  await expect(page.getByTestId("run-message")).toContainText("used up");
  await page.getByTestId("play-button").click();
  await expect(page.getByTestId("run-message")).toBeEmpty();
  await expect(status(page)).toHaveText(/^Finished with/, { timeout: 90_000 });
});

test("a run that stops part-way marks the node that was working, says Stopped in Right now, and keeps the rounds already shown", async ({ page, request }, info) => {
  const real = await fakeRun(request, visitorOf(info.testId, "real"));
  const FIRST_FIT = real.events.findIndex((e) => e.node === "fit_model");          // stop while the first fit is working: a round has been shown
  await page.route("**/api/run*", (route) => route.fulfill({ status: 200, headers: { "content-type": "text/event-stream" }, body: cut(real.events, FIRST_FIT) }));
  await page.goto("/?interval=40");
  await page.getByTestId("play-button").click();
  await expect(status(page)).toHaveText(/^Stopped: /, { timeout: 30_000 });
  await expect(page.locator('graph-replay [data-node="fit_model"]')).toHaveAttribute("data-state", "error");
  await expect(page.locator('graph-replay [data-state="error"]')).toHaveCount(1);
  await expect(page.locator('graph-replay [data-state="running"]')).toHaveCount(0);
  await expect(page.getByTestId("right-now-stopped")).toBeVisible();
  await expect(page.getByTestId("right-now-stopped")).toContainText("Stopped:");
  await expect(page.getByTestId("right-now-step")).toHaveText("fit_model");
  await expect(page.getByTestId("round-item")).toHaveCount(1);                       // the idea that was proposed and checked stays
  await expect(page.getByTestId("verdict-title")).toHaveText(/^The run didn't finish: /);
  await expect(page.getByTestId("play-button")).toHaveText("▶ Play");
  await expect(page.getByTestId("model-select")).toBeEnabled();
  expect(await page.locator('graph-replay [data-node="fit_model"]').evaluate((el) => getComputedStyle(el).boxShadow)).not.toBe("none");   // marked by more than colour
});

test("the unreliable and the sluggish AIs each end in a clear message and a finished brute-force run", async ({ page }) => {
  for (const [name, said] of [["Unreliable", "did not take part"], ["Sluggish", "did not reply in time"]] as const) {
    await page.goto("/?interval=40");
    await page.getByTestId("model-select").selectOption({ label: name });
    await page.getByTestId("play-button").click();
    await expect(status(page)).toHaveText(/^Finished with the brute-force search alone/, { timeout: 90_000 });
    await expect(page.getByTestId("llm-notice")).toContainText(said);
  }
});

test("when the list of AIs fails and the model is unknown to the server, the run falls back to the default", async ({ page }) => {
  await page.goto("/?interval=40");
  const first = await page.request.get("/api/run?model=m999", { headers: { "X-Forwarded-For": "198.51.100.77" } });
  expect(first.status()).toBe(400);                                                   // the server refuses a token it does not know
  expect((await first.json()).reason).toBe("model_not_allowed");
});
