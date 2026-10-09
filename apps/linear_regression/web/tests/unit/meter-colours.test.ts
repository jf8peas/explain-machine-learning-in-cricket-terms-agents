import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// The miss meter uses only the page's own colour variables. Against the card (--bg) in both themes: text at least 4.5:1,
// graphics (the marks, the line and the goal zone's border) at least 3:1. The zone's fill is decoration behind a bordered,
// labelled zone, so it is not held to a ratio. The tokens are read from index.html, so a change there is checked here.
const html = readFileSync("index.html", "utf8");

function blocks() {
  const root = [...html.matchAll(/:root\s*\{([^}]*)\}/g)].map((m) => m[1]);
  const pairs = (css: string) => Object.fromEntries([...css.matchAll(/--([\w-]+):\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()]));
  const light = pairs(root[0]);
  return { light, dark: { ...light, ...pairs(root[1]) } };
}

const lin = (c: number) => { const v = c / 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
const lum = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  return 0.2126 * lin((n >> 16) & 255) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255);
};
const contrast = (a: string, b: string) => { const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x); return (hi + 0.05) / (lo + 0.05); };

/** The token a CSS rule paints with, read from the stylesheet: `.meter-line { ... background: var(--muted) }`. */
function token(selector: string, property: string): string {
  const rule = new RegExp(`${selector.replace(/[.[\]=]/g, "\\$&")}\\s*\\{([^}]*)\\}`).exec(html);
  expect(rule, `a rule for ${selector}`).not.toBeNull();
  const declaration = new RegExp(`${property}:[^;]*var\\(--([\\w-]+)\\)`).exec(rule![1]);
  expect(declaration, `${selector} sets ${property} from a variable`).not.toBeNull();
  return declaration![1];
}

const TEXT = [
  ["the caption and the footer", ".meter-top", "color"],
  ["the know-nothing mark", ".meter-mark[data-mark=know_nothing]", "color"],
  ["the goal mark", ".meter-mark[data-mark=goal]", "color"],
  ["a mark's own colour", ".meter-mark", "color"],
  ["the footer", ".meter-footer", "color"],
  ["the chips", ".chip", "color"],
  ["the section headings", "details.intro-more summary", "color"],
] as const;
const GRAPHICS = [
  ["the number line", ".meter-line", "background"],
  ["the goal zone's border", ".meter-zone", "border"],
  ["the know-nothing mark", ".meter-mark[data-mark=know_nothing]", "color"],
  ["the goal mark", ".meter-mark[data-mark=goal]", "color"],
  ["a mark's own colour", ".meter-mark", "color"],
] as const;

describe("the miss meter's colours", () => {
  for (const theme of ["light", "dark"] as const) {
    it(`${theme}: text is at least 4.5:1 against the card`, () => {
      const vars = blocks()[theme];
      for (const [what, selector, property] of TEXT) {
        expect(contrast(vars[token(selector, property)], vars.bg), `${what} in ${theme}`).toBeGreaterThanOrEqual(4.5);
      }
    });
    it(`${theme}: marks, line and the zone's border are at least 3:1 against the card`, () => {
      const vars = blocks()[theme];
      for (const [what, selector, property] of GRAPHICS) {
        expect(contrast(vars[token(selector, property)], vars.bg), `${what} in ${theme}`).toBeGreaterThanOrEqual(3);
      }
    });
  }

  it("the card is drawn on the page's own background", () => {
    expect(token(".meter", "background")).toBe("bg");
  });
});
