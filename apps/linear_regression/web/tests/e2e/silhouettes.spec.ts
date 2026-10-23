// The cricket silhouettes (feature 024): a bowler behind the hero band and a batter over the run-by-over chart. Decoration only: they are
// measured here as empty hidden elements, so nothing is read off pixels. Uses the scripted fake models and the page's own level switch.
import { expect, test, type Page } from "./fixtures";

interface Box { x: number; y: number; width: number; height: number }
const box = async (page: Page, id: string): Promise<Box> => {
  const b = await page.getByTestId(id).evaluate((el) => { const r = el.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; });
  return b;
};
const everything = async (page: Page) => { if ((await page.evaluate(() => document.body.dataset.view)) !== "everything") await page.getByTestId("view-switch").click(); };
const simple = async (page: Page) => { if ((await page.evaluate(() => document.body.dataset.view)) !== "simple") await page.getByTestId("view-switch").click(); };
const open = async (page: Page, width: number, height: number) => {
  await page.setViewportSize({ width, height });
  await page.goto("/");
  await expect(page.getByTestId("hero-title")).toBeVisible();
  await expect(page.getByTestId("silhouette-bowler")).toBeAttached();
};
const noSideways = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

const SIZES = [{ width: 390, height: 664 }, { width: 1280, height: 800 }];

test.describe("the bowler", () => {
  for (const s of SIZES) {
    test(`is the same box at the simple and "Show me everything" levels at ${s.width} wide`, async ({ page }) => {
      await open(page, s.width, s.height);
      await simple(page);
      const a = await box(page, "silhouette-bowler");
      await everything(page);
      const b = await box(page, "silhouette-bowler");
      expect(b).toEqual(a);
    });
  }

  for (const width of [390, 700, 1024, 1280]) {
    test(`is about 94% of the band's height at "Show me everything" at ${width} wide`, async ({ page }) => {
      await open(page, width, 800);
      await everything(page);
      const ratio = (await box(page, "silhouette-bowler")).height / (await box(page, "hero")).height;
      expect(ratio).toBeGreaterThan(0.89);
      expect(ratio).toBeLessThan(0.99);
    });
  }

  for (const s of SIZES) {
    test(`shows about his top half at the simple level at ${s.width} wide`, async ({ page }) => {
      await open(page, s.width, s.height);
      await simple(page);
      const bowler = await box(page, "silhouette-bowler"), band = await box(page, "hero");
      const shown = (band.y + band.height - bowler.y) / bowler.height;
      expect(shown).toBeGreaterThan(0.45);
      expect(shown).toBeLessThan(0.7);
    });
  }

  test("on a phone: his head is inside the band, he covers it edge to edge and starts 30 px down", async ({ page }) => {
    await open(page, 390, 664);
    for (const level of [simple, everything]) {
      await level(page);
      const bowler = await box(page, "silhouette-bowler"), band = await box(page, "hero");
      expect(bowler.x).toBeLessThanOrEqual(band.x + 0.5);
      expect(bowler.x + bowler.width).toBeGreaterThanOrEqual(band.x + band.width - 0.5);
      const focal = bowler.x + 0.3 * bowler.width;
      expect(focal).toBeGreaterThan(band.x);
      expect(focal).toBeLessThan(band.x + band.width);
      expect(bowler.y - band.y).toBeCloseTo(30, 0);
      expect(bowler.width).toBeGreaterThan(band.width);                 // he keeps his height: cropped, not shrunk
    }
  });

  test("on a wide screen: he is centred in the band", async ({ page }) => {
    await open(page, 1280, 800);
    const bowler = await box(page, "silhouette-bowler"), band = await box(page, "hero");
    expect(bowler.x + bowler.width / 2).toBeCloseTo(band.x + band.width / 2, 0);
    expect(bowler.width).toBeLessThan(band.width);
  });

  for (const scheme of ["light", "dark"] as const) {
    test(`the question, goal and Start button fit 390 × 664 with no sideways scroll in the ${scheme} theme, at both levels`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme });
      await open(page, 390, 664);
      for (const level of [simple, everything]) {
        await level(page);
        expect(await noSideways(page)).toBeLessThanOrEqual(0);
      }
      await simple(page);
      for (const id of ["hero-title", "goal-sentence", "start-experiment"]) {
        const b = (await page.getByTestId(id).boundingBox())!;
        expect(b.y + b.height, id).toBeLessThanOrEqual(664);
      }
    });
  }
});

