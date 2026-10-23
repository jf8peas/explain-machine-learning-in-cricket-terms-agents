import { expect, type APIRequestContext, type Page } from "@playwright/test";
import { visitorFor } from "./fixtures";

/** Open the page at the fast pace with every Commentary panel open, run the fake model to its end (the default AI) and wait for the graph
 *  to be drawn; the graph's run controls and path come with Show me everything once there is a run. */
export async function open(page: Page, interval = 120) {
  await page.goto(`/?interval=${interval}&view=everything`);
  await expect(page.locator('[data-node="load_data"]')).toBeVisible();
  await finishRun(page);
  await openPath(page);
}

/** The page with everything open and the graph drawn, and no run yet. */
export async function openIdle(page: Page, interval = 120) {
  await page.goto(`/?interval=${interval}&view=everything`);
  await expect(page.locator('[data-node="load_data"]')).toBeVisible();
}

/** The graph's "Path taken" list is closed until asked for (it is one of the longest pieces of text); open it to use the timeline. */
export async function openPath(page: Page, host = "graph-replay") {
  await page.locator(`${host} [data-testid=path] > summary`).click();
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

/** Scroll to the player once the hero above it has filled in. */
export async function toPlayer(page: Page) {
  await expect(page.getByTestId("hero-title")).toBeVisible();
  await page.getByTestId("player").scrollIntoViewIfNeeded();
}

/** The page is loaded: press Play (the default AI, or the one named) and wait until the run has finished. The first run on a server
 *  is the slowest (the grid search is worked out once per process), so the wait is generous. */
export async function finishRun(page: Page, model?: string) {
  await toPlayer(page);
  if (model) await page.getByTestId("model-select").selectOption({ label: model });
  await page.getByTestId("play-button").click();
  await expect(page.getByTestId("player-status")).toHaveText(/^Finished with/, { timeout: 90_000 });
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());   // arrow keys step the replay
}

/** Open the page, press "Start the experiment" and Play, and wait until the run has finished. `query` is the page's query string. */
export async function runToEnd(page: Page, query = "", model?: string) {
  await page.goto(`/${query}`);
  await expect(page.getByTestId("start-experiment")).toBeVisible();
  await page.getByTestId("start-experiment").click();
  await expect(page.getByTestId("model-select")).toBeFocused();
  await finishRun(page, model);
}

/** Wait for the run that is going (or has gone) to be finished; it does not start one. */
export async function playToEnd(page: Page) {
  await expect(page.getByTestId("player-status")).toHaveText(/^Finished with/, { timeout: 90_000 });
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
}

/** A scripted fake-model run fetched straight from the API as a visitor of its own (so the page's visitor keeps its limit), for tests
 *  that need the figures the page will show. */
export async function fakeRun(request: APIRequestContext, visitor: string, model = "") {
  const res = await request.get(`/api/run${model ? `?model=${model}` : ""}`, { headers: { "X-Forwarded-For": visitor } });
  const events: { step: number; node: string; summary: string; changes: Record<string, unknown> }[] = [];
  for (const block of (await res.text()).trim().split(/\n\n/)) {
    const lines = block.split(/\n/);
    if (lines[0] === "event: step") events.push(JSON.parse(lines[1].slice(6)));
  }
  const state: Record<string, unknown> = {};
  for (const e of events) Object.assign(state, e.changes);
  return { events, state };
}

/** A visitor address for a request of its own inside a test (the page itself is another visitor, set by fixtures.ts). */
export function visitorOf(testId: string, salt: string): string {
  return visitorFor(testId, salt);
}

