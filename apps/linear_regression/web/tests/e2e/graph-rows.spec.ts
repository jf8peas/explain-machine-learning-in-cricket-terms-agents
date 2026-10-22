// The agent graph (feature 020): four rows, each a card with a title and a note, a pill for each step in the order a run reaches
// it. The rows, their titles, notes and members all come from /api/structure; the page and the component hold none of them.
import { expect, test, type Page } from "./fixtures";
import { open, playToEnd } from "./helpers";

const node = (page: Page, id: string) => page.locator(`[data-node="${id}"]`);
const rows = (page: Page) => page.locator("graph-replay [data-testid=graph-row]");

async function structure(page: Page) {
  return (await (await page.request.get("/api/structure")).json()) as {
    rows: { id: string; title: string; note: string }[];
    nodes: { id: string; kind: string; row?: string; actor?: string }[];
    edges: { source: string; target: string; conditional: boolean; branch: string | null }[];
  };
}

test("the graph has four rows in the server's order, with the server's titles and notes", async ({ page }) => {
  await open(page);
  const s = await structure(page);
  expect(s.rows.map((r) => r.id)).toEqual(["start", "round", "yardstick", "end"]);
  await expect(rows(page)).toHaveCount(4);
  for (const [i, row] of s.rows.entries()) {
    await expect(rows(page).nth(i)).toHaveAttribute("data-row", row.id);
    await expect(rows(page).nth(i).locator(".row-title")).toHaveText(row.title);
    await expect(rows(page).nth(i).locator(".row-note")).toHaveText(row.note);
  }
  await expect(rows(page).nth(1).locator(".row-note")).toHaveText(/up to \d+ rounds; rejected ideas count/);
});

test("rows are stacked top to bottom in order, and every step sits inside the card of its row", async ({ page }) => {
  await open(page);
  await playToEnd(page);                                      // the page above stops growing once the run has been shown
  const s = await structure(page);
  let lastBottom = -1;
  const scrolled = () => page.evaluate(() => window.scrollY);
  const absolute = async (loc: ReturnType<typeof page.locator>) => { const b = (await loc.boundingBox())!; return { ...b, y: b.y + (await scrolled()) }; };
  for (const row of s.rows) {
    const card = await absolute(page.locator(`graph-replay [data-row="${row.id}"]`));
    expect(card.y).toBeGreaterThanOrEqual(lastBottom - 1);
    lastBottom = card.y + card.height;
    for (const n of s.nodes.filter((x) => x.row === row.id)) {
      const b = await absolute(node(page, n.id));
      expect(b.x, `${n.id} left`).toBeGreaterThanOrEqual(card.x - 1);
      expect(b.x + b.width, `${n.id} right`).toBeLessThanOrEqual(card.x + card.width + 1);
      expect(b.y, `${n.id} top`).toBeGreaterThanOrEqual(card.y - 1);
      expect(b.y + b.height, `${n.id} bottom`).toBeLessThanOrEqual(card.y + card.height + 1);
    }
  }
});

test("inside a row the steps run left to right in the order the agent reaches them", async ({ page }) => {
  await open(page);
  const order = async (row: string) => page.locator(`graph-replay [data-row="${row}"] [data-node]`).evaluateAll((els) => els.map((e) => e.getAttribute("data-node")));
  expect(await order("start")).toEqual(["load_data", "split", "explore", "baseline"]);
  expect(await order("round")).toEqual(["propose_features", "check_proposal", "fit_model", "evaluate"]);
  expect(await order("yardstick")).toEqual(["grid_search"]);
  expect(await order("end")).toEqual(["final_test", "explain_in_cricket_terms", "write_in_cricket_terms"]);
});

test("the way back inside the round row is written out, from the structure's conditional edges", async ({ page }) => {
  await open(page);
  const s = await structure(page);
  const back = s.edges.filter((e) => e.conditional && ["check_proposal", "evaluate"].includes(e.source) && e.target === "propose_features");
  expect(back.map((e) => e.branch).sort()).toEqual(["continue", "rejected"]);
  const loop = rows(page).nth(1).getByTestId("row-loop");
  await expect(loop).toContainText("↺");
  await expect(loop).toContainText("rejected");
  await expect(loop).toContainText("continue");
  await expect(loop).toContainText("back to propose_features");
  await expect(rows(page).nth(0).getByTestId("row-loop")).toHaveCount(0);
});

test("a language-model step has a dashed outline and an AI tag; code steps have neither", async ({ page }) => {
  await open(page);
  const s = await structure(page);
  for (const n of s.nodes.filter((x) => x.kind === "node")) {
    const style = await node(page, n.id).evaluate((el) => ({ border: getComputedStyle(el).borderTopStyle, active: el.classList.contains("active") }));
    if (n.actor === "llm") {
      await expect(node(page, n.id).locator(".actor-tag")).toHaveText("AI");
      expect(style.border).toBe(style.active ? "solid" : "dashed");           // the ring replaces the dash while it is the step on display
    } else {
      await expect(node(page, n.id).locator(".actor-tag")).toHaveCount(0);
      expect(style.border).toBe("solid");
    }
  }
});

test("the step the replay has reached has a 3 px ring, and only one step has it", async ({ page }) => {
  await open(page, 60);
  await playToEnd(page);
  await expect(page.locator(".node.active")).toHaveCount(0);                  // the run is over: nothing is working
  await page.locator("graph-replay [data-testid=back]").click();              // step back into the finished run: that step is the one on show
  await expect(page.locator(".node.active")).toHaveCount(1);
  const ring = await page.locator(".node.active").evaluate((el) => getComputedStyle(el).boxShadow);
  expect(ring).toMatch(/0px 0px 0px 3px/);
  const plain = await node(page, "load_data").evaluate((el) => getComputedStyle(el).boxShadow);
  expect(plain).toBe("none");
});

test("before anything has played no step is active or visited, and the graph is already drawn", async ({ page }) => {
  await page.goto("/?view=everything");
  await expect(node(page, "load_data")).toBeVisible();
  for (const id of ["load_data", "split", "propose_features", "final_test", "write_in_cricket_terms"]) await expect(node(page, id)).toBeVisible();
  await expect(page.locator(".node.active")).toHaveCount(0);
  await expect(page.locator(".node.visited")).toHaveCount(0);
});

test("step names are readable: at least 12 px", async ({ page }) => {
  await open(page);
  const sizes = await page.locator("graph-replay .node-name").evaluateAll((els) => els.map((e) => parseFloat(getComputedStyle(e).fontSize)));
  expect(Math.min(...sizes)).toBeGreaterThanOrEqual(12);
});

test.describe("on a phone", () => {
  test.use({ viewport: { width: 390, height: 844 } });
  test("the rows stack and their steps wrap inside the cards, with no sideways scroll", async ({ page }) => {
    await open(page);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    for (const card of await rows(page).all()) {
      const c = (await card.boundingBox())!;
      expect(c.x + c.width).toBeLessThanOrEqual(390);
      for (const n of await card.locator("[data-node]").all()) {
        const b = (await n.boundingBox())!;
        expect(b.x + b.width).toBeLessThanOrEqual(c.x + c.width + 1);
      }
    }
    const first = (await rows(page).nth(0).boundingBox())!, last = (await rows(page).nth(3).boundingBox())!;
    expect(last.y).toBeGreaterThan(first.y);
  });
});
