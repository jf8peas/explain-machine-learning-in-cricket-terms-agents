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
  await page.route("**/api/run", (route) =>
    route.fulfill({ status: 200, headers: { "content-type": "text/event-stream", "cache-control": "no-cache" }, body }));
}

export async function serveStructure(page: Page, structure: unknown) {
  await page.route("**/api/structure", (route) => route.fulfill({ json: structure }));
}

export const sse = (event: string, data: unknown) => `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;

export const timelineItems = (page: Page) => page.getByTestId("timeline-item");

/** Press Play and wait until the whole run has been shown. */
export async function playToEnd(page: Page) {
  await page.getByTestId("play").click();
  await expect(page.getByTestId("explanation")).toBeVisible({ timeout: 45_000 });
  await expect(page.getByTestId("pause")).toBeDisabled();
}
