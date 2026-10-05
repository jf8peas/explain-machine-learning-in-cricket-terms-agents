// The language-model run, against the scripted fake model: what the visitor sees and how it is explained.
import { expect, test } from "./fixtures";
import { open, playToEnd, timelineItems } from "./helpers";

// Positions in the default scripted run (fake/steady on the committed data), zero-based:
// 0 load_data, 1 split, 2 explore, 3 baseline, 4 propose_features, 5 check_proposal, 6 fit_model, 7 evaluate, ...
const FIRST_PROPOSE = 4, FIRST_CHECK = 5, FIRST_EVALUATE = 7, SECOND_EVALUATE = 11;
const FIRST_REASON = "Runs at the halfway mark is the obvious place to start for a final total.";

test("the language-model node looks different from the code nodes", async ({ page }) => {
  await open(page);
  const llm = page.locator('[data-node="propose_features"]');
  await expect(llm).toHaveClass(/actor-llm/);
  await expect(llm.locator(".actor-tag")).toHaveText("LLM");
  await expect(page.locator(".node.actor-llm")).toHaveCount(1);   // only this one
  for (const id of ["load_data", "check_proposal", "fit_model", "evaluate", "forward_selection", "final_test"]) {
    await expect(page.locator(`[data-node="${id}"]`)).not.toHaveClass(/actor-llm/);
  }
  const dash = (id: string) => page.locator(`[data-node="${id}"] rect`).first().evaluate((r) => getComputedStyle(r).strokeDasharray);
  expect(await dash("propose_features")).not.toBe("none");
  expect(await dash("check_proposal")).toBe("none");
});

test("the event panel says whether a step is the language model's or code's", async ({ page }) => {
  await open(page);
  await playToEnd(page);
  await timelineItems(page).nth(FIRST_PROPOSE).click();
  await expect(page.getByTestId("event-actor")).toHaveText("language model step");
  await timelineItems(page).nth(FIRST_CHECK).click();
  await expect(page.getByTestId("event-actor")).toHaveText("code step");
});

test("a proposal shows the model's reason, labelled, and then the code's check", async ({ page }) => {
  await open(page);
  await playToEnd(page);
  await timelineItems(page).nth(FIRST_CHECK).click();
  const round = page.getByTestId("round-item").first();
  await expect(round.locator(".tag")).toHaveText("The model's reasoning:");
  await expect(page.getByTestId("model-reason").first()).toHaveText(FIRST_REASON);
  await expect(round).toContainText("runs scored at the halfway mark");
  await expect(round).toContainText("Accepted and fitted");
  await expect(page.getByTestId("rounds").locator("h3")).toContainText("The model's reasoning");
});

test("a rejected proposal is shown with the code's reason, and the model tries again", async ({ page }) => {
  await open(page);
  await playToEnd(page);
  const rejected = page.locator('[data-testid=round-item][data-outcome="rejected"]');
  await expect(rejected).toHaveCount(1);
  await expect(rejected).toContainText("Rejected by code: That set of features was already tried.");
  await expect(rejected.getByTestId("model-reason")).toHaveText("Let me try that once more.");
});

test("each evaluation shows the validation error and whether it improved", async ({ page }) => {
  await open(page);
  await playToEnd(page);
  await timelineItems(page).nth(FIRST_EVALUATE).click();
  const first = page.getByTestId("attempt-row").first();
  await expect(first).toContainText("Language model");
  await expect(first).toContainText("improved");
  const error = Number(await first.locator("td").nth(1).textContent());
  expect(error).toBeGreaterThan(0);
  await expect(page.getByTestId("event-summary")).toContainText("misses by");
  await timelineItems(page).nth(SECOND_EVALUATE).click();
  await expect(page.getByTestId("attempt-row")).toHaveCount(2);
});

test("the leaderboard builds step by step: every attempt, who proposed it, its validation error", async ({ page }) => {
  await open(page);
  await playToEnd(page);
  const count = () => page.getByTestId("attempt-row").count();
  await timelineItems(page).nth(3).click();
  expect(await count()).toBe(0);
  await timelineItems(page).nth(FIRST_EVALUATE).click();
  expect(await count()).toBe(1);
  await timelineItems(page).nth(SECOND_EVALUATE).click();
  expect(await count()).toBe(2);
  await timelineItems(page).last().click();
  expect(await count()).toBe(3 + 8);                              // three language-model sets and eight forward-selection steps
  const proposers = await page.getByTestId("attempt-row").evaluateAll((rows) => rows.map((r) => (r as HTMLElement).dataset.proposer));
  expect(proposers).toEqual([...Array(3).fill("llm"), ...Array(8).fill("forward_selection")]);
  await expect(page.getByTestId("leaderboard")).toContainText("TV projected score");
});

test("forward selection's steps are visible one feature at a time", async ({ page }) => {
  await open(page);
  await playToEnd(page);
  const names = await timelineItems(page).allTextContents();
  expect(names.filter((n) => n.includes("forward_selection"))).toHaveLength(8);
  const forward = page.locator('[data-testid=attempt-row][data-proposer="forward_selection"]');
  await expect(forward).toHaveCount(8);
  await expect(forward.first()).toContainText("Forward selection");
  const sizes = await forward.evaluateAll((rows) => rows.map((r) => (r.querySelector("th")?.textContent ?? "").split(",").length));
  expect(sizes).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
});

