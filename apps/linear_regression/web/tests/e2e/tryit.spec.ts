// Your turn (features 020 and 022; locked until a run has finished): a halfway score in, the agent's own model's prediction beside the TV's out, worked out in the browser.
import { readFileSync } from "node:fs";
import { expect, test, type Page } from "./fixtures";
import { runToEnd, streamOf } from "./helpers";

// The scripted fake run is deterministic, so its model is the one a live run with the default AI builds.
const fakeRunFile = () => JSON.parse(readFileSync("tests/fixtures/fake-run.json", "utf8"));
const finalOf = (run = fakeRunFile()) => run.events.find((e: { node: string }) => e.node === "final_test").changes.final;

// Plausible values for whatever the model asks for (the form is built from the model's own features).
const PLAUSIBLE: Record<string, string> = {
  runs_at_10: "80", wickets_at_10: "2", powerplay_runs: "45", powerplay_wickets: "1", runs_overs_7_10: "35",
  wickets_overs_7_10: "1", fours_at_10: "7", sixes_at_10: "2", dot_balls_at_10: "25", extras_at_10: "4",
  partnership_runs: "22", balls_since_last_wicket: "18",
};
const DERIVED = ["wickets_in_hand", "runs_x_wickets_in_hand", "is_ipl", "is_bbl"];
const predict = (page: Page) => page.getByRole("button", { name: "Predict", exact: true });

/** Run the fake model to its end; Your turn is unlocked then. */
async function open(page: Page) {
  await runToEnd(page, "?interval=40");
  await expect(page.getByTestId("tryit")).toBeVisible();
}

/** Serve this run in place of the live one, to give the form another model. */
async function serve(page: Page, run: { events: { step: number; node: string }[] }) {
  await page.route("**/api/run*", (route) =>
    route.fulfill({ status: 200, headers: { "content-type": "text/event-stream" }, body: streamOf(run.events) }));
}
const askedFor = (page: Page) => page.locator("[data-testid=tryit-fields] input").evaluateAll((els) => els.map((e) => (e as HTMLInputElement).name));

const fillAll = async (page: Page, overrides: Record<string, string> = {}) => {
  for (const name of await askedFor(page)) await page.locator(`input[name="${name}"]`).fill(overrides[name] ?? PLAUSIBLE[name] ?? "5");
  const select = page.locator("[data-testid=tryit-fields] select");
  if (await select.count()) await select.selectOption("ipl");
  await predict(page).click();
};

test("the section reads Give it a halfway score, and the form is ready once the run has finished", async ({ page }) => {
  await open(page);
  await expect(page.locator("#try .kicker")).toHaveText("YOUR TURN");
  await expect(page.locator("#try-title")).toHaveText("Give it a halfway score.");
  await expect(page.locator("#try .lead")).toHaveText("See the agent's prediction next to the TV's.");
  await expect(predict(page)).toBeEnabled();
  await expect(page.getByTestId("tryit-hint")).toBeHidden();
});

test("before a run the form is hidden behind a locked card that says to run the experiment first", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("try-locked")).toBeVisible();
  await expect(page.getByTestId("try-locked")).toContainText("Run the experiment first. Your turn uses the model the agent builds.");
  await expect(page.getByTestId("tryit")).toBeHidden();
});

test("the form asks for the agent's own model's inputs only, starting with runs at 10 overs, and says whose model it is", async ({ page }) => {
  await open(page);
  await expect(predict(page)).toBeEnabled();
  const model = finalOf().agent_model;
  expect(model.source).toBe("agent");
  const asked = await askedFor(page);
  expect(asked[0]).toBe("runs_at_10");
  for (const derived of DERIVED) expect(asked).not.toContain(derived);
  if (model.features.includes("is_ipl") || model.features.includes("is_bbl")) await expect(page.locator("[data-testid=tryit-fields] select")).toHaveCount(1);
  for (const f of model.features.filter((x: string) => !DERIVED.includes(x))) expect(asked).toContain(f);
  await expect(page.getByTestId("tryit-model-label")).toHaveText("Predicting with the AI agent's model.");
});

test("when no language model ran, the form uses the brute-force search's model and says so", async ({ page }) => {
  const run = fakeRunFile();
  const step = run.events.find((e: { node: string }) => e.node === "final_test");
  step.changes.final = { ...step.changes.final, agent_model: { ...step.changes.final.agent_model, source: "search" } };
  await serve(page, run);
  await open(page);
  await expect(page.getByTestId("tryit-model-label")).toHaveText("Predicting with the brute-force search's model.");
  await fillAll(page);
  await expect(page.getByTestId("tryit-model-cap")).toHaveText("the search's predicted total");
});

test("valid input shows the agent's prediction beside the TV projection, computed in the browser", async ({ page }) => {
  let requests = 0;
  await open(page);
  page.on("request", (r) => { if (new URL(r.url()).pathname.startsWith("/api/")) requests++; });
  await fillAll(page, { runs_at_10: "80" });
  await expect(page.getByTestId("tryit-tv")).toHaveText("160");
  const mine = Number(await page.getByTestId("tryit-model").textContent());
  expect(mine).toBeGreaterThan(100);
  expect(mine).toBeLessThan(240);
  await expect(page.getByTestId("tryit-model-cap")).toHaveText("the agent's predicted total");
  expect(requests).toBe(0);
});

test("the prediction uses the agent's model, not the pick's, when they differ", async ({ page }) => {
  const run = fakeRunFile();
  const step = run.events.find((e: { node: string }) => e.node === "final_test");
  // an agent model that only adds a constant to runs at 10 overs, with the pick left as it was
  step.changes.final = { ...step.changes.final, agent_model: { source: "agent", features: ["runs_at_10"], coefficients: { runs_at_10: 2 }, intercept: 7 } };
  await serve(page, run);
  await open(page);
  expect(await askedFor(page)).toEqual(["runs_at_10"]);
  await fillAll(page, { runs_at_10: "80" });
  await expect(page.getByTestId("tryit-model")).toHaveText("167");
});

test("invalid input shows a message and no prediction", async ({ page }) => {
  await open(page);
  await expect(predict(page)).toBeEnabled();
  for (const [name, value, msg] of [
    ["runs_at_10", "-5", "negative"],
    ["wickets_at_10", "10", "between 0 and 9"],
    ["runs_at_10", "", "enter a number"],
    ["runs_at_10", "7.5", "whole number"],
  ]) {
    if (!(await page.locator(`input[name="${name}"]`).count())) continue; // not asked for by this model
    await fillAll(page, { [name]: value });
    await expect(page.getByTestId("tryit-error")).toContainText(msg);
    await expect(page.getByTestId("tryit-result")).toBeHidden();
  }
});

test("the form is on a dark card, and its fields and button are at least 44 px tall", async ({ page }) => {
  await open(page);
  await page.getByTestId("tryit").scrollIntoViewIfNeeded();
  for (const el of await page.locator("[data-testid=tryit-fields] input, [data-testid=tryit-fields] select, #try button").all()) {
    expect((await el.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  }
});
