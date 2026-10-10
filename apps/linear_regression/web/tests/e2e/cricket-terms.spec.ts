import { expect, test, type Page } from "./fixtures";
import { open, openTab, playToEnd, serveRun, sse, timelineItems } from "./helpers";

// The "In cricket terms" section on The final test tab: blocks with a title, a visual and a sentence or two, wording from
// templates (code) and from the language model (a closing step that writes words only). Against the real app with the
// scripted fake model; no test calls a real model.

interface Block { id: string; title: string; sentences: string[]; visual: Record<string, unknown> }
interface Explanation { facts: Record<string, { display: string }>; blocks: Block[]; order: string[]; source: string; model: string | null; fallback_reason: string | null }

const explanationState = async (page: Page): Promise<Explanation> =>
  JSON.parse((await page.locator('[data-key="explanation"] pre').textContent()) ?? "{}");
const blockIds = (page: Page) => page.getByTestId("cricket-block").evaluateAll((els) => els.map((e) => e.getAttribute("data-block")));

test("the section shows the blocks in order, each with a title, a visual and a sentence", async ({ page }) => {
  await open(page);
  await playToEnd(page);
  const expl = await explanationState(page);
  await openTab(page, "final-test");
  expect(await blockIds(page)).toEqual(expl.order);
  expect(expl.order[0]).toBe("verdict");
  expect(expl.order[expl.order.length - 1]).toBe("closing");
  for (const block of await page.getByTestId("cricket-block").all()) {
    await expect(block.locator("h4")).not.toBeEmpty();
    await expect(block.locator(".block-sentence").first()).toBeVisible();
  }
  const badge = page.getByTestId("verdict-badge");
  await expect(badge).toContainText(/Goal (reached|missed)/);
  expect(await badge.locator("svg").count()).toBe(1);                              // a shape as well as words
  await expect(page.getByTestId("drivers-chart")).toBeVisible();
  await expect(page.getByTestId("years-strip")).toBeVisible();
});

test("every chart has a text equivalent that lists its values", async ({ page }) => {
  await open(page);
  await playToEnd(page);
  const expl = await explanationState(page);
  await openTab(page, "final-test");
  const drivers = expl.blocks.find((b) => b.id === "drivers")!.visual.rows as { label: string; display: string }[];
  const rows = page.getByTestId("drivers-table").locator("tbody tr");
  await expect(rows).toHaveCount(drivers.length);
  for (const [i, d] of drivers.entries()) {
    await expect(rows.nth(i)).toContainText(d.label);
    await expect(rows.nth(i)).toContainText(d.display);
  }
  const years = expl.blocks.find((b) => b.id === "how_chosen")!.visual.segments as { from: number; to: number }[];
  await expect(page.getByTestId("years-table").locator("li")).toHaveCount(years.length);
  await expect(page.getByTestId("years-table")).toContainText(String(years[years.length - 1].from));
  const hidden = await page.getByTestId("drivers-table").evaluate((el) => el.closest(".visually-hidden") !== null);
  expect(hidden).toBe(true);                                                         // for screen readers, not duplicated on screen
});

test("every bar is labelled with its value and sign, and none is invisible", async ({ page }) => {
  await open(page);
  await playToEnd(page);
  await openTab(page, "final-test");
  const rows = page.locator(".bar-row");
  const n = await rows.count();
  expect(n).toBeGreaterThanOrEqual(1);
  for (let i = 0; i < n; i++) {
    await expect(rows.nth(i).locator(".bar-value")).toHaveText(/^[+−]\d+\.\d runs$/);
    expect((await rows.nth(i).locator(".bar").boundingBox())?.width ?? 0).toBeGreaterThan(2);
  }
});

