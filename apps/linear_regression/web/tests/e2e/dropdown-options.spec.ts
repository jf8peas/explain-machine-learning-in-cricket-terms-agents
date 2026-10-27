// Issue 20: the options of every dropdown have text and a background that contrast (light and dark theme), because the browser draws the open list from them.
import { expect, test } from "./fixtures";
import { toPlayer } from "./helpers";

const channels = (c: string) => (c.match(/[\d.]+/g) ?? []).map(Number);
const lum = (c: string) => { const [r, g, b] = channels(c).map((v) => { const x = v / 255; return x <= .03928 ? x / 12.92 : ((x + .055) / 1.055) ** 2.4; }); return .2126 * r + .7152 * g + .0722 * b; };
const ratio = (a: string, b: string) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + .05) / (y + .05); };

for (const scheme of ["light", "dark"] as const) {
  test(`every dropdown option is at least 4.5:1 in the ${scheme} theme`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: scheme });
    await page.goto("/?view=everything");
    await toPlayer(page);
    const options = await page.evaluate(() => [...document.querySelectorAll("select")].flatMap((sel) =>
      [...sel.options].map((o) => { const s = getComputedStyle(o); return { select: sel.closest("[data-testid]")?.getAttribute("data-testid") ?? sel.className, text: o.text, color: s.color, background: s.backgroundColor }; })));
    expect(options.length).toBeGreaterThan(3);
    for (const o of options) {
      expect(channels(o.background)[3] ?? 1, `${o.select}: ${o.text} has a see-through background`).toBe(1);   // the list is drawn from this colour, so it must be opaque
      expect(ratio(o.color, o.background), `${o.select}: ${o.text}`).toBeGreaterThanOrEqual(4.5);
    }
  });
}
