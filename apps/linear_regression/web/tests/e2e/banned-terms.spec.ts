// No banned name anywhere a visitor can see or hear (feature 021, FR-013): both pages, before a run, on a finished run and on a
// fake-model live run, with everything open and every Scorebook panel opened in turn. It collects the visible text (shadow DOM
// included), accessible names (aria-label, aria-labelledby and aria-describedby targets, alt, title, placeholder), SVG titles and
// descriptions, live-region text and announcements made while a run plays, the page title and the preview tags. A hit outside the
// agent's own reasoning fails with the term, the page and the nearest landmark. "forward selection" is allowed only inside brackets
// after a plain term (Commentary, Scorebook) and anywhere in a definition. The banned list is the server's, not a copy.
import { expect, test, type Page } from "./fixtures";
import { finishRun, openPath } from "./helpers";
import { SETUP_ALLOWED } from "./banned-terms.allow";

interface Item { kind: string; text: string; region: string; landmark: string }
interface Banned { pattern: string; allowed_in: string[] }

/** Runs in the page: every visible word and accessible name, with the region it sits in and its nearest landmark. */
function collectInPage(): Item[] {
  const items: Item[] = [];
  const landmarkOf = (node: Node): string => {
    for (let n: Node | null = node; n; n = n.parentNode ?? (n as ShadowRoot).host ?? null) {
      if (!(n instanceof Element)) continue;
      const label = n.getAttribute("aria-label") ?? "";
      if (/^(MAIN|NAV|HEADER|FOOTER)$/.test(n.tagName) || n.getAttribute("role") === "region" || (n.tagName === "SECTION" && n.id) || (n.id && n.matches("[data-testid]"))) {
        return `${n.tagName.toLowerCase()}${n.id ? `#${n.id}` : ""}${label ? ` [${label}]` : ""}`;
      }
    }
    return "document";
  };
  const regionOf = (node: Node): string => {
    for (let n: Node | null = node; n; n = n.parentNode ?? (n as ShadowRoot).host ?? null) {
      if (n instanceof Element && n.hasAttribute("data-region")) return n.getAttribute("data-region") as string;
    }
    return "scoreboard";
  };
  const add = (kind: string, text: string | null | undefined, at: Node) => {
    const t = (text ?? "").replace(/\s+/g, " ").trim();
    if (t) items.push({ kind, text: t, region: regionOf(at), landmark: landmarkOf(at) });
  };
  const visible = (el: Element): boolean => {
    const check = (el as Element & { checkVisibility?: (o: object) => boolean }).checkVisibility;
    return check ? check.call(el, { checkVisibilityCSS: true, visibilityProperty: true }) : true;
  };
  const textOf = (root: Node, id: string): string | null => {
    const scope = root instanceof ShadowRoot || root instanceof Document ? root : document;
    return scope.getElementById(id)?.textContent ?? document.getElementById(id)?.textContent ?? null;
  };
  const walk = (node: Node, root: Node) => {
    if (node instanceof Element) {
      if (["SCRIPT", "STYLE", "NOSCRIPT", "TEMPLATE"].includes(node.tagName)) return;
      const inSvgText = node.tagName === "title" || node.tagName === "desc";
      if (!inSvgText && !visible(node)) return;
      for (const attr of ["aria-label", "alt", "title", "placeholder"]) add(`@${attr}`, node.getAttribute(attr), node);
      for (const attr of ["aria-labelledby", "aria-describedby"]) {
        for (const id of (node.getAttribute(attr) ?? "").split(/\s+/).filter(Boolean)) add(`@${attr}`, textOf(root, id), node);
      }
      if (node.shadowRoot) walk(node.shadowRoot, node.shadowRoot);
    }
    for (const child of node.childNodes) {
      if (child.nodeType === Node.TEXT_NODE) {
        const parent = child.parentElement;
        const inSvgText = parent && (parent.tagName === "title" || parent.tagName === "desc");
        if (parent && (inSvgText || visible(parent))) add(inSvgText ? "svg" : "text", child.textContent, child);
      } else walk(child, root);
    }
  };
  walk(document.body, document);
  add("document.title", document.title, document.documentElement);
  for (const m of document.querySelectorAll('meta[name="description"], meta[property^="og:"], meta[name^="twitter:"]')) {
    add("meta", m.getAttribute("content"), document.documentElement);
  }
  const heard = (window as unknown as { __announced?: Item[] }).__announced ?? [];
  return [...items, ...heard];
}