test("with the model's wording the section says so, names the model, and every number is a fact", async ({ page }) => {
  await open(page);
  await playToEnd(page);
  const expl = await explanationState(page);
  expect(expl.source).toBe("language model");
  await openTab(page, "final-test");
  await expect(page.getByTestId("writer-label")).toContainText("written by the language model");
  await expect(page.getByTestId("writer-label")).toContainText(expl.model ?? "");
  await expect(page.getByTestId("writer-fallback")).toHaveCount(0);
  const text = (await page.getByTestId("explanation").locator(".block-sentence, h4").allTextContents()).join(" ");
  const known = Object.values(expl.facts).flatMap((f) => f.display.match(/\d+(?:\.\d+)?/g) ?? []).map(Number);
  for (const token of text.match(/\d+(?:\.\d+)?/g) ?? []) expect(known.some((k) => Math.abs(k - Number(token)) < 1e-9), token).toBe(true);
});

test("when the language model fails the section still appears with template wording and one line saying so", async ({ page }) => {
  await open(page);
  await page.getByTestId("model-select").selectOption({ label: "Unreliable" });
  await playToEnd(page);
  const expl = await explanationState(page);
  expect(expl.source).toBe("template");
  await openTab(page, "final-test");
  expect(await blockIds(page)).toContain("verdict");
  await expect(page.getByTestId("writer-label")).toHaveCount(0);
  await expect(page.getByTestId("writer-fallback")).toContainText("templates");
  await expect(page.getByTestId("drivers-chart")).toBeVisible();
});

test("the graph shows the writing step as a language-model step in stage 8, after the code step", async ({ page }) => {
  await open(page);
  const write = page.locator('[data-node="write_in_cricket_terms"]');
  await expect(write).toHaveClass(/actor-llm/);
  await expect(write.locator(".actor-tag")).toHaveText("LLM");
  await expect(page.locator('[data-node="explain_in_cricket_terms"]')).toHaveClass(/actor-code/);
  await expect(write.getByTestId("stage-badge").locator("text")).toHaveText("8");
  await expect(page.locator('[data-edge="explain_in_cricket_terms->write_in_cricket_terms"]')).toHaveCount(1);
  await expect(page.locator('[data-edge="write_in_cricket_terms->__end__"]')).toHaveCount(1);
});

test("stepping back to the code step shows the template wording, and the writing step brings the model's", async ({ page }) => {
  await open(page);
  await playToEnd(page);
  const names = (await timelineItems(page).allTextContents()).map((t) => t.replace(/^\d+\.\s*/, ""));
  const showStep = async (name: string) => {                                       // the timeline is on Working, the section on The final test
    await openTab(page, "working");
    await timelineItems(page).nth(names.indexOf(name)).click();
    await openTab(page, "final-test");
  };
  await showStep("explain_in_cricket_terms");
  await expect(page.getByTestId("explanation")).toBeVisible();
  await expect(page.getByTestId("writer-label")).toHaveCount(0);                  // template wording at the code step
  await showStep("write_in_cricket_terms");
  await expect(page.getByTestId("writer-label")).toBeVisible();                   // the model's wording from its own step
  await showStep("baseline");
  await expect(page.getByTestId("explanation")).toHaveCount(0);                   // before the final test: no section
});

test("markup in the model's wording is shown as text", async ({ page }) => {
  await open(page);
  await page.getByTestId("model-select").selectOption({ label: "Markup" });
  await playToEnd(page);
  await openTab(page, "final-test");
  await expect(page.getByTestId("explanation")).toContainText("<script>");
  expect(await page.getByTestId("explanation").locator("script, b").count()).toBe(0);
  expect(await page.evaluate(() => (window as unknown as { __pwned?: boolean }).__pwned)).toBeUndefined();
});

// ---------------- the three verdict cases, from crafted states ----------------

