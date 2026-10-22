// Show me everything (feature 020): one switch in the header opens every Commentary panel; the choice is remembered, works without
// storage, and a link with ?view=everything opens it. Opening a panel never moves the reader.
import { expect, test, type Page } from "./fixtures";

async function open(page: Page, query = "") {
  await page.goto(`/${query}`);
  await expect(page.getByTestId("hero-title")).toBeVisible();
}
const commentary = (page: Page) => page.locator(".commentary");
const visibleCount = async (page: Page) => (await commentary(page).evaluateAll((els) => els.filter((e) => getComputedStyle(e).display !== "none").length));

test("the switch is a pressed-state button that reads Show me everything, then Simple view", async ({ page }) => {
  await open(page);
  const sw = page.getByTestId("view-switch");
  await expect(sw).toHaveRole("button");
  await expect(sw).toHaveAttribute("aria-pressed", "false");
  await expect(sw).toHaveText("Show me everything");
  expect((await sw.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  await sw.click();
  await expect(sw).toHaveAttribute("aria-pressed", "true");
  await expect(sw).toHaveText("Simple view");
  await expect(sw).toHaveAccessibleName("Simple view");
  await sw.click();
  await expect(sw).toHaveAttribute("aria-pressed", "false");
  await expect(sw).toHaveAccessibleName("Show me everything");
});

test("every Commentary panel is closed to begin with, opens with the switch, and closes with it again", async ({ page }) => {
  await open(page);
  expect(await commentary(page).count()).toBeGreaterThanOrEqual(4);
  expect(await visibleCount(page)).toBe(0);
  await page.getByTestId("view-switch").click();
  await expect(page.locator("body")).toHaveAttribute("data-view", "everything");
  expect(await visibleCount(page)).toBe(await commentary(page).count());
  for (const toggle of await page.locator("[data-commentary-toggle]").all()) await expect(toggle).toHaveAttribute("aria-expanded", "true");
  await page.getByTestId("view-switch").click();
  await expect(page.locator("body")).toHaveAttribute("data-view", "simple");
  expect(await visibleCount(page)).toBe(0);
  for (const toggle of await page.locator("[data-commentary-toggle]").all()) await expect(toggle).toHaveAttribute("aria-expanded", "false");
});

test("a section's own toggle opens just its panel, with its state exposed, and the switch does not undo it", async ({ page }) => {
  await open(page);
  const toggle = page.getByTestId("graph-toggle");
  await expect(toggle).toHaveAttribute("aria-controls", "graph-panel");
  await toggle.click();
  await expect(page.getByTestId("graph-panel")).toBeVisible();
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  await expect(page.getByTestId("hero-commentary")).toBeHidden();
  await page.getByTestId("view-switch").click();
  await page.getByTestId("view-switch").click();
  await expect(page.getByTestId("graph-panel")).toBeVisible();                // the visitor's own choice survives the switch
  await toggle.click();
  await expect(page.getByTestId("graph-panel")).toBeHidden();
});

test("the choice is remembered across a reload", async ({ page }) => {
  await open(page);
  await page.getByTestId("view-switch").click();
  await page.reload();
  await expect(page.getByTestId("hero-title")).toBeVisible();
  await expect(page.getByTestId("view-switch")).toHaveAttribute("aria-pressed", "true");
  expect(await visibleCount(page)).toBe(await commentary(page).count());
  await page.getByTestId("view-switch").click();
  await page.reload();
  await expect(page.getByTestId("view-switch")).toHaveAttribute("aria-pressed", "false");
});

test("?view=everything opens the detailed view, and it is remembered afterwards", async ({ page }) => {
  await open(page, "?view=everything");
  await expect(page.getByTestId("view-switch")).toHaveAttribute("aria-pressed", "true");
  expect(await visibleCount(page)).toBe(await commentary(page).count());
  await open(page);
  await expect(page.getByTestId("view-switch")).toHaveAttribute("aria-pressed", "true");
});

test("the page starts at the level in the link or the remembered one before its script has run, so nothing flashes", async ({ page }) => {
  await page.route("**/src/page/main.ts*", (route) => route.abort());          // the page's script never loads
  await page.goto("/?view=everything");
  await expect(page.locator("body")).toHaveAttribute("data-view", "everything");
  await page.addInitScript(() => window.localStorage.setItem("linreg:view", "everything"));
  await page.goto("/");
  await expect(page.locator("body")).toHaveAttribute("data-view", "everything");
  await page.evaluate(() => window.localStorage.setItem("linreg:view", "simple"));
  await page.addInitScript(() => window.localStorage.setItem("linreg:view", "simple"));
  await page.goto("/");
  await expect(page.locator("body")).toHaveAttribute("data-view", "simple");
});

test("with storage blocked the switch still works for the page", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, "localStorage", { get() { throw new Error("blocked"); } });
  });
  await open(page);
  await page.getByTestId("view-switch").click();
  await expect(page.getByTestId("view-switch")).toHaveAttribute("aria-pressed", "true");
  expect(await visibleCount(page)).toBe(await commentary(page).count());
  await expect(page.getByTestId("hero-title")).toBeVisible();                   // and the page works
});

test("opening a Commentary panel does not move the reader: the content opens below its toggle", async ({ page }) => {
  await open(page);
  for (const id of ["live-toggle", "graph-toggle"]) {
    const toggle = page.getByTestId(id);
    await toggle.scrollIntoViewIfNeeded();
    const before = (await toggle.boundingBox())!.y;
    await toggle.click();
    const panel = page.locator(`#${await toggle.getAttribute("aria-controls")}`);
    await expect(panel).toBeVisible();
    expect((await toggle.boundingBox())!.y).toBeCloseTo(before, 0);              // the toggle has not moved
    const t = (await toggle.boundingBox())!, p = (await panel.boundingBox())!;
    expect(p.y + p.height).toBeGreaterThan(t.y);                                // the panel is below it, or beside it, never above
    if (id === "graph-toggle") expect(p.y).toBeGreaterThanOrEqual(t.y + t.height - 1);
  }
});

test("the Scorebook is not opened by the switch", async ({ page }) => {
  await open(page, "?view=everything");
  const panel = page.getByTestId("scorebook-panel");
  expect(await panel.count() === 0 || !(await panel.isVisible())).toBe(true);
});
