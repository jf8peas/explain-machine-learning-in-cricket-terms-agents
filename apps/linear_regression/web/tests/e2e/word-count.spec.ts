// The size of the pages (feature 020, FR-015, SC-002): few words in the simple view, a bounded number with everything open. The text
// counted is what a visitor can see inside <main> on a 390 px screen (LinkedIn's in-app browser), with the recorded run played to its
// end, the Scorebook closed, and the agent's quoted reasoning left out (it is the agent's own words, whatever their length).
import { expect, test, type Page } from "./fixtures";
import { finishRun, visibleMainText, wordCount } from "./helpers";

test.use({ viewport: { width: 390, height: 844 } });

const MAIN = { simple: 500, everything: 1200 };
const BUILT = { simple: 500, everything: 1200 };

async function mainText(page: Page, everything: boolean) {
  await page.goto(`/?interval=40${everything ? "&view=everything" : ""}`);
  await finishRun(page);
  return visibleMainText(page);
}
async function builtText(page: Page, everything: boolean) {
  await page.goto(`/under-the-hood.html${everything ? "?view=everything" : ""}`);
  await expect(page.getByTestId("fact-steps")).not.toHaveText("not available right now");
  await expect(page.locator("graph-replay [data-node]").first()).toBeVisible();
  return visibleMainText(page);
}

test("the main page in the simple view has at most 500 words", async ({ page }) => {
  const words = wordCount(await mainText(page, false));
  console.info(`WORDS main simple ${words}`);
  expect(words).toBeGreaterThan(200);                       // it is measuring the page, not an empty one
  expect(words).toBeLessThanOrEqual(MAIN.simple);
});

test("the main page with Show me everything has at most 1,200 words, the Scorebook closed", async ({ page }) => {
  const simple = wordCount(await mainText(page, false));
  const words = wordCount(await mainText(page, true));
  console.info(`WORDS main everything ${words}`);
  await expect(page.getByTestId("scorebook-panel")).toBeHidden();
  expect(words).toBeGreaterThan(simple);
  expect(words).toBeLessThanOrEqual(MAIN.everything);
});

test("How this app was built in the simple view has at most 500 words", async ({ page }) => {
  const words = wordCount(await builtText(page, false));
  console.info(`WORDS built simple ${words}`);
  expect(words).toBeGreaterThan(200);
  expect(words).toBeLessThanOrEqual(BUILT.simple);
});

test("How this app was built with Show me everything has at most 1,200 words", async ({ page }) => {
  const simple = wordCount(await builtText(page, false));
  const words = wordCount(await builtText(page, true));
  console.info(`WORDS built everything ${words}`);
  expect(words).toBeGreaterThan(simple);
  expect(words).toBeLessThanOrEqual(BUILT.everything);
});

test("the agent's quoted reasoning is left out of the count, and nothing else is", async ({ page }) => {
  await page.goto("/?interval=40");
  await finishRun(page);
  const text = await visibleMainText(page);
  const reasoning = await page.getByTestId("model-reason").first().textContent();
  expect(reasoning!.length).toBeGreaterThan(20);
  expect(text).not.toContain(reasoning!.trim().slice(0, 30));
  expect(text).toContain("Each round, the agent proposes an idea.");
});

test("the simple view uses the plain words, and keeps the technical terms for Commentary and the Scorebook", async ({ page }) => {
  for (const text of [await mainText(page, false), await builtText(page, false)]) {
    for (const term of [/\bfeatures?\b/i, /\bvalidation\b/i, /candidate model/i, /forward selection/i, /know-nothing/i, /cross-validation/i]) {
      expect(text, `${term} is a technical term`).not.toMatch(term);
    }
  }
  const plain = await mainText(page, false);
  expect(plain).toMatch(/check seasons/);
  expect(plain).toMatch(/Brute-force search/);
  expect(plain).toMatch(/Average-total guess/);
});

test("the words counted are the visible ones: a closed select counts as its choice, and closed details only their summary", async ({ page }) => {
  await page.goto("/?view=everything&interval=40");
  await finishRun(page);
  const text = await visibleMainText(page);
  expect(text).not.toContain("Sluggish");                    // an option of the closed model select
  expect(text).toContain("Fast (default)");                  // the one it shows
  expect(text).not.toContain("load_data checks");            // nothing hidden
  expect(text).toContain("Show every value");                // a closed details: its summary
  expect(text).not.toContain("average_miss");                // and not the raw state inside it
});
