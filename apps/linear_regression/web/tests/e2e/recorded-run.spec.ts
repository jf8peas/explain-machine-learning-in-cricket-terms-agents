// Everything renders from the recorded run (feature 020, FR-022, SC-005, SC-011): with the run route unavailable, every section and every
// Scorebook panel still shows, and the only calls the page makes are the existing read-only ones. Watching, pausing and watching again
// start no run and use none of the run limits.
import { expect, test, type Page } from "./fixtures";
import { toPlayer } from "./helpers";

const READ_ONLY = new Set(["/api/structure", "/api/reference", "/api/catalogue", "/api/models", "/api/data", "/recorded-run.json", "/favicon.svg"]);

/** Every path the page asks the server for, other than its own scripts, styles and source files. */
function watchRequests(page: Page) {
  const paths = new Set<string>();
  page.on("request", (r) => {
    const url = new URL(r.url());
    if (url.origin !== "http://127.0.0.1:5173") return;
    if (/^\/(src|node_modules|@vite|@id|@fs)\b|\.(ts|css|js|map)$/.test(url.pathname) || url.pathname === "/") return;
    paths.add(url.pathname);
  });
  return paths;
}

test("with the run route unavailable, every section and every Scorebook panel still renders from the recorded file", async ({ page }) => {
  const asked = watchRequests(page);
  await page.route("**/api/run*", (route) => route.abort());
  await page.goto("/?interval=40&view=everything");
  for (const id of ["scoreboard-agent", "problem-title", "verdict-title", "tryit-model-label"]) await expect(page.getByTestId(id)).toBeVisible();
  await expect(page.getByTestId("run-origin")).toContainText("From a recorded run");
  await toPlayer(page);
  await expect(page.getByTestId("watch-button")).toHaveText("▶ Watch again", { timeout: 45_000 });
  await expect(page.getByTestId("round-item")).not.toHaveCount(0);
  await page.getByTestId("scorebook-card-models").click();
  await expect(page.getByTestId("attempt-row")).not.toHaveCount(0);
  await expect(page.getByTestId("grid-table")).toHaveCount(2);
  await page.getByTestId("scorebook-card-data").click();
  await expect(page.getByTestId("data-count")).toContainText("Showing", { timeout: 20_000 });
  await page.getByTestId("scorebook-card-graph").click();
  await expect(page.getByTestId("graph-panel")).toBeVisible();
  for (const path of asked) expect(READ_ONLY, `unexpected call to ${path}`).toContain(path);
  expect(asked.has("/api/run")).toBe(false);
});

test("the figures on the hero and the verdict are the recording's, even with the whole API except the read-only routes down", async ({ page }) => {
  await page.route(/\/api\/(run|data)/, (route) => route.abort());
  await page.goto("/");
  const run = await (await page.request.get("/recorded-run.json")).json();
  const final = run.events.find((e: { node: string }) => e.node === "final_test").changes.final;
  await expect(page.getByTestId("scoreboard-agent")).toHaveText(final.accuracy.llm.average_miss.toFixed(1));
  await expect(page.getByTestId("verdict-title")).toHaveText(final.headlines.verdict_h2);
  await page.getByTestId("scorebook-card-models").click();
  await expect(page.getByTestId("scorebook-models")).toBeVisible();                       // the models panel needs no /api/data
});

test("watching, pausing and watching again start no run and use none of the run allowance", async ({ page }) => {
  let runs = 0;
  page.on("request", (r) => { if (new URL(r.url()).pathname === "/api/run") runs++; });
  await page.goto("/?interval=40");
  await toPlayer(page);
  await expect(page.getByTestId("watch-button")).toHaveText("❚❚ Pause");
  await page.getByTestId("watch-button").click();
  await page.getByTestId("watch-button").click();
  await expect(page.getByTestId("watch-button")).toHaveText("▶ Watch again", { timeout: 45_000 });
  await page.getByTestId("watch-button").click();
  await expect(page.getByTestId("watch-button")).toHaveText("▶ Watch again", { timeout: 45_000 });
  expect(runs).toBe(0);
  // many visitors replaying it: the same visitor can still start all their live runs
  for (let i = 0; i < 5; i++) expect((await page.request.get("/api/run")).status()).toBe(200);
});

test("the recorded file the page plays is the one in the repository's web/public folder, made against the data now in the repository", async ({ request }) => {
  const run = await (await request.get("/recorded-run.json")).json();
  expect(run.fingerprint).toMatch(/^sha256:[0-9a-f]{64}$/);
  expect(typeof run.recorded_on).toBe("string");
  expect(run.model_name.length).toBeGreaterThan(0);
  expect(run.events.length).toBe(run.done.steps);
  expect(JSON.stringify(run)).not.toMatch(/fake\//);                                    // never a model id
});
