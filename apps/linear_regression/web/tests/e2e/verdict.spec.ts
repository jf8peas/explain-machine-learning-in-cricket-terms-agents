// The verdict (feature 020): the headline judges the agent's own model against the goal; four bars show each method's average miss
// on the season it never saw; the pick (the winner on the check seasons) and its goal verdict are only in Commentary.
import { readFileSync } from "node:fs";
import { expect, test, type Page } from "./fixtures";

const recorded = () => JSON.parse(readFileSync("tests/fixtures/recorded-run.fake.json", "utf8"));
const finalStep = (run = recorded()) => run.events.find((e: { node: string }) => e.node === "final_test");
const stateOf = (run = recorded()) => Object.assign({}, ...run.events.map((e: { changes: object }) => e.changes));
const final = () => finalStep().changes.final;

async function open(page: Page, query = "") {
  await page.goto(`/${query}`);
  await expect(page.getByTestId("verdict-title")).toBeVisible();
}

test("the headline and the agent-against-search sentence are the server's words", async ({ page }) => {
  await open(page);
  await expect(page.locator("#verdict .kicker").first()).toHaveText("THE VERDICT");
  await expect(page.getByTestId("verdict-title")).toHaveText(final().headlines.verdict_h2);
  await expect(page.getByTestId("verdict-vs-search")).toHaveText(final().headlines.vs_search);
});

test("four bars in the design's order, each the displayed average miss on the test season, shorter is better", async ({ page }) => {
  await open(page);
  const names = await page.getByTestId("verdict-bar").locator(".vname").allTextContents();
  expect(names).toEqual(["AI agent", "Brute-force search", "TV projection", "Average-total guess"]);
  const acc = final().accuracy;
  const values = await page.getByTestId("verdict-value").allTextContents();
  expect(values).toEqual([acc.llm, acc.forward, acc.broadcaster, acc.know_nothing].map((a: { average_miss: number }) => a.average_miss.toFixed(1)));
  const widths = await page.locator(".vbar").evaluateAll((els) => els.map((e) => (e as HTMLElement).getBoundingClientRect().width));
  const misses = [acc.llm, acc.forward, acc.broadcaster, acc.know_nothing].map((a: { average_miss: number }) => a.average_miss);
  const longest = Math.max(...misses);
  widths.forEach((w, i) => expect(w / widths[misses.indexOf(longest)]).toBeCloseTo(misses[i] / longest, 1));      // drawn to scale, from zero
  await expect(page.getByTestId("verdict-caption")).toHaveText(
    `Average runs off the real total, ${acc.broadcaster.n} innings from ${stateOf().split.test_year}. Shorter is better.`);
});

test("with no language model the agent's bar says not run and the other three still show", async ({ page }) => {
  const run = recorded();
  const step = finalStep(run);
  const { llm: _gone, ...accuracy } = step.changes.final.accuracy;
  step.changes.final = {
    ...step.changes.final, accuracy,
    headlines: { ...step.changes.final.headlines, case: "no_llm", vs_search: null,
      verdict_h2: "On a season it never saw, the plain search missed by 17.8 runs; the TV missed by 21.4 runs." },
  };
  await page.route("**/recorded-run.json", (route) => route.fulfill({ json: run }));
  await open(page);
  await expect(page.getByTestId("verdict-bar").first()).toContainText("not run");
  await expect(page.getByTestId("verdict-bar").first().locator(".vbar")).toBeHidden();
  const values = await page.getByTestId("verdict-value").allTextContents();
  expect(values.slice(1)).toEqual([accuracy.forward, accuracy.broadcaster, accuracy.know_nothing].map((a: { average_miss: number }) => a.average_miss.toFixed(1)));
  await expect(page.getByTestId("verdict-vs-search")).toHaveCount(0);
});

test("the rule of thumb is a card that says it comes from the best model on the check seasons", async ({ page }) => {
  await open(page);
  const card = page.getByTestId("rule-card");
  await expect(card).toBeVisible();
  const block = stateOf().explanation.blocks.find((b: { id: string }) => b.id === "rule_of_thumb");
  await expect(card).toContainText(block.sentences[0].slice(0, 40));
  await expect(page.getByTestId("rule-from")).toHaveText("from the best model on the check seasons");
});

