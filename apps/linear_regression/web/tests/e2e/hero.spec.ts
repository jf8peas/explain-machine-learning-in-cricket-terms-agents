// The hero (feature 020): the agent is the hero. The headline, the Scoreboard card and the links come from the recorded run with
// no button pressed; the Commentary about the TV projection is closed until asked for.
import { readFileSync } from "node:fs";
import { expect, test } from "./fixtures";
import type { Page } from "./fixtures";

const recorded = () => JSON.parse(readFileSync("tests/fixtures/recorded-run.fake.json", "utf8"));
const finalOf = (run = recorded()) => run.events.find((e: { node: string }) => e.node === "final_test").changes.final;
const stateOf = (run = recorded()) => Object.assign({}, ...run.events.map((e: { changes: object }) => e.changes));
const CASES: { name: string; expected: { case: string; hero_h1: string; lead: string; scoreboard: { subject_label: string; subject_miss: number; tv_miss: number; facts: { id: string; text: string }[] } } }[] =
  JSON.parse(readFileSync("tests/fixtures/headline_cases.json", "utf8"));

async function open(page: Page, query = "") {
  await page.goto(`/${query}`);
  await expect(page.getByTestId("hero-title")).toBeVisible();
}

/** Serve the recording with another headline set in its final test, to see how the hero shows each case. */
async function serveWithHeadlines(page: Page, headlines: unknown, accuracy?: Record<string, unknown>) {
  const run = recorded();
  const step = run.events.find((e: { node: string }) => e.node === "final_test");
  step.changes.final = { ...step.changes.final, headlines, ...(accuracy ? { accuracy } : {}) };
  await page.route("**/recorded-run.json", (route) => route.fulfill({ json: run }));
}

test("the hero reads, with nothing pressed: kicker, the server's headline, the lead and the two links", async ({ page }) => {
  await open(page);
  const headlines = finalOf().headlines;
  await expect(page.getByTestId("hero-kicker")).toHaveText("AN AI AGENT EXPERIMENT");
  await expect(page.getByTestId("hero-title")).toHaveText(headlines.hero_h1);
  await expect(page.getByTestId("hero-lead")).toHaveText(headlines.lead);
  await expect(page.getByTestId("link-watch")).toHaveText("Watch it work");
  await expect(page.getByTestId("link-watch")).toHaveAttribute("href", "#watch");
  await expect(page.getByTestId("link-try")).toHaveText("Try your own innings");
  await expect(page.getByTestId("link-try")).toHaveAttribute("href", "#try");
});

test("the Scoreboard card shows the agent's and the TV's average miss, and the three facts, from the run's final test", async ({ page }) => {
  await open(page);
  const final = finalOf(), state = stateOf();
  const kicker = `SCOREBOARD · ${state.split.test_year} SEASON, ${final.accuracy.broadcaster.n} UNSEEN INNINGS`;
  await expect(page.getByTestId("scoreboard-kicker")).toHaveText(kicker);
  await expect(page.getByTestId("scoreboard-agent")).toHaveText(final.accuracy.llm.average_miss.toFixed(1));
  await expect(page.getByTestId("scoreboard-tv")).toHaveText(final.accuracy.broadcaster.average_miss.toFixed(1));
  const facts = await page.getByTestId("scoreboard-facts").locator("li").allTextContents();
  expect(facts).toEqual(final.headlines.scoreboard.facts.map((f: { text: string }) => f.text));
  expect(facts[0]).toBe(state.rounds_used === 1 ? "1 try" : `${state.rounds_used} tries`);   // every proposal counts, rejected ones too
  expect(facts[1]).toBe("0 numbers made up by the AI");
});

test("a line under the card says it is a recorded run, with the day and the model", async ({ page }) => {
  await open(page);
  const run = recorded();
  const [y, m, d] = run.recorded_on.split("-").map(Number);
  const month = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"][m - 1];
  await expect(page.getByTestId("run-origin")).toHaveText(`From a recorded run on ${d} ${month} ${y} with ${run.model_name}. Run it live to see your own.`);
});

