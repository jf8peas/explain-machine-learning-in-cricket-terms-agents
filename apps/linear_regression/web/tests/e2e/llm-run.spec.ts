// The language-model run, against the scripted fake model: what the visitor sees in the round feed and the graph, and how a live
// run behaves when the model is chosen, slow, refused, unreliable or wrong. (The controls themselves are in player.spec.ts.)
import { expect, test, type Page } from "./fixtures";
import { open, playToEnd, timelineItems } from "./helpers";

// Positions in the default scripted run (fake/steady on the committed data), zero-based:
// 0 load_data, 1 split, 2 explore, 3 baseline, 4 propose_features, 5 check_proposal, 6 fit_model, 7 evaluate, ...
const FIRST_PROPOSE = 4, FIRST_CHECK = 5;
const FIRST_REASON = "Runs at the halfway mark is the obvious place to start for a final total.";

const select = (page: Page) => page.getByTestId("model-select");
const rows = (page: Page) => page.getByTestId("round-item");
const start = (page: Page) => page.getByTestId("play-button");
const status = (page: Page) => page.getByTestId("player-status");

/** The page, loaded, with nothing run yet (everything open, a fast replay pace). */
async function load(page: Page, interval = 40) {
  await page.goto(`/?interval=${interval}&view=everything`);
  await expect(select(page)).toBeVisible();
  await expect(page.locator("graph-replay [data-node]").first()).toBeVisible();
}

/** Choose an AI (if one is named) and press Play. */
async function startLive(page: Page, model?: string) {
  if (model) await select(page).selectOption({ label: model });
  await start(page).click();
}
const liveDone = async (page: Page) => {
  await expect(status(page)).toHaveText(/^Finished with/, { timeout: 90_000 });
  await expect(start(page)).toBeEnabled();
};

test("the event panel says whether a step is the language model's or code's", async ({ page }) => {
  await open(page);
  await playToEnd(page);
  await timelineItems(page).nth(FIRST_PROPOSE).click();
  await expect(page.getByTestId("event-actor")).toHaveText("language model step");
  await timelineItems(page).nth(FIRST_CHECK).click();
  await expect(page.getByTestId("event-actor")).toHaveText("code step");
});

test("a proposal shows the model's reason exactly as written, then the code's check and score", async ({ page }) => {
  await open(page);
  await playToEnd(page);
  const first = rows(page).first();
  expect(await first.getByTestId("model-reason").evaluate((el) => el.textContent)).toBe(FIRST_REASON);
  const label = (await (await page.request.get("/api/catalogue")).json()).features.find((f: { id: string }) => f.id === "runs_at_10").label;
  await expect(first.getByTestId("round-idea")).toContainText(label);
  await expect(first).toHaveAttribute("data-status", "first_score");
  await expect(first.getByTestId("round-score")).toHaveText(/^\d+\.\d$/);
});

test("a rejected proposal is shown with the code's reason, and the model tries again", async ({ page }) => {
  await open(page);
  await playToEnd(page);
  const rejected = page.locator('[data-testid=round-item][data-status="rejected"]');
  await expect(rejected).toHaveCount(1);
  await expect(rejected.getByTestId("round-status")).toContainText("code rejected:");
  await expect(rejected.getByTestId("round-status")).toContainText("That idea was already tried");
  await expect(rejected.getByTestId("model-reason")).toHaveText("Let me try that once more.");
  await expect(rejected.getByTestId("round-score")).toHaveCount(0);
});

test("the agent finishing is a round of its own, and the best idea is named", async ({ page }) => {
  await open(page);
  await playToEnd(page);
  await expect(rows(page).last()).toHaveAttribute("data-status", "finished");
  await expect(rows(page).last().getByTestId("round-status")).toHaveText("agent finished");
  await expect(page.getByTestId("best-idea")).toContainText("Best idea:");
});

// --- choosing the AI for a live run ---

test("a live run with the default model says which model ran, and the round feed follows it", async ({ page }) => {
  await load(page);
  await startLive(page);
  await liveDone(page);
  await expect(status(page)).toHaveText(/^Finished with Fast · /);
  await expect(rows(page)).toHaveCount(5);                              // three fitted rounds, one rejected repeat and the finish
});

test("choosing another model changes the run and the page says so", async ({ page }) => {
  await load(page);
  await startLive(page, "Quick");
  await liveDone(page);
  await expect(status(page)).toHaveText(/^Finished with Quick · /);
  await expect(rows(page)).toHaveCount(2);                              // two rounds: the quick model finishes early
});

test("the choice cannot be changed while a run is going, so it cannot affect that run", async ({ page }) => {
  await load(page, 100);
  await select(page).selectOption({ label: "Thorough" });                // the slow scripted model
  await start(page).click();
  await expect(select(page)).toBeDisabled();
  await liveDone(page);
  await expect(status(page)).toHaveText(/^Finished with Thorough · /);
  await expect(rows(page)).toHaveCount(5);
  await expect(select(page)).toBeEnabled();
});

