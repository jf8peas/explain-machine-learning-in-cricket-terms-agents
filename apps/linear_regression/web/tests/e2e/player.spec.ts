// The player (feature 022): choose the AI, press Play, a real live run, and what the controls and the status line say at each stage.
// Replaces the live-run panel's specs. The server runs the scripted fake models (fake/steady is the default).
import { expect, test, type Page } from "./fixtures";
import { countRunRequests, finishRun } from "./helpers";

const select = (page: Page) => page.getByTestId("model-select");
const play = (page: Page) => page.getByTestId("play-button");
const status = (page: Page) => page.getByTestId("player-status");

async function open(page: Page, query = "?interval=40") {
  await page.goto(`/${query}`);
  await expect(page.getByTestId("hero-title")).toBeVisible();
}

test("before a run: the watch heading, a labelled select, Play at least 48 px tall, the run line and the ready status", async ({ page }) => {
  await open(page);
  await expect(page.locator("#watch-title")).toHaveText("Choose the AI, press play, and watch it work.");
  await expect(page.getByRole("combobox", { name: "Choose the AI" })).toHaveCount(1);
  await expect(play(page)).toHaveText("▶ Play");
  expect((await play(page).boundingBox())!.height).toBeGreaterThanOrEqual(48);
  await expect(page.getByTestId("run-line")).toHaveText("A live run · usually under a minute · runs can differ each time");
  await expect(status(page)).toHaveText("Ready. Choose the AI and press play.");
  await expect(page.getByTestId("feed-empty")).toHaveText("The agent's ideas appear here, one round at a time, once you press play.");
  await expect(page.getByTestId("watch-again")).toBeHidden();
  await expect(page.getByTestId("live-toggle")).toHaveCount(0);                       // the old toggle and panel are gone
  await expect(page.getByTestId("live-panel")).toHaveCount(0);
});

test("the select is filled from the server's list, names and notes only, the default first, marked and described", async ({ page }) => {
  await open(page);
  const list = await (await page.request.get("/api/models")).json();
  const options = await select(page).locator("option").allTextContents();
  const names = list.models.map((m: { name: string }) => m.name);
  const defaultName = list.models.find((m: { default: boolean }) => m.default).name;
  expect(options[0]).toBe(`${defaultName} (default)`);
  expect(options.map((o) => o.replace(" (default)", "")).sort()).toEqual([...names].sort());
  await expect(select(page)).toHaveValue(list.models.find((m: { default: boolean }) => m.default).choice);
  await expect(select(page)).toHaveAttribute("aria-describedby", "model-note");
  await expect(page.getByTestId("model-note")).toHaveText(list.models.find((m: { default: boolean }) => m.default).note);
  expect(JSON.stringify(list)).not.toContain("fake/");                                // never a model id
});

test("two actions get a live run started with the default model", async ({ page }) => {
  const runs = countRunRequests(page);
  await open(page);
  await page.getByTestId("start-experiment").click();                                   // 1
  await expect(select(page)).toBeFocused();
  await play(page).click();                                                             // 2
  await expect(status(page)).toHaveText(/^Live with /);
  expect(runs.count()).toBe(1);
});

test("while the run goes the select is disabled and Play reads Running…; when it ends the controls come back", async ({ page }) => {
  await open(page);
  await select(page).selectOption({ label: "Thorough" });
  await play(page).click();
  await expect(play(page)).toHaveText("Running…");
  await expect(play(page)).toBeDisabled();
  await expect(select(page)).toBeDisabled();
  await expect(status(page)).toHaveText(/^Live with .* · /);
  await expect(status(page)).toHaveText(/^Finished with .* · \d+ tries? · best \d+\.\d on the check seasons$/, { timeout: 90_000 });
  await expect(play(page)).toHaveText("▶ Run again");
  await expect(play(page)).toBeEnabled();
  await expect(select(page)).toBeEnabled();
  await expect(page.getByTestId("watch-again")).toBeVisible();
});

test("pressing Play twice quickly starts one run", async ({ page }) => {
  const runs = countRunRequests(page);
  await open(page);
  await play(page).dblclick();
  await expect(status(page)).toHaveText(/^Finished with/, { timeout: 90_000 });
  expect(runs.count()).toBe(1);
});

test("Watch it again replays the finished run with no /api/run request, and Run again starts a new one", async ({ page }) => {
  await open(page);
  await finishRun(page);
  const runs = countRunRequests(page);
  await page.getByTestId("watch-again").click();
  await expect(page.getByTestId("right-now-step")).not.toHaveText("—");
  await expect.poll(() => page.locator('graph-replay [data-node][data-state="running"]').count(), { timeout: 30_000 }).toBeLessThanOrEqual(1);
  await expect(page.getByTestId("round-item").first()).toBeVisible();
  expect(runs.count()).toBe(0);
  await page.getByTestId("play-button").click();
  await expect(status(page)).toHaveText(/^Live with/);
  expect(runs.count()).toBe(1);
  await expect(status(page)).toHaveText(/^Finished with/, { timeout: 90_000 });
});

test("when the list of AIs cannot be loaded the select offers the default model and a run still starts with no model chosen", async ({ page }) => {
  await page.route("**/api/models", (route) => route.fulfill({ status: 500, body: "" }));
  const urls: string[] = [];
  page.on("request", (r) => { if (new URL(r.url()).pathname === "/api/run") urls.push(r.url()); });
  await open(page);
  await expect(select(page).locator("option")).toHaveText(["Default model"]);
  await expect(page.getByTestId("model-note")).toContainText("could not be loaded");
  await play(page).click();
  await expect(status(page)).toHaveText(/^Finished with/, { timeout: 90_000 });
  expect(urls).toHaveLength(1);
  expect(urls[0]).not.toContain("model=");
});

test("the status line is not a live region; a hidden polite region speaks the phases, not every node", async ({ page }) => {
  await open(page);
  await expect(status(page)).not.toHaveAttribute("aria-live", /.+/);
  const spoken = page.getByTestId("player-announce");
  await expect(spoken).toHaveAttribute("aria-live", "polite");
  const heard: string[] = [];
  await page.exposeFunction("heard", (t: string) => heard.push(t));
  await page.evaluate(() => {
    const el = document.querySelector("[data-testid=player-announce]")!;
    new MutationObserver(() => (window as unknown as { heard(t: string): void }).heard(el.textContent ?? "")).observe(el, { childList: true, characterData: true, subtree: true });
  });
  await finishRun(page);
  expect(heard.length).toBeGreaterThan(1);
  expect(heard.length).toBeLessThan(16);                                               // the phases and the switches between the AI and code, not each of the 24 nodes
  expect(heard[heard.length - 1]).toMatch(/^The run has finished with /);
});