/** The server-sent-events text for a list of step events, with a start before each step and a done at the end. */
export function streamOf(events: { step: number; node: string }[]): string {
  return events.map((e) => sse("start", { step: e.step, node: e.node }) + sse("step", e)).join("") + sse("done", { steps: events.length });
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
    const up = (n: Element): Element | null => n.parentElement ?? ((n.getRootNode() as ShadowRoot).host ?? null);   // out of a shadow root into its host
    for (let n: Element | null = el; n; n = up(n)) {
      // feature 024: the hero band's bowler is painted above the band's background and below its content, at the strongest point of the shape
      const bowler = n.querySelector(":scope > .silhouette-bowler");
      if (bowler) { const cs = getComputedStyle(bowler); layers.push([...rgba(cs.backgroundColor).slice(0, 3), Number(cs.opacity)] as [number, number, number, number]); }
      const bg = rgba(getComputedStyle(n).backgroundColor);
      if (bg[3] > 0) layers.push(bg);
      if (bg[3] >= 1) break;
    }
    let base: [number, number, number] = rgba(getComputedStyle(document.body).backgroundColor).slice(0, 3) as [number, number, number];
    for (const layer of layers.reverse()) base = over(layer, base);
    // SVG text is coloured by `fill`, HTML text by `color`
    const isSvgText = el instanceof SVGElement;
    const text = rgba(isSvgText ? getComputedStyle(el).fill : getComputedStyle(el).color);
    let fg = over(text, base);
    // feature 024: the batter is blended over the whole chart area (text included), at the strongest point of the shape
    const stage = el.closest(".worm-stage");
    const batter = stage?.querySelector(":scope > .silhouette-batter");
    if (batter) {
      const cs = getComputedStyle(batter);
      const ink = rgba(cs.backgroundColor), a = Number(cs.opacity) * ink[3];
      const blend = (x: number, c: number) => (cs.mixBlendMode === "screen"
        ? x * (1 - a) + a * (255 - ((255 - x) * (255 - c)) / 255)
        : x * (1 - a) + a * ((x * c) / 255));
      const through = (rgb: [number, number, number]) => [0, 1, 2].map((i) => blend(rgb[i], ink[i])) as [number, number, number];
      base = through(base);
      fg = through(fg);
    }
    const lum = (c: [number, number, number]) => {
      const [r, g, b] = c.map((v) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; });
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };
    const [hi, lo] = [lum(fg), lum(base)].sort((a, b) => b - a);
    return (hi + 0.05) / (lo + 0.05);
  });
}

/** The text a visitor can see inside `<main>`, shadow roots included, without the agent's quoted reasoning (marked `data-reasoning`),
 *  visually hidden text, or anything not displayed. This is what the word-count test measures (feature 020, FR-015). */
export async function visibleMainText(page: Page): Promise<string> {
  return page.evaluate(() => {
    const out: string[] = [];
    const shown = (el: Element) => {
      const cs = getComputedStyle(el);
      return cs.display !== "none" && cs.visibility !== "hidden" && !(el as HTMLElement).hidden &&
        !el.classList.contains("visually-hidden") && !el.classList.contains("sr-only") && !el.hasAttribute("data-reasoning") &&
        !el.hasAttribute("data-diagram");          // a diagram's labels (node names, badges, row notes) are not prose: counted apart, like the agent's reasoning
    };
    const walk = (node: Node) => {
      if (node.nodeType === Node.TEXT_NODE) { out.push(node.textContent ?? ""); return; }
      if (!(node instanceof Element)) return;
      if (!shown(node)) return;
      if (node.tagName === "STYLE" || node.tagName === "SCRIPT") return;
      if (node.tagName === "SELECT") { out.push((node as HTMLSelectElement).selectedOptions[0]?.textContent ?? ""); return; }   // a closed select shows its choice
      if (node.tagName === "DETAILS" && !(node as HTMLDetailsElement).open) { node.querySelectorAll(":scope > summary").forEach(walk); return; }   // closed: its summary only
      if (node.shadowRoot) node.shadowRoot.childNodes.forEach(walk);
      node.childNodes.forEach(walk);
    };
    const main = document.querySelector("main");
    if (main) walk(main);
    return out.join(" ");
  });
}

/** Words as a reader counts them: runs of letters or digits, so arrows and bullets are not words. */
export const wordCount = (text: string): number => (text.match(/[\p{L}\p{N}][\p{L}\p{N}'’.,:%/·\-–]*/gu) ?? []).length;
