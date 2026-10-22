// The broadcaster's projection (feature 023): "TV" is replaced by "broadcaster" wherever a visitor sees or hears it, and every row of the
// design README's examples table appears on a finished fake-model run, with its numbers taken from the server.
import { expect, test, type Page } from "./fixtures";
import { finishRun, visibleMainText } from "./helpers";

test.use({ viewport: { width: 1000, height: 900 } });

/** Every word a visitor can see or hear on the page: all text, including visually hidden text and live regions, shadow roots, and the
 *  attributes read out (aria-label, title, alt), without the agent's quoted reasoning (its own words, shown as written). */
async function everythingHeard(page: Page): Promise<string> {
  return page.evaluate(() => {
    const out: string[] = [document.title];
    const meta = (sel: string) => document.querySelectorAll(sel).forEach((m) => out.push(m.getAttribute("content") ?? ""));
    meta('meta[name="description"]'); meta('meta[property^="og:"]'); meta('meta[name^="twitter:"]');
    const walk = (node: Node) => {
      if (node.nodeType === Node.TEXT_NODE) { out.push(node.textContent ?? ""); return; }
      if (!(node instanceof Element) || node.hasAttribute("data-reasoning")) return;
      if (node.tagName === "STYLE" || node.tagName === "SCRIPT") return;
      for (const name of ["aria-label", "title", "alt", "placeholder"]) {
        const v = node.getAttribute(name);
        if (v) out.push(v);
      }
      if (node.shadowRoot) node.shadowRoot.childNodes.forEach(walk);
      node.childNodes.forEach(walk);
    };
    walk(document.body);
    return out.join(" | ");
  });
}

const TV = /\bTV\b/;

test("after a finished run the main page says broadcaster everywhere and never TV, at every level", async ({ page }) => {
  await page.goto("/?interval=40&view=everything");
  await finishRun(page);
  await page.getByTestId("scorebook-card-models").click();
  await expect(page.getByTestId("scorebook-panel")).toBeVisible();
  const heard = await everythingHeard(page);
  expect(heard.match(TV), `"TV" in: ${heard.match(/.{0,60}\bTV\b.{0,60}/)?.[0]}`).toBeNull();
  expect(heard).toContain("broadcaster");
});

test("the Scorebook's data and the how-it-was-built page never say TV", async ({ page }) => {
  await page.goto("/under-the-hood.html?view=everything");
  await expect(page.getByTestId("fact-steps")).not.toHaveText("not available right now");
  const heard = await everythingHeard(page);
  expect(heard.match(TV), `"TV" in: ${heard.match(/.{0,60}\bTV\b.{0,60}/)?.[0]}`).toBeNull();
  expect(heard).toContain("broadcaster");
});

test("every row of the design README's examples table appears on a finished fake-model run", async ({ page }) => {
  await page.goto("/?interval=40&view=everything");
  const ref = await (await page.request.get("/api/reference")).json();
  const missPast = ref.figures.broadcaster.average_miss.toFixed(1);
  await finishRun(page);
  const text = (await visibleMainText(page)).replace(/\s+/g, " ");

  // Goal card, and its figure label with the years it was worked out on
  await expect(page.getByTestId("goal-sentence")).toHaveText("Beat the broadcaster's projection by at least 3 runs on average.");
  expect(text).toContain(`runs: how far out the broadcaster usually is, on past innings (${ref.training.first_year}–${ref.training.last_year})`);
  // Result strip
  await expect(page.getByTestId("result-strip")).toHaveText(/^Result: [a-z ]+\. The (agent|brute-force search) was [\d.]+ runs out, the broadcaster [\d.]+\. See the verdict ↓$/);
  // The problem: heading and tile
  await expect(page.getByTestId("problem-title")).toHaveText(`The broadcaster's projection is usually about ${missPast} runs out.`);
  await expect(page.getByTestId("problem-tiles")).toContainText("Broadcaster said");
  // Verdict heading
  expect(text).toMatch(/the agent (beat|edged) the broadcaster by [\d.]+ runs\.|the broadcaster beat the agent by [\d.]+ runs\.|the agent and the broadcaster missed by the same amount\./);
  // The bars and the closeness chart name the method
  const names = await page.getByTestId("verdict-bar").locator(".vname").allTextContents();
  expect(names).toContain("Broadcaster's projection");
  // The rule of thumb names it
  expect(text).toMatch(/When the broadcaster shows a projected score,|The broadcaster's projection is about right on average/);
  // Your turn: the lead and the tile
  await expect(page.locator("#try .lead")).toHaveText("See the agent's prediction next to the broadcaster's.");
  // The Right now line for the baseline step
  const structure = await (await page.request.get("/api/structure")).json();
  expect(structure.doing.baseline).toBe("Code is scoring the broadcaster's projection and the average-total guess");
  // The hero Commentary names the broadcaster and says which way it leans
  const commentary = (await page.getByTestId("hero-commentary").innerText()).replace(/\s+/g, " ");
  expect(commentary).toContain("the broadcaster");
  expect(commentary).toMatch(/guesses too (low|high)/);
});