/** Records what live regions say while a run plays (installed before the page loads). */
function recordAnnouncements() {
  const heard: { kind: string; text: string; region: string; landmark: string }[] = [];
  (window as unknown as { __announced: typeof heard }).__announced = heard;
  const regionOf = (n: Node | null): string => {
    for (; n; n = n.parentNode ?? (n as ShadowRoot).host ?? null) if (n instanceof Element && n.hasAttribute("data-region")) return n.getAttribute("data-region") as string;
    return "scoreboard";
  };
  new MutationObserver((records) => {
    for (const r of records) {
      const el = (r.target instanceof Element ? r.target : r.target.parentElement)?.closest("[aria-live], [role=status], [role=alert]");
      const text = el?.textContent?.replace(/\s+/g, " ").trim();
      if (el && text) heard.push({ kind: "announcement", text, region: regionOf(el), landmark: el.getAttribute("data-testid") ?? "live region" });
    }
  }).observe(document, { subtree: true, childList: true, characterData: true });
}

/** The banned names found in `items`, as readable lines. */
export function findHits(items: Item[], banned: Banned[], page: string): string[] {
  const hits: string[] = [];
  for (const item of items) {
    if (item.region === "reasoning" || item.region === "state") continue;     // the agent's own words, and the raw state's keys (identifiers)
    let text = item.text;
    for (const phrase of SETUP_ALLOWED) text = text.split(phrase).join(" ");
    for (const b of banned) {
      for (const m of text.matchAll(new RegExp(b.pattern, "gi"))) {
        const at = m.index ?? 0;
        const inDefinition = item.region === "definition" && b.allowed_in.includes("definition");
        const bracketed = b.allowed_in.includes(item.region) && (text.slice(0, at).match(/\(/g)?.length ?? 0) > (text.slice(0, at).match(/\)/g)?.length ?? 0);
        if (inDefinition || bracketed) continue;
        hits.push(`banned "${m[0]}" on ${page} in ${item.landmark} (${item.kind}, ${item.region}): "${text.slice(Math.max(0, at - 30), at + 40)}"`);
      }
    }
  }
  return hits;
}

const bannedList = async (page: Page): Promise<Banned[]> => (await (await page.request.get("/api/reference")).json()).banned;
const collect = (page: Page) => page.evaluate(collectInPage);

async function openScorebook(page: Page, panel: "models" | "data", seen: Item[]) {
  await page.getByTestId(`scorebook-card-${panel}`).click();
  await expect(page.getByTestId("scorebook-panel")).toBeVisible();
  if (panel === "data") await expect(page.locator("data-grid .tabulator-row").first()).toBeVisible({ timeout: 30_000 });
  seen.push(...(await collect(page)));
}

/** Step through every event of the graph's timeline, reading the event, the stage line and the item panel at each. */
async function stepThrough(page: Page, host: string, seen: Item[]) {
  await openPath(page, host);
  const steps = page.locator(`${host} [data-testid=timeline-item]`);
  const n = await steps.count();
  for (let i = 0; i < n; i++) {
    await steps.nth(i).click();
    seen.push(...(await collect(page)));
  }
}