test("the final results compare the three test-year errors and name the winner", async ({ page }) => {
  await open(page);
  await playToEnd(page);
  const final = JSON.parse((await page.locator('[data-key="final"] pre').textContent())!);
  await expect(page.getByTestId("final-llm")).toContainText(final.test_mae.llm.toFixed(1));
  await expect(page.getByTestId("final-forward")).toContainText(final.test_mae.forward.toFixed(1));
  await expect(page.getByTestId("final-tv")).toContainText(final.test_mae.tv.toFixed(1));
  await expect(page.getByTestId("winner")).toContainText(/won/);
  await expect(page.getByTestId("winner")).toContainText(final.winner === "llm" ? "language model" : "forward selection", { ignoreCase: true });
  await expect(page.getByTestId("model-used")).toContainText("Fast");
});

// --- choosing the language model ---

const picker = (page: import("./fixtures").Page) => page.getByTestId("model-select");
const proposals = async (page: import("./fixtures").Page) =>
  (await timelineItems(page).allTextContents()).filter((t) => t.includes("propose_features")).length;

test("the picker lists the owner's models with a name and a note, and the default is preselected", async ({ page }) => {
  await open(page);
  const options = picker(page).locator("option");
  await expect(options).toHaveText(["Fast", "Quick", "Thorough", "Markup", "Unreliable", "Sluggish"]);
  await expect(picker(page)).toHaveValue("m1");
  await expect(page.getByTestId("model-note")).toHaveText("A steady scripted model.");
  await picker(page).selectOption({ label: "Quick" });
  await expect(page.getByTestId("model-note")).toHaveText("Finishes in two rounds.");
  await expect(page.locator("graph-replay")).toHaveAttribute("run-url", "/api/run?model=m2");
  expect(await page.content()).not.toContain("fake/steady");        // no model id in the page
});

test("Play without choosing uses the default, and the results say which model ran", async ({ page }) => {
  await open(page);
  await playToEnd(page);
  await expect(page.getByTestId("model-used")).toHaveText("Language model used: Fast");
  expect(await proposals(page)).toBe(5);
});

test("choosing another model changes the run and the results say so", async ({ page }) => {
  await open(page);
  await picker(page).selectOption({ label: "Quick" });
  await playToEnd(page);
  await expect(page.getByTestId("model-used")).toHaveText("Language model used: Quick");
  expect(await proposals(page)).toBe(2);                            // two rounds: the quick model finishes early
});

test("changing the picker during a run does not affect that run", async ({ page }) => {
  await open(page, 100);
  await picker(page).selectOption({ label: "Thorough" });           // the slow scripted model
  await page.getByTestId("play").click();
  await expect(page.locator("graph-replay")).toHaveAttribute("data-running", "true");
  await picker(page).selectOption({ label: "Quick" });              // too late for this run
  await expect(page.getByTestId("explanation")).toBeVisible({ timeout: 45_000 });   // the first run, still going
  await expect(page.getByTestId("model-used")).toHaveText("Language model used: Thorough");
  expect(await proposals(page)).toBe(5);
  await expect(page.locator("graph-replay")).toHaveAttribute("run-url", "/api/run?model=m2");  // the next run uses Quick
});

test("the model's reason is shown as plain text, never as markup", async ({ page }) => {
  await open(page);
  await picker(page).selectOption({ label: "Markup" });
  await playToEnd(page);
  const reason = page.getByTestId("model-reason").first();
  await expect(reason).toContainText("<b>bold</b>");                // the tags are visible characters
  await expect(reason).toContainText("<script>window.__pwned = true</script>");
  expect(await reason.locator("b, script, img").count()).toBe(0);   // and nothing was created from them
  expect(await page.evaluate(() => (window as unknown as { __pwned?: boolean }).__pwned)).toBeUndefined();
  await expect(page.locator("img[onerror]")).toHaveCount(0);
});

test("a model the server no longer lists is refused with a clear message and the default is selected again", async ({ page }) => {
  await open(page);
  await picker(page).selectOption({ label: "Quick" });
  await page.route("**/api/run?model=m2", (route) => route.fulfill({
    status: 400, contentType: "application/json",
    body: JSON.stringify({ reason: "model_not_allowed", message: "That model is no longer available. The default model has been selected for you; press Play again to use it." }),
  }));
  await page.getByTestId("play").click();
  await expect(page.getByTestId("status")).toContainText("no longer available");
  await expect(picker(page)).toHaveValue("m1");                      // back to the default
  await expect(page.getByTestId("play")).toBeEnabled();
  await page.unroute("**/api/run?model=m2");
  await playToEnd(page);                                              // and Play now works with the default
  await expect(page.getByTestId("model-used")).toHaveText("Language model used: Fast");
});

// --- one run at a time, and the limits ---

