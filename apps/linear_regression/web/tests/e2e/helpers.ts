import { expect, type Page } from "@playwright/test";

/** Open the page with a fast starting pace so a full run takes a couple of seconds. */
export async function open(page: Page, interval = 120) {
  await page.goto(`/?interval=${interval}`);
  await expect(page.locator('[data-node="load_data"]')).toBeVisible();
}

/** Counts every request the page makes to /api/run. */
export function countRunRequests(page: Page): { count: () => number } {
  let n = 0;
  page.on("request", (r) => { if (new URL(r.url()).pathname === "/api/run") n++; });
  return { count: () => n };
}

/** Answer /api/run with a fixed SSE body (e.g. a stream that stops before `done`, or another app's). */
export async function serveRun(page: Page, body: string) {
  await page.route("**/api/run*", (route) =>
    route.fulfill({ status: 200, headers: { "content-type": "text/event-stream", "cache-control": "no-cache" }, body }));
}

export async function serveStructure(page: Page, structure: unknown) {
  await page.route("**/api/structure", (route) => route.fulfill({ json: structure }));
}

export const sse = (event: string, data: unknown) => `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;

export const timelineItems = (page: Page) => page.getByTestId("timeline-item");

/** Wait until the run in progress has been shown to the end (it does not press Play). */
export async function finishRun(page: Page) {
  await expect(page.getByTestId("explanation")).toBeAttached({ timeout: 45_000 });   // it lives in The final test tab
  await expect(page.getByTestId("pause")).toBeDisabled();
  // Reaching the end moves the page to What the agent found; the graph and its panels are on Working, so go back there.
  // A test that wants a result tab opens it itself (openTab).
  await expect(page.getByTestId("tab-found")).toHaveAttribute("aria-selected", "true", { timeout: 5_000 }).catch(() => undefined);
  await openTab(page, "working");
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());   // arrow keys step the replay, not the tabs
}

/** Press Play and wait until the whole run has been shown. */
export async function playToEnd(page: Page) {
  await page.getByTestId("play").click();
  await finishRun(page);
}

/** Open one of the page's tabs by its id (data, working, found, final-test, try-your-own). */
export async function openTab(page: Page, id: "data" | "working" | "found" | "final-test" | "try-your-own") {
  await page.getByTestId(`tab-${id}`).click();
  await expect(page.getByTestId(`tab-${id}`)).toHaveAttribute("aria-selected", "true");
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());   // arrow keys step the replay, not the tabs
}

/** After a run has been shown to the end the page is on What the agent found; open another tab from there. */
export async function afterRunOpen(page: Page, id: "working" | "found" | "final-test" | "try-your-own") {
  await expect(page.getByTestId("tab-found")).toHaveAttribute("aria-selected", "true", { timeout: 15_000 });
  await openTab(page, id);
}
