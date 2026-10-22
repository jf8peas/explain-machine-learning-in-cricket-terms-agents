// The phone (feature 020, FR-014, SC-007): at 390 px both pages have no sideways scroll, every control is at least 44 px tall, the header
// is one row of icon buttons with their full names, and wide tables scroll inside their own box. Inline links inside a sentence are
// exempt from the size rule (they are text), as everywhere else.
import { expect, test, type Page } from "./fixtures";
import { finishRun } from "./helpers";

test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

/** Every control a finger could press, shadow roots included, that is on screen, with its height. */
async function controls(page: Page) {
  return page.evaluate(() => {
    const out: { what: string; height: number }[] = [];
    const visible = (el: Element) => {
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      return r.width > 0 && r.height > 0 && cs.visibility !== "hidden" && cs.display !== "none";
    };
    const inlineInText = (el: Element) => el.tagName === "A" && !!el.closest("p, li, dd, td, th, h1, h2, h3, figcaption") &&
      Array.from(el.parentElement?.childNodes ?? []).some((n) => n.nodeType === 3 && (n.textContent ?? "").trim() !== "") &&
      !el.classList.contains("pill-link") && !el.classList.contains("btn") && !el.classList.contains("about-link") && !el.classList.contains("sb-card");
    const walk = (root: ParentNode) => {
      root.querySelectorAll("button, select, summary, input:not([type=hidden]), a[href]").forEach((el) => {
        if (!visible(el) || inlineInText(el)) return;
        out.push({ what: `${el.tagName.toLowerCase()} ${(el.getAttribute("data-testid") || el.textContent || "").trim().slice(0, 40)}`, height: el.getBoundingClientRect().height });
      });
      root.querySelectorAll("*").forEach((el) => { if ((el as HTMLElement).shadowRoot) walk((el as HTMLElement).shadowRoot!); });
    };
    walk(document);
    return out;
  });
}
const noSideways = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);

for (const view of ["simple", "everything"] as const) {
  test(`the main page in the ${view} view has no sideways scroll and every control is at least 44 px tall`, async ({ page }) => {
    await page.goto(`/?interval=40${view === "everything" ? "&view=everything" : ""}`);
    await finishRun(page);
    await page.getByTestId("scorebook-card-models").click();
    expect(await noSideways(page)).toBe(true);
    const small = (await controls(page)).filter((c) => c.height < 43.5);
    expect(small, `controls under 44 px: ${JSON.stringify(small)}`).toEqual([]);
    await page.getByTestId("scorebook-card-data").click();
    await expect(page.getByTestId("data-count")).toContainText("Showing", { timeout: 20_000 });
    expect(await noSideways(page)).toBe(true);
  });

  test(`How this app was built in the ${view} view has no sideways scroll and every control is at least 44 px tall`, async ({ page }) => {
    await page.goto(`/under-the-hood.html${view === "everything" ? "?view=everything" : ""}`);
    await expect(page.getByTestId("fact-steps")).not.toHaveText("not available right now");
    await expect(page.locator("graph-replay [data-node]").first()).toBeVisible();
    expect(await noSideways(page)).toBe(true);
    const small = (await controls(page)).filter((c) => c.height < 43.5);
    expect(small, `controls under 44 px: ${JSON.stringify(small)}`).toEqual([]);
  });
}

test("the header is one row of the app name and three 44 px icon buttons, each with its full name, on both pages", async ({ page }) => {
  for (const url of ["/", "/under-the-hood.html"]) {
    await page.goto(url);
    const boxes = await Promise.all(["view-switch", url === "/" ? "link-under-the-hood" : "back-top", "link-feedback"].map(async (id) => (await page.getByTestId(id).boundingBox())!));
    const centres = boxes.map((b) => b.y + b.height / 2);
    expect(Math.max(...centres) - Math.min(...centres)).toBeLessThan(4);
    for (const b of boxes) { expect(b.width).toBeGreaterThanOrEqual(44); expect(b.height).toBeGreaterThanOrEqual(44); }
    await expect(page.getByTestId("view-switch")).toHaveAccessibleName("Show me everything");
    await expect(page.getByTestId("link-feedback")).toHaveAccessibleName("Feedback (opens the GitHub issues page in a new tab)");
    await expect(page.getByTestId(url === "/" ? "link-under-the-hood" : "back-top")).toHaveAccessibleName(url === "/" ? "How it was built" : "Back to the app");
    expect(await page.getByTestId("breadcrumb").evaluate((el) => (el as HTMLElement).innerText.trim())).toBe(url === "/" ? "Linear regression" : "Linear regression");
  }
});

test("a wide table scrolls inside its own box, not the page", async ({ page }) => {
  await page.goto("/under-the-hood.html?view=everything");
  await expect(page.getByTestId("calls-table")).toBeVisible();
  await expect(page.getByTestId("fact-steps")).not.toHaveText("not available right now");
  const box = page.getByTestId("calls-scroll");
  expect(await box.evaluate((el) => getComputedStyle(el).overflowX)).toBe("auto");
  expect(await noSideways(page)).toBe(true);
});
