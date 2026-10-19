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

/** The text a visitor can see inside a test id (hidden text is not included). */
export async function visibleText(page: Page, testid: string): Promise<string> {
  return page.getByTestId(testid).evaluate((root) => {
    const out: string[] = [];
    const walk = (node: Node) => {
      if (node.nodeType === Node.TEXT_NODE) { out.push(node.textContent ?? ""); return; }
      if (!(node instanceof HTMLElement)) return;
      const style = getComputedStyle(node);
      if (style.display === "none" || style.visibility === "hidden" || node.hidden) return;
      if (node.classList.contains("visually-hidden")) return;
      node.childNodes.forEach(walk);
    };
    walk(root);
    return out.join(" ");
  });
}

/** Every `[data-key]` panel of the state panel as one object: the whole run state as the page holds it. */
export async function wholeState(page: Page): Promise<Record<string, unknown>> {
  return page.locator("[data-key]").evaluateAll((els) => {
    const state: Record<string, unknown> = {};
    for (const el of els) {
      const pre = el.querySelector("pre");
      const key = el.getAttribute("data-key");
      if (!key || !pre) continue;
      try { state[key] = JSON.parse(pre.textContent ?? "null"); } catch { /* a panel that is not JSON is not state */ }
    }
    return state;
  });
}

/** The contrast ratio (WCAG) between an element's text colour and its effective background, in the theme now showing. */
export async function contrastOf(page: Page, selector: string, nth = 0): Promise<number> {
  return page.locator(selector).nth(nth).evaluate((el) => {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 1;
    const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
    const rgba = (css: string): [number, number, number, number] => {
      ctx.clearRect(0, 0, 1, 1);
      ctx.fillStyle = "#000"; ctx.fillStyle = css;
      ctx.fillRect(0, 0, 1, 1);
      const d = ctx.getImageData(0, 0, 1, 1).data;
      return [d[0], d[1], d[2], d[3] / 255];
    };
    const over = (top: [number, number, number, number], under: [number, number, number]): [number, number, number] =>
      [0, 1, 2].map((i) => top[i] * top[3] + under[i] * (1 - top[3])) as [number, number, number];
    const layers: [number, number, number, number][] = [];
    for (let n: Element | null = el; n; n = n.parentElement) {
      const bg = rgba(getComputedStyle(n).backgroundColor);
      if (bg[3] > 0) layers.push(bg);
      if (bg[3] >= 1) break;
    }
    let base: [number, number, number] = rgba(getComputedStyle(document.body).backgroundColor).slice(0, 3) as [number, number, number];
    for (const layer of layers.reverse()) base = over(layer, base);
    const text = rgba(getComputedStyle(el).color);
    const fg = over(text, base);
    const lum = (c: [number, number, number]) => {
      const [r, g, b] = c.map((v) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; });
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };
    const [hi, lo] = [lum(fg), lum(base)].sort((a, b) => b - a);
    return (hi + 0.05) / (lo + 0.05);
  });
}

/** The whole state of a finished run, from the server's own event stream (the state panel shows large values as counts, not data).
 *  The fake model is deterministic, so this equals the run just shown. It counts as one run against the visitor's limit. */
export async function apiState(page: Page, query = ""): Promise<Record<string, unknown>> {
  const text = await (await page.request.get(`/api/run${query}`)).text();
  const state: Record<string, unknown> = {};
  for (const block of text.trim().split("\n\n")) {
    const [event, data] = block.split("\n");
    if (event === "event: step") Object.assign(state, JSON.parse(data.replace("data: ", "")).changes);
  }
  return state;
}
