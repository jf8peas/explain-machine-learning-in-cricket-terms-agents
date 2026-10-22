// The brute-force search is defined on "How this app was built" (feature 021): one sentence under the graph, visible without opening
// Commentary; the technical name and an honest note in Commentary; the verdict's first mention links to the definition; and a
// "Words we use" list in Commentary, all from the server's glossary.
import { expect, test } from "./fixtures";
import { finishRun } from "./helpers";

const reference = async (page: import("@playwright/test").Page) => (await page.request.get("/api/reference")).json();

test("the one-sentence definition sits under the graph, visible with Commentary closed, and is the server's sentence", async ({ page }) => {
  await page.goto("/under-the-hood.html");
  const def = page.getByTestId("brute-force-def");
  await expect(def).toBeVisible();
  const body = await reference(page);
  await expect(def).toHaveText(body.definitions.brute_force);
  await expect(def).toHaveText(
    "The brute-force search is plain code, no AI: it tries every combination of settings and, inside each, adds clues one at a time, keeping whichever cuts the miss most. It is the yardstick: if the agent can't match it, its reasoning isn't adding anything.");
  await expect(page.getByTestId("commentary-agent")).toBeHidden();
  await expect(def).toHaveAttribute("id", "brute-force");
  const graph = await page.locator("graph-replay").boundingBox();
  const sentence = await def.boundingBox();
  expect(sentence!.y).toBeGreaterThanOrEqual(graph!.y + graph!.height - 2);          // directly under the graph
});

test("Commentary gives the technical name and says 'brute-force' refers to the settings, not every set of clues", async ({ page }) => {
  await page.goto("/under-the-hood.html?view=everything");
  const panel = page.getByTestId("brute-force-commentary");
  await expect(panel).toBeVisible();
  await expect(panel).toContainText("grid search over 24 combinations of three hyperparameters");
  await expect(panel).toContainText("which innings, how many seasons, how much recent seasons count");
  await expect(panel).toContainText("greedy forward selection of features in each cell");
  await expect(panel).toContainText("2^19, about 524,000");
  await expect(panel).toContainText("refers to the settings");
});

test("the verdict's first mention of the brute-force search links to the definition, one click away", async ({ page }) => {
  await page.goto("/?interval=40");
  await finishRun(page);
  const link = page.locator("#verdict a[data-testid=yardstick-link]").first();
  await expect(link).toHaveText(/brute-force search/i);
  await expect(link).toHaveAttribute("href", "/under-the-hood.html#brute-force");
  await link.click();
  await expect(page).toHaveURL(/under-the-hood\.html#brute-force$/);
  await expect(page.getByTestId("brute-force-def")).toBeInViewport();
  await expect(page.getByTestId("brute-force-def")).toBeFocused();
});

test("only the first mention in the verdict is a link", async ({ page }) => {
  await page.goto("/?interval=40");
  await finishRun(page);
  await expect(page.locator("#verdict a[data-testid=yardstick-link]")).toHaveCount(1);
});

test("Words we use lists every term, with its technical term and meaning, in the server's order", async ({ page }) => {
  await page.goto("/under-the-hood.html?view=everything");
  const body = await reference(page);
  await page.getByTestId("words-we-use").locator("summary").click();
  const rows = page.getByTestId("word-row");
  await expect(rows).toHaveCount(10);
  const plains = await rows.locator("dt").allTextContents();
  expect(plains).toEqual(body.terms.map((t: { plain: string; alt_plain: string | null }) => t.alt_plain ? `${t.plain} / ${t.alt_plain}` : t.plain));
  for (const [i, t] of body.terms.entries()) {
    await expect(rows.nth(i).locator("dd")).toContainText(t.technical);
    await expect(rows.nth(i).locator("dd")).toContainText(t.meaning);
  }
});

test("Words we use is Commentary: closed in the simple view", async ({ page }) => {
  await page.goto("/under-the-hood.html");
  await expect(page.getByTestId("words-we-use")).toBeHidden();
});
