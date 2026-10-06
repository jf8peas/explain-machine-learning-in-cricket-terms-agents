import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// The eight stage colours and the rules they were chosen under are recorded in specs/005-ml-stages/research.md
// (Decision 5). The expected values are written out here on purpose: changing a colour means changing both places.
const EXPECTED = {
  light: ["#8a5a00", "#5f7a00", "#00798a", "#8a4f7d", "#bb5400", "#a3246b", "#00695c", "#7a5c46"],
  dark: ["#b8863f", "#b5cf4a", "#4fd0e0", "#cf9bc2", "#ff9a3c", "#f06ab0", "#3fd0c8", "#d8b59a"],
};
const PAGE = { light: { bg: "#ffffff", panel: "#f6f7f9", text: "#ffffff" }, dark: { bg: "#12161d", panel: "#1b212b", text: "#12161d" } };

const css = readFileSync("src/graph-replay/styles.ts", "utf8");

/** Every value a token is given, in file order: light, then dark (system preference), then dark (data-theme override). */
function values(token: string): string[] {
  return [...css.matchAll(new RegExp(`${token}:\\s*(#[0-9a-fA-F]{6})`, "g"))].map((m) => m[1].toLowerCase());
}

const lin = (c: number) => { const v = c / 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
const lum = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  return 0.2126 * lin((n >> 16) & 255) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255);
};
const contrast = (a: string, b: string) => {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

describe("stage colour tokens", () => {
  for (const theme of ["light", "dark"] as const) {
    const index = theme === "light" ? [0] : [1, 2];

    it(`${theme}: the eight colours are the recorded ones and all differ`, () => {
      const got = [1, 2, 3, 4, 5, 6, 7, 8].map((n) => index.map((i) => values(`--gr-stage-${n}`)[i]));
      got.forEach((pair, k) => pair.forEach((v) => expect(v).toBe(EXPECTED[theme][k])));
      expect(new Set(EXPECTED[theme]).size).toBe(8);
    });

    it(`${theme}: the number is readable on the badge and the badge shows against the page and the panel`, () => {
      const text = index.map((i) => values("--gr-stage-text")[i]);
      text.forEach((t) => expect(t).toBe(PAGE[theme].text));
      for (const fill of EXPECTED[theme]) {
        expect(contrast(fill, PAGE[theme].text)).toBeGreaterThanOrEqual(4.5);
        expect(contrast(fill, PAGE[theme].bg)).toBeGreaterThanOrEqual(3);
        expect(contrast(fill, PAGE[theme].panel)).toBeGreaterThanOrEqual(3);
      }
    });
  }

  it("has a neutral token for an unassigned node, in both themes", () => {
    const neutral = values("--gr-stage-none");
    expect(neutral.length).toBeGreaterThanOrEqual(3);
    expect(neutral[0]).not.toBe(neutral[1]);
  });
});
