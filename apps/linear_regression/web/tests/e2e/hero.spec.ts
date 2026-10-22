// The hero (feature 022): the question and the goal, not a result. The goal card's figures are the server's; after a run finishes the
// result strip at its foot gives the case in the server's words; the Commentary about the broadcaster is closed until asked for. (The idle page
// itself is in idle.spec.ts.)
import { readFileSync } from "node:fs";
import { expect, test } from "./fixtures";
import type { Page } from "./fixtures";
import { finishRun, streamOf } from "./helpers";

const fixture = () => JSON.parse(readFileSync("tests/fixtures/fake-run.json", "utf8"));
const CASES: { name: string; expected: { case: string; hero_h1: string; verdict_h2: string; scoreboard: { tv_miss: number }; result_strip: { label: string; text: string } } }[] =
  JSON.parse(readFileSync("tests/fixtures/headline_cases.json", "utf8"));

async function open(page: Page, query = "") {
  await page.goto(`/${query}`);
  await expect(page.getByTestId("hero-title")).toBeVisible();
}

/** Serve a run whose final test carries another headline set, to see how the hero and the verdict show each case. */
async function serveWithHeadlines(page: Page, headlines: unknown, tvMiss: number) {
  const run = fixture();
  const step = run.events.find((e: { node: string }) => e.node === "final_test");
  const acc = step.changes.final.accuracy;
  step.changes.final = { ...step.changes.final, headlines, accuracy: { ...acc, broadcaster: { ...acc.broadcaster, average_miss: tvMiss } } };
  await page.route("**/api/run*", (route) =>
    route.fulfill({ status: 200, headers: { "content-type": "text/event-stream" }, body: streamOf(run.events) }));
}

test("after a run finishes, the strip at the foot of the goal card gives the result in the server's words and links to the verdict", async ({ page }) => {
  await open(page, "?interval=40");
  await expect(page.getByTestId("result-strip")).toHaveCount(0);
  await finishRun(page);
  const strip = page.getByTestId("result-strip");
  await expect(strip).toBeVisible();
  const state = Object.assign({}, ...fixture().events.map((e: { changes: object }) => e.changes));
  const expected = state.final.headlines.result_strip;
  await expect(strip).toContainText(`Result: ${expected.label}.`);
  await expect(strip).toContainText(expected.text);
  await expect(page.getByTestId("result-link")).toHaveAttribute("href", "#verdict");
  await page.getByTestId("result-link").click();
  await expect(page.getByTestId("verdict-title")).toBeInViewport();
});

for (const c of CASES) {
  test(`the strip and the verdict show the server's words for: ${c.name}`, async ({ page }) => {
    await serveWithHeadlines(page, c.expected, c.expected.scoreboard.tv_miss);
    await open(page, "?interval=40");
    await finishRun(page);
    await expect(page.getByTestId("result-strip")).toContainText(`Result: ${c.expected.result_strip.label}.`);
    await expect(page.getByTestId("result-strip")).toContainText(c.expected.result_strip.text);
    await expect(page.getByTestId("verdict-title")).toHaveText(c.expected.verdict_h2);
    await expect(page.getByTestId("hero-title")).toHaveText("Can an AI agent build a regression model that beats the broadcaster's projected score?");     // the question never changes
  });
}

test("the hero's Commentary is closed until Show me everything: the broadcaster's accuracy, the unseen season and who does what", async ({ page }) => {
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
  await expect(page.getByTestId("why-unseen")).toContainText(`${ref.test.year} stays locked until the agent has picked its model`);
  await expect(page.getByTestId("who-does-what")).toContainText("AI agent chooses the clues");
});

test("when the reference figures fail the page still asks the question, says so, and shows no number", async ({ page }) => {
  await page.route("**/api/reference", (route) => route.fulfill({ status: 500, body: "no" }));
  await open(page, "?view=everything");
  await expect(page.getByTestId("hero-title")).toHaveText("Can an agent build a regression model that beats the projected score?");     // no server words yet: the neutral question, never a placeholder
  await expect(page.getByTestId("hero-unavailable")).toHaveText("The accuracy figures could not be loaded.");
  await expect(page.getByTestId("tv-miss")).toHaveCount(0);
  await expect(page.getByTestId("goal-tv-figure")).toHaveCount(0);
  await expect(page.getByTestId("start-experiment")).toBeVisible();
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
