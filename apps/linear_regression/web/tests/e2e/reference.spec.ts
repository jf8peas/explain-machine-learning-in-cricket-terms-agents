import { expect, test, type Page } from "./fixtures";
import { open, openTab, playToEnd } from "./helpers";

// How good the references are: the hero before any run (its own tests are in hero.spec.ts), and the final results after one.
// Every figure on the page is compared with what the server sent, never with a number typed in here.

interface Figures { n: number; average_miss: number; within_10: number; within_20: number; miss_percent: number; bias: number }
interface Reference {
  goal: { reference: string; margin_runs: number; text: string; lead: string };
  methods: { id: string; name: string; note: string; marker: string }[];
  training: { first_year: number; last_year: number; innings: number } | null;
  figures: { know_nothing: Figures; broadcaster: Figures } | null;
  gap: { average_miss_runs: number; average_miss_percent: number; within_10_points: number } | null;
  finding: string | null;
  sentences: { headline: string; gap: string; finding: string; bias: string } | null;
  words: Record<string, { bias: string; bias_short: string }> | null;
  meter: Meter | null;
  hero: { caption: string | null; panel: string; panel_emphasis: string[]; footnote: string; chart_text: string | null } | null;
  message: string | null;
}
interface Mark { id: string; label: string; value: number }
interface Meter { scale: { min: number; max: number }; marks: Mark[]; caption: string; text: string }

const reference = async (page: Page) => (await (await page.request.get("/api/reference")).json()) as Reference;

/** Answer /api/reference with the real response changed by `change`. */
async function serveReference(page: Page, change: (body: Reference) => Reference) {
  const real = await reference(page);
  await page.route("**/api/reference", (route) => route.fulfill({ json: change(structuredClone(real)) }));
}

// The comparison box, the accuracy table and the predicted-versus-actual chart were replaced by the three sections of
// The final test tab (feature 015); their tests are in final.spec.ts. What stays here is the goal's wording.

test("the verdict reads in the goal's words, with the runs, and says whether the goal was reached", async ({ page }) => {
  await open(page, 40);
  await playToEnd(page);
  await openTab(page, "final-test");
  const ref = await reference(page);
  const expl = JSON.parse((await page.locator('[data-key="explanation"] pre').textContent())!) as { facts: Record<string, { display: string }> };
  const v = page.getByTestId("verdict");
  await expect(v).toContainText(/Goal (reached|missed)\./);
  await expect(v).toContainText(`at least ${ref.goal.margin_runs} runs`);
  await expect(v).toContainText(`${expl.facts.beat_tv_by.display} runs`);
  await expect(page.getByTestId("verdict-shape")).toBeVisible();                          // a shape as well as words
});

test("near the final results the page says no method can be perfect, in plain words", async ({ page }) => {
  await open(page, 40);
  await playToEnd(page);
  await openTab(page, "final-test");
  const note = page.getByTestId("close-note");
  await expect(note).toBeVisible();
  const text = (await note.textContent()) ?? "";
  expect(text).toContain("No method can be perfect from the halfway mark");
  expect(text).toMatch(/collapses/);
  const after = await page.evaluate(() => {
    const bars = document.querySelector('[data-testid="close"]')!;
    const n = document.querySelector('[data-testid="close-note"]')!;
    return !!(bars.compareDocumentPosition(n) & Node.DOCUMENT_POSITION_FOLLOWING);
  });
  expect(after).toBe(true);                                                   // the closing line of section 2, after its bars
});


// ---------------- US5: one goal, in one wording ----------------

test("the goal's margin in the hero's panel is the server's, and the verdict names the same margin", async ({ page }) => {
  await open(page, 40);
  const ref = await reference(page);
  await expect(page.getByTestId("tv-sentence")).toContainText(`at least ${ref.goal.margin_runs} runs`);
  await playToEnd(page);
  await expect(page.getByTestId("tv-sentence")).toContainText(`at least ${ref.goal.margin_runs} runs`);   // still the same after a run
  await openTab(page, "final-test");
  await expect(page.getByTestId("verdict")).toContainText(`at least ${ref.goal.margin_runs} runs`);
  await expect(page.getByTestId("verdict-shape")).toBeVisible();
});

test("the page itself holds no hand-written goal", async ({ page }) => {
  await page.route("**/api/reference", (route) => route.abort());
  await page.goto("/");
  await expect(page.getByTestId("hero-unavailable")).toBeVisible();
  await expect(page.getByTestId("tv-sentence")).toBeHidden();                                  // nothing is shown that the server did not send
  expect((await page.locator("main").first().textContent()) ?? "").not.toMatch(/at least 3 runs/);
});


// ---------------- 008: the test population ----------------

test("the hero's footnote says what the agent is tested on and how many innings the figures rest on, as the server sent it", async ({ page }) => {
  await page.goto("/");
  const ref = await reference(page);
  const footnote = page.getByTestId("tv-footnote");
  await expect(footnote).toBeVisible();
  await expect(footnote).toHaveText(ref.hero!.footnote);
  await expect(footnote).toContainText("IPL");
  await expect(footnote).toContainText("BBL");
  await expect(footnote).toContainText("full-member internationals");
});

test("the reference figures are on the test population before the first check year and equal the server's", async ({ page }) => {
  await page.goto("/");
  const ref = await reference(page);
  await expect(page.getByTestId("tv-footnote")).toBeVisible();
  expect(ref.training!.innings).toBeLessThan(4000);                      // fewer than all the early innings (about 4,000)
  await expect(page.getByTestId("tv-footnote")).toContainText(ref.training!.innings.toLocaleString("en-US"));
  await expect(page.getByTestId("tv-footnote")).toContainText(`${ref.training!.first_year} to ${ref.training!.last_year}`);
  await expect(page.getByTestId("tv-miss")).toHaveText(ref.figures!.broadcaster.average_miss.toFixed(1));
  await expect(page.getByTestId("nothing-miss")).toHaveText(ref.figures!.know_nothing.average_miss.toFixed(1));
});
