// The live-run panel (feature 020): "Run it live with your choice of AI" opens a panel under the toolbar with a labelled model
// select, the note that runs can differ, the limits from the server's settings and "Start live run". The hero and the verdict keep
// the recorded figures until the live run's final test arrives; a refusal or a failure leaves the recorded run in place.
import { readFileSync } from "node:fs";
import { expect, test } from "./fixtures";
import type { Page } from "./fixtures";

const recorded = () => JSON.parse(readFileSync("tests/fixtures/recorded-run.fake.json", "utf8"));
const sse = (event: string, data: unknown) => `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;

async function open(page: Page, query = "?interval=120") {
  await page.goto(`/${query}`);
  await expect(page.getByTestId("hero-title")).toBeVisible();
}
const panel = (page: Page) => page.getByTestId("live-panel");
const openPanel = async (page: Page) => { await page.getByTestId("live-toggle").click(); await expect(panel(page)).toBeVisible(); };

function countRunRequests(page: Page) {
  let n = 0;
  page.on("request", (r) => { if (new URL(r.url()).pathname === "/api/run") n++; });
  return () => n;
}

test("the panel is closed by default, opens under the toolbar with its toggle, and opens with Show me everything", async ({ page }) => {
  await open(page);
  const toggle = page.getByTestId("live-toggle");
  await expect(toggle).toHaveText("Run it live with your choice of AI");
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await expect(panel(page)).toBeHidden();
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  const t = (await toggle.boundingBox())!, p = (await panel(page).boundingBox())!;
  expect(p.y).toBeGreaterThan(t.y + t.height - 1);                          // under the toolbar
  await toggle.click();
  await expect(panel(page)).toBeHidden();
  await page.getByTestId("view-switch").click();
  await expect(panel(page)).toBeVisible();
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
});

test("the Language model select is labelled, filled from the server's list, default first and marked, with names and notes only", async ({ page }) => {
  await open(page);
  await openPanel(page);
  const list = await (await page.request.get("/api/models")).json();
  const select = page.getByTestId("model-select");
  await expect(select).toBeVisible();
  await expect(page.getByRole("combobox", { name: /^Language model/ })).toHaveCount(1);        // it has a label
  const options = await select.locator("option").allTextContents();
  const names = list.models.map((m: { name: string; default: boolean }) => m.name);
  expect(options[0]).toBe(`${list.models.find((m: { default: boolean }) => m.default).name} (default)`);
  expect([...options].map((o) => o.replace(" (default)", "")).sort()).toEqual([...names].sort());
  expect(options.filter((o) => o.includes("(default)"))).toHaveLength(1);
  expect(await select.inputValue()).toBe(await select.locator("option").first().getAttribute("value"));   // selected first
  const note = page.getByTestId("model-note");
  expect(await select.getAttribute("aria-describedby")).toBe(await note.getAttribute("id"));
  await expect(note).toHaveText(list.models[0].note);
  const other = list.models.find((m: { default: boolean }) => !m.default);
  await select.selectOption({ label: other.name });
  await expect(note).toHaveText(other.note);
  expect(await panel(page).innerText()).not.toMatch(/fake\//);               // never a model id
});

test("the panel says runs can differ, and gives the run length and the hourly limit from the server's settings", async ({ page }) => {
  await open(page);
  await openPanel(page);
  const { run } = await (await page.request.get("/api/models")).json();
  await expect(page.getByTestId("variation-note")).toContainText("runs can differ each time");
  await expect(page.getByTestId("variation-note")).toContainText("Code still checks and scores everything it proposes.");
  await expect(page.getByTestId("run-limits")).toContainText(`${run.deadline_seconds} seconds`);
  await expect(page.getByTestId("run-limits")).toContainText(`${run.per_hour} live runs an hour`);
  await expect(page.getByTestId("live-start")).toHaveText("Start live run");
});

test("a live run keeps the recorded figures until its final test arrives, then the page switches to it", async ({ page }) => {
  const requests = countRunRequests(page);
  await open(page, "?interval=100");
  await openPanel(page);
  const origin = page.getByTestId("run-origin");
  await expect(origin).toContainText("From a recorded run");
  await page.getByTestId("live-start").click();
  await expect(page.getByTestId("live-start")).toBeDisabled();
  await expect(origin).toContainText("From a recorded run");                  // not yet: no final test
  await expect(origin).toHaveText(/^From your live run with Fast\.$/, { timeout: 30_000 });
  await expect(page.getByTestId("run-label")).toHaveText("Your live run · Fast");
  expect(requests()).toBe(1);
  await expect(page.getByTestId("watch-button")).toHaveText("▶ Watch your run again", { timeout: 30_000 });
  await expect(page.getByTestId("live-start")).toBeEnabled();
  await page.getByTestId("watch-button").click();                              // replays the visitor's run, with no new request
  await expect(page.getByTestId("watch-button")).toHaveText("❚❚ Pause");
  expect(requests()).toBe(1);
});

test("a live run with no language model switches the hero to the plain search's words and card", async ({ page }) => {
  await open(page, "?interval=60");
  await openPanel(page);
  await page.getByTestId("model-select").selectOption({ label: "Unreliable" });
  await page.getByTestId("live-start").click();
  await expect(page.getByTestId("hero-title")).toHaveText("The agent couldn't reach its language model, so a plain search ran alone.", { timeout: 30_000 });
  await expect(page.getByTestId("scoreboard-card")).toContainText("Brute-force search");
  await expect(page.getByTestId("scoreboard-facts")).not.toContainText("tries");
  await expect(page.getByTestId("run-origin")).toHaveText("From your live run with Unreliable.");
});

test("when the gate says no, its message shows in the panel and nothing else changes", async ({ page }) => {
  const message = "You have started as many live runs as you can this hour. Try again in about an hour.";
  await page.route("**/api/run*", (route) => route.fulfill({ status: 429, headers: { "content-type": "application/json" },
    body: JSON.stringify({ reason: "visitor_hourly_limit", message, retry_after_seconds: 3600 }) }));
  await open(page);
  await openPanel(page);
  const title = await page.getByTestId("hero-title").textContent();
  await page.getByTestId("live-start").click();
  await expect(page.getByTestId("live-message")).toHaveText(message);
  await expect(page.getByTestId("live-start")).toBeEnabled();
  await expect(panel(page)).toBeVisible();                                    // it stays open
  await expect(page.getByTestId("hero-title")).toHaveText(title!);
  await expect(page.getByTestId("run-origin")).toContainText("From a recorded run");
});

test("a live run that fails part-way leaves the recorded run in place and says so", async ({ page }) => {
  const steps = recorded().events.slice(0, 6);
  await page.route("**/api/run*", (route) => route.fulfill({ status: 200, headers: { "content-type": "text/event-stream" },
    body: steps.map((s: unknown) => sse("step", s)).join("") + sse("error", { message: "The run failed: the model went away." }) }));
  await open(page, "?interval=60");
  await openPanel(page);
  const title = await page.getByTestId("hero-title").textContent();
  await page.getByTestId("live-start").click();
  await expect(page.getByTestId("live-message")).toContainText("did not finish", { timeout: 15_000 });
  await expect(page.getByTestId("hero-title")).toHaveText(title!);
  await expect(page.getByTestId("run-origin")).toContainText("From a recorded run");
  await expect(page.getByTestId("round-item")).toHaveCount(Object.assign({}, ...recorded().events.map((e: { changes: object }) => e.changes)).rounds.length);
  await expect(page.getByTestId("run-label")).toContainText("Recorded");
  await expect(page.getByTestId("live-start")).toBeEnabled();
});