async function mainPageItems(page: Page): Promise<Item[]> {
  await page.addInitScript(recordAnnouncements);
  await page.goto("/?interval=40&view=everything");
  await expect(page.getByTestId("hero-title")).toBeVisible();
  const items = await collect(page);                                          // the idle page: the question, the goal, the locked cards
  expect(items.some((i) => /Press play to see how it does/.test(i.text))).toBe(true);
  await finishRun(page);
  items.push(...(await collect(page)));
  await stepThrough(page, "[data-testid=run-graph] graph-replay", items);
  await page.getByTestId("scorebook-cards").scrollIntoViewIfNeeded();
  await openScorebook(page, "models", items);
  await openScorebook(page, "data", items);
  return items;
}

test("the main page, idle and then on a finished run with everything open and every Scorebook panel open, has no banned name", async ({ page }) => {
  const banned = await bannedList(page);
  const items = await mainPageItems(page);
  expect(items.length).toBeGreaterThan(200);                                 // it is reading the page, not an empty one
  expect(items.some((i) => i.kind === "announcement")).toBe(true);           // and it heard the live regions
  expect(items.some((i) => i.kind === "meta") && items.some((i) => i.kind === "document.title")).toBe(true);
  expect(findHits(items, banned, "main page")).toEqual([]);
});

test("How this app was built, with everything open, has no banned name", async ({ page }) => {
  const banned = await bannedList(page);
  await page.addInitScript(recordAnnouncements);
  await page.goto("/under-the-hood.html?view=everything");
  await page.getByTestId("words-we-use").locator("summary").click();            // the glossary is a closed <details> inside Commentary
  await expect(page.getByTestId("word-row").first()).toBeVisible();
  await expect(page.locator("graph-replay [data-node]").first()).toBeVisible();
  const items = await collect(page);
  expect(items.length).toBeGreaterThan(200);
  expect(items.some((i) => i.region === "definition" && /forward selection/i.test(i.text))).toBe(true);   // the exempt text is really read
  expect(findHits(items, banned, "How this app was built")).toEqual([]);
});

test("a run of the model that fails, and one with no agent, have no banned name on the main page", async ({ page }) => {
  const banned = await bannedList(page);
  await page.addInitScript(recordAnnouncements);
  await page.goto("/?interval=40&view=everything");
  await expect(page.getByTestId("hero-title")).toBeVisible();
  await finishRun(page, "Unreliable");                                          // the brute-force search runs alone: the other wording
  const items = await collect(page);
  await stepThrough(page, "[data-testid=run-graph] graph-replay", items);
  await openScorebook(page, "models", items);
  expect(items.some((i) => i.kind === "announcement")).toBe(true);
  expect(findHits(items, banned, "main page (no agent)")).toEqual([]);
});

test("the check can fail: a banned name in the Scoreboard is reported with its landmark, one in the agent's reasoning is not", async ({ page }) => {
  const banned = await bannedList(page);
  await page.goto("/?view=everything");
  await expect(page.getByTestId("hero-title")).toBeVisible();
  await page.evaluate(() => {
    const plain = document.createElement("p");
    plain.id = "probe-plain";
    plain.textContent = "Here the rival won, with forward selection and a setup.";
    document.querySelector("#verdict")!.append(plain);
    const quoted = document.createElement("p");
    quoted.setAttribute("data-region", "reasoning");
    quoted.textContent = "In my own words the rival and forward selection and a setup.";
    document.querySelector("#verdict")!.append(quoted);
    const bracket = document.createElement("p");
    bracket.setAttribute("data-region", "commentary");
    bracket.textContent = "brute-force search (grid search with forward selection) is fine here";
    document.querySelector("#verdict")!.append(bracket);
  });
  const hits = findHits((await collect(page)).filter((i) => /own words|Here the rival|brute-force search \(grid/.test(i.text)), banned, "main page");
  expect(hits.map((h) => h.match(/banned "([^"]+)"/)![1].toLowerCase()).sort()).toEqual(["forward selection", "rival", "setup"]);
  expect(hits.every((h) => h.includes("on main page in section#verdict"))).toBe(true);
});
