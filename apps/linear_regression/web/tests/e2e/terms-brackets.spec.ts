// The technical term is shown once, in brackets after the plain term, where a panel explains a method (feature 021, FR-002): in the
// Scorebook's "Every idea tried" panel, across its two sections, and in the verdict's "check seasons vs the final test" card.
import { expect, test } from "./fixtures";
import { finishRun } from "./helpers";

const occurrences = (text: string, needle: string) => text.split(needle).length - 1;

test("the Scorebook's model panel brackets each technical term once", async ({ page }) => {
  await page.goto("/?interval=40");
  await finishRun(page);
  await page.getByTestId("scorebook-card-models").click();
  const text = await page.getByTestId("scorebook-panel").innerText();
  const body = await (await page.request.get("/api/reference")).json();
  const technical = Object.fromEntries(body.terms.map((t: { id: string; technical: string }) => [t.id, t.technical]));
  for (const id of ["brute_force", "settings", "idea", "agent", "check_seasons"]) {
    expect(occurrences(text, `(${technical[id]})`), id).toBe(1);
  }
  expect(text).toMatch(/brute-force search \(grid search with forward selection\) can't reason/);
});

test("the verdict card brackets the technical names of the two exams once", async ({ page }) => {
  await page.goto("/?interval=40&view=everything");
  await finishRun(page);
  const text = await page.getByTestId("vcard-seasons").innerText();
  const body = await (await page.request.get("/api/reference")).json();
  const technical = Object.fromEntries(body.terms.map((t: { id: string; technical: string }) => [t.id, t.technical]));
  expect(occurrences(text, `(${technical.check_seasons})`)).toBe(1);
  expect(occurrences(text, `(${technical.test_season})`)).toBe(1);
});