test.describe("both silhouettes are only decoration", () => {
  async function openWithChart(page: Page, width = 390, height = 664) {
    await page.setViewportSize({ width, height });
    await page.goto("/?view=everything");
    await expect(page.getByTestId("worm-card")).toBeVisible();
    await expect(page.getByTestId("silhouette-batter")).toBeAttached();
  }

  test("they are empty, hidden from assistive technology, not focusable, ignore the pointer and are not printed", async ({ page }) => {
    await openWithChart(page);
    for (const id of ["silhouette-bowler", "silhouette-batter"]) {
      const el = page.getByTestId(id);
      await expect(el).toHaveAttribute("aria-hidden", "true");
      expect(await el.evaluate((n) => n.childNodes.length)).toBe(0);
      expect(await el.evaluate((n) => (n.textContent ?? "").length)).toBe(0);
      expect(await el.evaluate((n) => n.hasAttribute("tabindex"))).toBe(false);
      expect(await el.evaluate((n) => { (n as HTMLElement).focus(); return document.activeElement === n; })).toBe(false);
      expect(await el.evaluate((n) => getComputedStyle(n).pointerEvents)).toBe("none");
      expect(await el.evaluate((n) => getComputedStyle(n).position)).toBe("absolute");
    }
    await page.emulateMedia({ media: "print" });
    for (const id of ["silhouette-bowler", "silhouette-batter"]) {
      expect(await page.getByTestId(id).evaluate((n) => getComputedStyle(n).display)).toBe("none");
    }
  });

  for (const s of SIZES) {
    test(`they shift nothing: every other box is the same without them at ${s.width} wide`, async ({ page }) => {
      await openWithChart(page, s.width, s.height);
      const boxes = () => page.evaluate(() => [...document.querySelectorAll("[data-testid]")]
        .filter((el) => !el.matches(".silhouette"))
        .map((el) => { const r = el.getBoundingClientRect(); return `${el.getAttribute("data-testid")}:${r.x},${r.y},${r.width},${r.height}`; }));
      for (const level of [everything, simple]) {
        await level(page);
        const shown = await boxes();
        await page.addStyleTag({ content: ".silhouette { display: none !important; }" });
        const hidden = await boxes();
        expect(hidden).toEqual(shown);
        await page.reload();
        await page.getByTestId("hero-title").waitFor();
      }
    });
  }
});

test.describe("the batter", () => {
  async function openChart(page: Page, width: number, height: number) {
    await page.setViewportSize({ width, height });
    await page.goto("/?view=everything");
    await expect(page.getByTestId("worm-card")).toBeVisible();
    await expect(page.getByTestId("worm-chart").locator("svg").first()).toBeVisible();
  }

  test("on a phone: his whole figure is inside the chart card and no sideways scroll", async ({ page }) => {
    await openChart(page, 390, 664);
    const batter = await box(page, "silhouette-batter"), card = await box(page, "worm-card");
    expect(batter.x).toBeGreaterThanOrEqual(card.x);
    expect(batter.x + batter.width).toBeLessThanOrEqual(card.x + card.width + 0.5);
    expect(batter.y).toBeGreaterThanOrEqual(card.y);
    expect(batter.y + batter.height).toBeLessThanOrEqual(card.y + card.height + 0.5);
    // the overlay is the chart area's box; the drawn shape is "contain"ed inside it, so it can only be smaller
    const chart = await box(page, "worm-chart");
    expect(batter.height).toBeCloseTo(chart.height * 0.95, 0);
    expect(await noSideways(page)).toBeLessThanOrEqual(0);
  });

  test("on a wide screen: he is 95% of the chart area's height and centred", async ({ page }) => {
    await openChart(page, 1280, 800);
    const batter = await box(page, "silhouette-batter"), chart = await box(page, "worm-chart");
    expect(batter.height).toBeCloseTo(chart.height * 0.95, 0);
    expect(batter.x + batter.width / 2).toBeCloseTo(chart.x + chart.width / 2, 0);
  });

  test("opening and closing About this chart does not move or resize him", async ({ page }) => {
    await openChart(page, 390, 664);
    // measured against the chart area, because opening the text can scroll the page
    const rel = async () => { const b = await box(page, "silhouette-batter"), c = await box(page, "worm-chart"); return { x: b.x - c.x, y: b.y - c.y, width: b.width, height: b.height }; };
    const before = await rel();
    await page.getByTestId("worm-card").locator("summary").click();
    await expect(page.getByTestId("worm-caption")).toBeVisible();
    expect(await rel()).toEqual(before);
    await page.getByTestId("worm-card").locator("summary").click();
    expect(await rel()).toEqual(before);
  });

  for (const scheme of ["light", "dark"] as const) {
    test(`is blended with ${scheme === "light" ? "multiply" : "screen"} in the ${scheme} theme, in the text colour, with no sideways scroll`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme });
      await openChart(page, 390, 664);
      const style = await page.getByTestId("silhouette-batter").evaluate((n) => {
        const cs = getComputedStyle(n);
        return { blend: cs.mixBlendMode, bg: cs.backgroundColor, text: getComputedStyle(document.body).color, opacity: cs.opacity };
      });
      expect(style.blend).toBe(scheme === "light" ? "multiply" : "screen");
      expect(style.bg).toBe(style.text);
      expect(Number(style.opacity)).toBeCloseTo(0.07, 2);
      expect(await noSideways(page)).toBeLessThanOrEqual(0);
    });
  }

  test("the chart itself is unchanged: its label, test ids and drawing are as before", async ({ page }) => {
    await openChart(page, 1280, 800);
    const ref = await (await page.request.get("/api/reference")).json();
    await expect(page.getByTestId("worm-chart").locator("svg").first()).toHaveAttribute("aria-label", ref.hero.chart_text);
    await expect(page.getByTestId("worm-chart-svg")).toHaveCount(1);
    await expect(page.getByTestId("worm-caption")).toBeAttached();
  });
});

test("the bowler's colour and strength are the same in both themes (the band is dark in both)", async ({ page }) => {
  const read = async (scheme: "light" | "dark") => {
    await page.emulateMedia({ colorScheme: scheme });
    await open(page, 390, 664);
    return page.getByTestId("silhouette-bowler").evaluate((n) => { const cs = getComputedStyle(n); return `${cs.backgroundColor}|${cs.opacity}`; });
  };
  const light = await read("light");
  expect(light).toBe(await read("dark"));
  expect(light).toBe("rgb(203, 213, 225)|0.09");
});
