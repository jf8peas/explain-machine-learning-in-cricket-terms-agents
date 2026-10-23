import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// The cricket silhouettes (feature 024) are painted from alpha-mask shape files with colour tokens: the colour lives in theme.css, never in the
// shape file or as a literal in silhouette.css, and the shapes carry no text.
const theme = readFileSync("src/page/theme.css", "utf8");
const css = readFileSync("src/page/silhouette.css", "utf8");
const SHAPES = ["bowler-silhouette.svg", "batter-silhouette.svg"];

describe("the silhouette tokens", () => {
  const roots = [...theme.matchAll(/:root\s*\{([^}]*)\}/g)].map((m) => m[1]);
  it("define the strengths and colours in the light block", () => {
    for (const token of ["--silhouette", "--silhouette-alpha", "--silhouette-blend", "--silhouette-on-dark", "--silhouette-on-dark-alpha"]) {
      expect(roots[0], token).toMatch(new RegExp(`${token}:`));
    }
    expect(roots[0]).toMatch(/--silhouette:\s*var\(--text\)/);
    expect(roots[0]).toMatch(/--silhouette-alpha:\s*\.07/);
    expect(roots[0]).toMatch(/--silhouette-on-dark:\s*#cbd5e1/i);
    expect(roots[0]).toMatch(/--silhouette-on-dark-alpha:\s*\.09/);
  });
  it("blend with multiply on light and screen on dark", () => {
    expect(roots[0]).toMatch(/--silhouette-blend:\s*multiply/);
    expect(roots[1]).toMatch(/--silhouette-blend:\s*screen/);
  });
});

describe("silhouette.css", () => {
  it("holds no colour literal: colour comes from the tokens", () => {
    const code = css.replace(/\/\*[\s\S]*?\*\//g, "");
    expect(code).not.toMatch(/#[0-9a-f]{3,8}\b/i);
    expect(code).not.toMatch(/rgba?\(/);
    expect(code).toMatch(/var\(--silhouette-on-dark\)/);
    expect(code).toMatch(/var\(--silhouette\)/);
  });
  it("references both shape files, and they exist", () => {
    for (const file of SHAPES) {
      expect(css).toContain(`./silhouettes/${file}`);
      expect(existsSync(`src/page/silhouettes/${file}`), file).toBe(true);
    }
  });
  it("hides the silhouettes when printed and ignores the pointer", () => {
    expect(css).toMatch(/@media print\s*\{\s*\.silhouette\s*\{\s*display:\s*none/);
    expect(css).toMatch(/pointer-events:\s*none/);
  });
});

describe("the shape files", () => {
  for (const file of SHAPES) {
    it(`${file} is a shape with no text and no embedded picture`, () => {
      const svg = readFileSync(`src/page/silhouettes/${file}`, "utf8");
      expect(svg).toMatch(/^<svg\b/);
      expect(svg).not.toMatch(/<text\b/);
      expect(svg).not.toMatch(/<image\b/);
    });
  }
});