test("Why you can trust this score is closed, opens with its own toggle or with the switch, and gives three reasons with the years", async ({ page }) => {
  await open(page);
  const toggle = page.getByTestId("trust-toggle");
  await expect(toggle).toHaveText(/^Why you can trust this score/);
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await expect(page.getByTestId("trust-panel")).toBeHidden();
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  const split = stateOf().split;
  const checks = split.checks.map((c: { year: number }) => c.year);
  const items = await page.getByTestId("trust-panel").locator("li").allTextContents();
  expect(items).toEqual([
    `The agent chose using the check seasons (${checks[0]}–${checks[checks.length - 1]}) only.`,
    `The test season (${split.test_year}) stayed locked and was used once.`,
    "The brute-force search ran alongside as a yardstick.",
  ]);
  await toggle.click();
  await page.getByTestId("view-switch").click();
  await expect(page.getByTestId("trust-panel")).toBeVisible();
});

test("Commentary holds three cards, and the pick with its goal verdict appears only in the first", async ({ page }) => {
  await open(page);
  await expect(page.getByTestId("verdict-commentary")).toBeHidden();
  await expect(page.getByText(/our pick/i).first()).toBeHidden();                       // nowhere on the Scoreboard
  await page.getByTestId("view-switch").click();
  const titles = await page.locator("#verdict-commentary .vcard h3").allTextContents();
  expect(titles).toEqual(["Check seasons vs the final test", "How often is it close?", "What moves the final total"]);
  await expect(page.getByTestId("vcard-seasons").getByTestId("pick")).toContainText("Our pick: ");
  await expect(page.getByTestId("vcard-seasons").getByTestId("pick-verdict")).toHaveText(final().verdict_sentence);
  await expect(page.getByTestId("vcard-seasons").getByText(/our pick/i)).toHaveCount(2);       // the label and the verdict sentence, both in the first card
  expect(await page.getByText(/our pick/i).count()).toBe(2);
  await expect(page.getByTestId("vcard-seasons").getByTestId("exam-card")).toHaveCount(2);        // both methods' scores on each exam
  await expect(page.getByTestId("vcard-close").getByTestId("close-row")).toHaveCount(4);
  await expect(page.getByTestId("vcard-drivers").getByTestId("drivers-chart")).toBeVisible();
  await expect(page.getByTestId("drivers-label")).toContainText("from the best model on the check seasons");
});

test("the hero never shows the pick even when the search won on the check seasons", async ({ page }) => {
  const run = recorded();
  const step = finalStep(run);
  step.changes.final = { ...step.changes.final, winner: "forward", winner_name: "forward selection" };
  await page.route("**/recorded-run.json", (route) => route.fulfill({ json: run }));
  await open(page, "?view=everything");
  await expect(page.getByTestId("scoreboard-card")).toContainText("AI agent");
  await expect(page.getByTestId("scoreboard-agent")).toHaveText(final().accuracy.llm.average_miss.toFixed(1));
  await expect(page.getByTestId("vcard-seasons").getByTestId("pick")).toContainText("brute-force search's model");
  await expect(page.getByTestId("hero")).not.toContainText("Our pick");
});

test("the verdict waits for a result when there is no recording", async ({ page }) => {
  await page.route("**/recorded-run.json", (route) => route.fulfill({ status: 404, body: "" }));
  await page.goto("/");
  await expect(page.getByTestId("verdict-waiting")).toBeVisible();
});

test.describe("on a phone", () => {
  test.use({ viewport: { width: 390, height: 844 } });
  test("the bars stack their names above their lengths with no sideways scroll", async ({ page }) => {
    await open(page, "?view=everything");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    const row = page.getByTestId("verdict-bar").first();
    const name = (await row.locator(".vname").boundingBox())!, track = (await row.locator(".vtrack").boundingBox())!;
    expect(track.y).toBeGreaterThan(name.y + name.height - 1);
  });
});