async function craft(page: Page, patch: (e: Explanation) => void) {
  await open(page, 40);
  await playToEnd(page);
  const real = JSON.parse((await page.locator('[data-key="final"] pre').textContent()) ?? "{}");
  const expl = await explanationState(page);
  patch(expl);
  await serveRun(page, sse("step", { step: 1, node: "final_test", summary: "x", changes: { final: real, explanation: expl } }) + sse("done", { steps: 1 }));
  await page.reload();
  await openTab(page, "working");
  await page.getByTestId("play").click();
  await expect(page.getByTestId("tab-found")).toHaveAttribute("aria-selected", "true", { timeout: 15_000 });
  await openTab(page, "final-test");
}

for (const [name, badge, goalReached] of [["reached", "Goal reached", true], ["missed", "Goal missed", false]] as const) {
  test(`the badge reads "${badge}" with its own shape when the goal is ${name}`, async ({ page }) => {
    await craft(page, (e) => {
      const v = e.blocks.find((b) => b.id === "verdict")!;
      v.visual = { goal_reached: goalReached, beat_tv: true, badge };
    });
    const el = page.getByTestId("verdict-badge");
    await expect(el).toContainText(badge);
    await expect(el).toHaveClass(goalReached ? /reached/ : /missed/);
    const shape = await el.locator("svg .badge-shape").evaluate((e) => e.tagName.toLowerCase());
    expect(shape).toBe(goalReached ? "circle" : "rect");                              // a different shape, not only a colour
  });
}

test("a wicket block is shown only when the model has a wicket feature, and a gain is said plainly", async ({ page }) => {
  await craft(page, (e) => {
    e.blocks = e.blocks.filter((b) => b.id !== "wicket");
    e.order = e.order.filter((i) => i !== "wicket");
  });
  expect(await blockIds(page)).not.toContain("wicket");
  await expect(page.getByTestId("wicket-figure")).toHaveCount(0);
});

// ---------------- phone, themes, motion ----------------

test("at phone width the section fits and the page does not scroll sideways", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await open(page, 40);
  await playToEnd(page);
  await openTab(page, "final-test");
  const sizes = await page.evaluate(() => {
    const box = document.querySelector('[data-testid="explanation"]')!.getBoundingClientRect();
    return { box: box.right, page: document.documentElement.scrollWidth, window: window.innerWidth };
  });
  expect(sizes.box).toBeLessThanOrEqual(sizes.window + 0.5);
  expect(sizes.page).toBeLessThanOrEqual(sizes.window);
});

for (const scheme of ["light", "dark"] as const) {
  test(`the badge, bars and strip are drawn in the ${scheme} theme with text that contrasts with its box`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: scheme });
    await open(page, 40);
    await playToEnd(page);
    await openTab(page, "final-test");
    const colours = await page.evaluate(() => {
      const css = (sel: string, prop: string) => getComputedStyle(document.querySelector(sel) as Element).getPropertyValue(prop);
      return { badgeText: css('[data-testid="verdict-badge"]', "color"), badgeBg: css('[data-testid="verdict-badge"]', "background-color"),
               bar: css(".bar", "border-top-color"), strip: css(".year-seg.test", "border-top-color"),
               blockBg: css(".cricket-block", "background-color"), text: css(".block-sentence", "color") };
    });
    expect(colours.badgeText).not.toBe(colours.badgeBg);
    expect(colours.text).not.toBe(colours.blockBg);
    expect(colours.bar).not.toBe(colours.blockBg);
    expect(colours.strip).not.toBe(colours.blockBg);
  });
}

test("nothing in the section is animated", async ({ page }) => {
  await open(page, 40);
  await playToEnd(page);
  await openTab(page, "final-test");
  const running = await page.getByTestId("explanation").evaluate((e) => (e as HTMLElement).getAnimations({ subtree: true }).length);
  expect(running).toBe(0);
  const transitions = await page.getByTestId("explanation").locator(".bar, .goal-badge, .year-seg").evaluateAll(
    (els) => els.map((el) => getComputedStyle(el).transitionDuration));
  for (const t of transitions) expect(["0s", ""]).toContain(t);
});