test("the model's reason is shown as plain text, never as markup", async ({ page }) => {
  await load(page);
  await startLive(page, "Markup");
  await liveDone(page);
  const reason = page.getByTestId("model-reason").first();
  await expect(reason).toContainText("<b>bold</b>");                      // the tags are visible characters
  await expect(reason).toContainText("<script>window.__pwned = true</script>");
  expect(await reason.locator("b, script, img").count()).toBe(0);         // and nothing was created from them
  expect(await page.evaluate(() => (window as unknown as { __pwned?: boolean }).__pwned)).toBeUndefined();
  await expect(page.locator("img[onerror]")).toHaveCount(0);
});

test("a model the server no longer lists is refused with a clear message and the default is selected again", async ({ page }) => {
  await load(page);
  await select(page).selectOption({ label: "Quick" });
  await page.route("**/api/run?model=m2", (route) => route.fulfill({
    status: 400, contentType: "application/json",
    body: JSON.stringify({ reason: "model_not_allowed", message: "That model is no longer available. The default model has been selected for you; press Play again to use it." }),
  }));
  await start(page).click();
  await expect(page.getByTestId("run-message")).toContainText("no longer available");
  await expect.poll(async () => select(page).evaluate((el) => (el as HTMLSelectElement).selectedOptions[0].textContent)).toContain("Fast");
  await expect(start(page)).toBeEnabled();
  await expect(start(page)).toHaveText("▶ Play");
  await page.unroute("**/api/run?model=m2");
  await startLive(page);                                                   // and Play now works with the default
  await liveDone(page);
  await expect(status(page)).toHaveText(/^Finished with Fast · /);
});

// --- one run at a time, and the limits ---

test("Play is disabled while a run is in progress and comes back when it ends", async ({ page }) => {
  await load(page, 100);
  await startLive(page, "Thorough");
  await expect(start(page)).toBeDisabled();
  await expect(start(page)).toHaveText("Running…");
  await liveDone(page);
  await expect(start(page)).toBeEnabled();
  await expect(start(page)).toHaveText("▶ Run again");
});

test("a refused start shows the gate's message and keeps the earlier results", async ({ page }) => {
  test.setTimeout(180_000);                                               // five whole runs: slow when the suite shares one server
  await load(page);
  await startLive(page);
  await liveDone(page);
  const before = await rows(page).count();
  expect(before).toBeGreaterThan(3);
  for (let i = 0; i < 4; i++) expect((await page.request.get("/api/run")).status()).toBe(200);   // with this one, the five allowed an hour
  await start(page).click();                                              // the sixth start
  await expect(page.getByTestId("run-message")).toContainText("You can start another run", { timeout: 15_000 });
  await expect(page.getByTestId("run-message")).toContainText("minute");
  await expect(page.getByTestId("run-message")).toHaveAttribute("role", "alert");
  await expect(start(page)).toBeEnabled();
  expect(await rows(page).count()).toBe(before);                          // the earlier results are untouched
  await expect(page.getByTestId("verdict-bars")).toBeVisible();
  await expect(status(page)).toHaveText(/^Finished with Fast · /);
});

test("the limit is per visitor: another visitor can still run", async ({ page, browser }) => {
  test.setTimeout(180_000);
  await load(page);
  for (let i = 0; i < 5; i++) expect((await page.request.get("/api/run")).status()).toBe(200);
  expect((await page.request.get("/api/run")).status()).toBe(429);
  const other = await browser.newContext({ extraHTTPHeaders: { "X-Forwarded-For": "198.51.100.200" } });
  const p2 = await other.newPage();
  await load(p2);
  await startLive(p2);
  await liveDone(p2);
  await other.close();
});

// --- when the model misbehaves ---

test("an unreliable model: a clear notice, the search still completes, and the page says so", async ({ page }) => {
  await load(page);
  await startLive(page, "Unreliable");
  await liveDone(page);
  await expect(page.getByTestId("llm-notice")).toContainText("did not take part");
  await expect(page.getByTestId("llm-notice")).toContainText("provider");     // the reason, in plain words
  await expect(status(page)).toHaveText(/^Finished with the brute-force search alone/);
  await openPathOf(page);
  await timelineItems(page).nth(FIRST_PROPOSE).click();
  await expect(page.getByTestId("event-actor")).toHaveText("language model step");
  await expect(page.getByTestId("event-summary")).toContainText("could not take part");
  await expect(page.getByTestId("result-strip")).toContainText("Result: search only.");
  await expect(page.getByTestId("verdict-bar").first()).toContainText("not run");
  await expect(page.getByTestId("tryit-model-label")).toHaveText("Predicting with the brute-force search's model.");
});

test("a model that times out is explained in plain words", async ({ page }) => {
  await load(page);
  await startLive(page, "Sluggish");
  await liveDone(page);
  await expect(page.getByTestId("llm-notice")).toContainText("did not reply in time");
  await expect(page.getByTestId("verdict-title")).toBeVisible();              // the run still reached its conclusion
});

test("the unreliable model's run can be followed by a normal one", async ({ page }) => {
  await load(page);
  await startLive(page, "Unreliable");
  await liveDone(page);
  await startLive(page, "Fast (default)");
  await expect(status(page)).toHaveText(/^Finished with Fast · /, { timeout: 90_000 });
  await expect(page.getByTestId("llm-notice")).toBeHidden();                  // the new run replaced the old one
  await expect(page.getByTestId("result-strip")).not.toContainText("search only");
});

/** The graph's "Path taken" list is closed until asked for. */
async function openPathOf(page: Page) {
  await page.locator("graph-replay [data-testid=path] > summary").click();
}
