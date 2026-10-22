import { expect, type Page } from "@playwright/test";

/** Open the page at the fast pace with every Commentary panel open (the agent graph is in one), and wait until the graph is drawn.
 *  (Feature 020: the page plays the recorded run by itself once it scrolls into view; nothing is pressed.) */
export async function open(page: Page, interval = 120) {
  await page.goto(`/?interval=${interval}&view=everything`);
  await expect(page.locator('[data-node="load_data"]')).toBeVisible();
  await openPath(page);
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

/** Scroll to the player once the page above it has filled in (scrolling earlier would be undone when the hero and the problem appear). */
export async function toPlayer(page: Page) {
  await expect(page.getByTestId("scoreboard-agent")).toBeVisible();
  await page.getByTestId("player").scrollIntoViewIfNeeded();
}

/** Scroll to the player and wait until the recorded run has played to its end ("Watch again"). */
export async function finishRun(page: Page) {
  await toPlayer(page);
  await expect(page.getByTestId("watch-button")).toHaveText(/Watch (your run )?again/, { timeout: 45_000 });
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());   // arrow keys step the replay
}

/** The run is played by itself now, so this is the same as waiting for it to finish. */
export async function playToEnd(page: Page) {
  await finishRun(page);
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

/** The text a visitor can see inside `<main>`, shadow roots included, without the agent's quoted reasoning (marked `data-reasoning`),
 *  visually hidden text, or anything not displayed. This is what the word-count test measures (feature 020, FR-015). */
export async function visibleMainText(page: Page): Promise<string> {
  return page.evaluate(() => {
    const out: string[] = [];
    const shown = (el: Element) => {
      const cs = getComputedStyle(el);
      return cs.display !== "none" && cs.visibility !== "hidden" && !(el as HTMLElement).hidden &&
        !el.classList.contains("visually-hidden") && !el.classList.contains("sr-only") && !el.hasAttribute("data-reasoning");
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
