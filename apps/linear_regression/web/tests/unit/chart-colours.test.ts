import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// The four chart colours are taken from the page's own colour variables (see web/index.html). Each must stand out
// against the card they are drawn on, in both themes: at least 3:1 (the WCAG minimum for graphics). The shape, not the
// colour, is what tells methods apart, but a mark that cannot be seen would be a bug anyway.
const html = readFileSync("index.html", "utf8");

/** The `--name: value` pairs in the first :root block (light) and in the dark one. */
function blocks() {
  const root = [...html.matchAll(/:root\s*\{([^}]*)\}/g)].map((m) => m[1]);
  const pairs = (css: string) => Object.fromEntries([...css.matchAll(/--([\w-]+):\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()]));
  const light = pairs(root[0]);
  const dark = { ...light, ...pairs(root[1]) };
  return { light, dark };
}

const lin = (c: number) => { const v = c / 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
const lum = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  return 0.2126 * lin((n >> 16) & 255) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255);
};
const contrast = (a: string, b: string) => { const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x); return (hi + 0.05) / (lo + 0.05); };

function resolve(vars: Record<string, string>, name: string): string {
  const value = vars[name];
  const alias = /^var\(--([\w-]+)\)$/.exec(value ?? "");
  return alias ? resolve(vars, alias[1]) : value;
}

const METHODS = ["know-nothing", "broadcaster", "llm", "forward"];

describe("the chart's method colours", () => {
  for (const theme of ["light", "dark"] as const) {
    it(`${theme}: each is a real colour and stands out against the card by at least 3:1`, () => {
      const vars = blocks()[theme];
      const card = resolve(vars, "surface");
      expect(card).toMatch(/^#[0-9a-f]{6}$/i);
      for (const m of METHODS) {
        expect(vars[`m-${m}`], `--m-${m} is defined`).toBeTruthy();
        const colour = resolve(vars, `m-${m}`);
        expect(colour, `--m-${m}`).toMatch(/^#[0-9a-f]{6}$/i);
        expect(contrast(colour, card), `${m} in ${theme}`).toBeGreaterThanOrEqual(3);
      }
    });
  }

  it("takes them from the page's existing colours, not from new ones", () => {
    const { light } = blocks();
    for (const m of METHODS) expect(light[`m-${m}`]).toMatch(/^var\(--(muted|text|accent|win)\)$/);
  });
});