test("Play is disabled while a run is in progress and comes back when it ends", async ({ page }) => {
  await open(page, 100);
  await picker(page).selectOption({ label: "Thorough" });          // the slow scripted model keeps the stream open a while
  await page.getByTestId("play").click();
  await expect(page.getByTestId("play")).toBeDisabled();
  await expect(page.locator("graph-replay")).toHaveAttribute("data-running", "true");
  await expect(page.getByTestId("explanation")).toBeVisible({ timeout: 45_000 });
  await expect(page.getByTestId("play")).toBeEnabled();
  await expect(page.locator("graph-replay")).toHaveAttribute("data-running", "false");
  await expect(page.getByTestId("model-used")).toContainText("Thorough");
});

test("a refused start shows the message and keeps the earlier results", async ({ page }) => {
  await open(page);
  await playToEnd(page);                                               // run 1 of the 5 allowed an hour
  const rows = await page.getByTestId("attempt-row").count();
  expect(rows).toBe(11);
  for (let i = 0; i < 4; i++) expect((await page.request.get("/api/run")).status()).toBe(200);   // runs 2 to 5
  await page.getByTestId("play").click();                              // the sixth start
  await expect(page.getByTestId("status")).toContainText("You can start another run", { timeout: 15_000 });
  await expect(page.getByTestId("status")).toContainText("minute");
  await expect(page.getByTestId("play")).toBeEnabled();                // nothing is running, so Play is available again
  expect(await page.getByTestId("attempt-row").count()).toBe(rows);    // the earlier results are untouched
  await expect(page.getByTestId("explanation")).toBeVisible();
  await expect(page.getByTestId("timeline-item")).toHaveCount(30);
});

test("the limit is per visitor: another visitor can still run", async ({ page, browser }) => {
  await open(page);
  for (let i = 0; i < 5; i++) expect((await page.request.get("/api/run")).status()).toBe(200);
  expect((await page.request.get("/api/run")).status()).toBe(429);
  const other = await browser.newContext({ extraHTTPHeaders: { "X-Forwarded-For": "198.51.100.200" } });
  const p2 = await other.newPage();
  await open(p2);
  await playToEnd(p2);
  await expect(p2.getByTestId("model-used")).toBeVisible();
  await other.close();
});

// --- when the model misbehaves ---

test("an unreliable model: a clear failure, forward selection still completes, and the results say so", async ({ page }) => {
  await open(page);
  await picker(page).selectOption({ label: "Unreliable" });
  await playToEnd(page);
  await expect(page.getByTestId("llm-notice")).toContainText("did not take part");
  await expect(page.getByTestId("llm-notice")).toContainText("provider");   // the reason, in plain words
  await timelineItems(page).nth(FIRST_PROPOSE).click();
  await expect(page.getByTestId("event-actor")).toHaveText("language model step");
  await expect(page.getByTestId("event-summary")).toContainText("could not take part");
  await timelineItems(page).last().click();
  const rows = page.getByTestId("attempt-row");
  await expect(rows).toHaveCount(8);                                           // forward selection alone
  expect(await rows.evaluateAll((r) => r.every((x) => (x as HTMLElement).dataset.proposer === "forward_selection"))).toBe(true);
  await timelineItems(page).last().click();
  await expect(page.getByTestId("winner")).toContainText("did not take part");
  await expect(page.getByTestId("final-llm")).toContainText("did not take part");
  await expect(page.getByTestId("explanation")).toContainText("did not take part");
  await expect(page.getByTestId("model-used")).toContainText("Unreliable");
});

test("a model that times out is explained in plain words", async ({ page }) => {
  await open(page);
  await picker(page).selectOption({ label: "Sluggish" });
  await playToEnd(page);
  await expect(page.getByTestId("llm-notice")).toContainText("did not reply in time");
  await expect(page.getByTestId("attempt-row")).toHaveCount(8);
  await expect(page.getByTestId("verdict")).toBeVisible();                     // the run still reached its conclusion
});

test("the unreliable model's run can be followed by a normal one", async ({ page }) => {
  await open(page);
  await picker(page).selectOption({ label: "Unreliable" });
  await playToEnd(page);
  await picker(page).selectOption({ label: "Fast" });
  await page.getByTestId("play").click();
  await expect(page.getByTestId("attempt-row")).toHaveCount(11, { timeout: 45_000 });  // the new run replaced the old one
  await expect(page.getByTestId("llm-notice")).toHaveCount(0);
});

// --- what the page says about the language model ---

test("the intro says a language model decides what to try and that every number comes from code", async ({ page }) => {
  await open(page);
  const intro = page.getByTestId("intro");
  await expect(intro).toContainText("language model");
  await expect(intro).toContainText("decides which features to try next");
  await expect(intro).toContainText("every number you see comes from that code");
  await expect(intro).not.toContainText("no AI language model");
  await expect(intro).toContainText("Forward selection");
});

test("a note says runs can differ because a language model is involved, and that this is expected", async ({ page }) => {
  await open(page);
  const note = page.getByTestId("variation-note");
  await expect(note).toBeVisible();
  await expect(note).toContainText("runs can differ each time");
  await expect(note).toContainText("expected");
});
