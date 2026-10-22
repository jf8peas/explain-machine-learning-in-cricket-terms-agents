import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// The graph component is for any app (feature 020, FR-008): row titles and notes, node and stage names all come from the
// structure. No cricket or regression word may be written into it.
const dir = fileURLToPath(new URL("../../src/graph-replay", import.meta.url));
const FORBIDDEN = /cricket|innings|wicket|\bovers?\b|batting|bowling|regression|coefficient|intercept|broadcaster|\bTV\b|\bpropose|check_proposal|fit_model|grid_search|final_test/i;

describe("the graph component holds no word from this app", () => {
  for (const name of readdirSync(dir).filter((n) => n.endsWith(".ts"))) {
    it(name, () => {
      const code = readFileSync(join(dir, name), "utf8");
      const hit = code.split("\n").map((line, i) => ({ line, n: i + 1 })).filter(({ line }) => FORBIDDEN.test(line));
      expect(hit.map(({ n, line }) => `${name}:${n}: ${line.trim()}`)).toEqual([]);
    });
  }
});