for (const c of CASES) {
  test(`the hero shows the server's words for: ${c.name}`, async ({ page }) => {
    const base = finalOf().accuracy;
    const accuracy = { ...base, broadcaster: { ...base.broadcaster, average_miss: c.expected.scoreboard.tv_miss } };
    await serveWithHeadlines(page, c.expected, accuracy);
    await open(page);
    await expect(page.getByTestId("hero-title")).toHaveText(c.expected.hero_h1);
    await expect(page.getByTestId("hero-lead")).toHaveText(c.expected.lead);
    await expect(page.getByTestId("scoreboard-agent")).toHaveText(c.expected.scoreboard.subject_miss.toFixed(1));
    await expect(page.getByTestId("scoreboard-tv")).toHaveText(c.expected.scoreboard.tv_miss.toFixed(1));
    await expect(page.getByTestId("scoreboard-card")).toContainText(c.expected.scoreboard.subject_label);
    expect(await page.getByTestId("scoreboard-facts").locator("li").allTextContents()).toEqual(c.expected.scoreboard.facts.map((f) => f.text));
  });
}

test("the hero's Commentary is closed until Show me everything: the TV's accuracy, the goal and who does what", async ({ page }) => {
  await open(page);
  await expect(page.getByTestId("hero-commentary")).toBeHidden();
  await page.getByTestId("view-switch").click();
  await expect(page.getByTestId("hero-commentary")).toBeVisible();
  const ref = await (await page.request.get("/api/reference")).json();
  await expect(page.getByTestId("tv-miss")).toHaveText(ref.figures.broadcaster.average_miss.toFixed(1));
  await expect(page.getByTestId("nothing-miss")).toHaveText(ref.figures.know_nothing.average_miss.toFixed(1));
  await expect(page.getByTestId("tv-sentence")).toHaveText(ref.hero.panel);
  await expect(page.getByTestId("tv-sentence")).toContainText(`at least ${ref.goal.margin_runs} runs`);
  await expect(page.getByTestId("tv-footnote")).toHaveText(ref.hero.footnote);
  await expect(page.getByTestId("who-does-what")).toContainText("language model chooses the clues");
});

test("when the reference figures fail the Commentary says so and shows no number", async ({ page }) => {
  await page.route("**/api/reference", (route) => route.fulfill({ status: 500, body: "no" }));
  await open(page, "?view=everything");
  await expect(page.getByTestId("hero-unavailable")).toHaveText("The accuracy figures could not be loaded.");
  await expect(page.getByTestId("tv-miss")).toHaveCount(0);
  await expect(page.getByTestId("scoreboard-agent")).toBeVisible();                 // the run's own card is unaffected
});

test("without a recorded run the hero says so, claims no result and points to running it live", async ({ page }) => {
  await page.route("**/recorded-run.json", (route) => route.fulfill({ status: 404, body: "" }));
  await open(page);
  await expect(page.getByTestId("hero-title")).toHaveText("Can an AI agent beat the TV projection?");
  await expect(page.getByTestId("hero-missing")).toContainText("recorded run could not be loaded");
  await expect(page.getByTestId("hero-missing")).toContainText("Run it live");
  await expect(page.getByTestId("scoreboard-agent")).toHaveCount(0);
});

test("the footer carries the credit line and the feedback line", async ({ page }) => {
  await open(page);
  const footer = page.getByTestId("footer-attribution");
  await expect(footer).toContainText("Built by John Fong · Tested by Alesja Tanabe");
  await expect(footer).toContainText("Questions or ideas?");
  await expect(page.getByTestId("link-feedback-footer")).toHaveAttribute("href", "https://github.com/jf8peas/explain-machine-learning-in-cricket-terms-agents/issues");
  await expect(page.getByTestId("link-feedback-footer")).toHaveAttribute("target", "_blank");
  await expect(page.getByTestId("link-feedback-footer")).toHaveAttribute("rel", /noopener/);
});
