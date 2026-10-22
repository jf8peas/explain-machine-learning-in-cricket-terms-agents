import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { TOO_CLOSE_RUNS, examYears, fromTenths, shown, tenths, tooClose, yearsText } from "../../src/page/exam";

describe("tooClose", () => {
  it("calls the design's two gaps too close", () => {
    expect(tooClose(17.0, 17.4)).toBe(true);        // validation: rival 17.0, AI 17.4
    expect(tooClose(17.7, 17.8)).toBe(true);        // test: AI 17.7, rival 17.8
  });

  it("is not too close at exactly 0.5 and above", () => {
    expect(TOO_CLOSE_RUNS).toBe(0.5);
    expect(tooClose(17.0, 17.5)).toBe(false);
    expect(tooClose(17.0, 18.2)).toBe(false);       // 1.2
    expect(tooClose(10, 40)).toBe(false);
  });

  it("works on the displayed one-decimal scores, where the closest gaps are 0.4 (too close) and 0.5 (not)", () => {
    expect(tooClose(17.0, 17.4)).toBe(true);
    expect(tooClose(17.0, 17.5)).toBe(false);
    expect(tooClose(17.04, 17.44)).toBe(true);      // shown 17.0 and 17.4
    expect(tooClose(17.04, 17.46)).toBe(false);     // shown 17.0 and 17.5: the page shows a gap of 0.5
    expect(tooClose(17.049, 17.451)).toBe(false);   // raw gap 0.402, but shown 17.0 and 17.5
    expect(tooClose(17.05, 17.44)).toBe(true);      // raw gap 0.39; shown 17.1 and 17.4
  });

  it("is symmetric, exact at the boundary despite floating point, and true for equal scores", () => {
    expect(tooClose(17.8, 17.3)).toBe(false);       // 17.8 - 17.3 is 0.5000000000000036 in floating point
    expect(tooClose(17.3, 17.8)).toBe(false);
    expect(tooClose(17.4, 17.0)).toBe(tooClose(17.0, 17.4));
    expect(tooClose(21.6, 21.6)).toBe(true);
    expect(tooClose(0.1, 0.5)).toBe(true);
    expect(tooClose(0.0, 0.5)).toBe(false);
  });
});

describe("the tenths helpers", () => {
  it("round to one decimal as the page shows", () => {
    expect(tenths(12.34)).toBe(123);
    expect(tenths(12.3)).toBe(123);
    expect(fromTenths(123)).toBe("12.3");
    expect(shown(17.04)).toBe("17.0");
  });
});

describe("examYears", () => {
  it("gives the check years, the first and last, and the test year", () => {
    const y = examYears({ first_year: 2005, checks: [{ year: 2023 }, { year: 2024 }, { year: 2025 }], test_year: 2026 })!;
    expect(y).toEqual({ checks: [2023, 2024, 2025], first: 2023, last: 2025, test: 2026 });
    expect(yearsText(y)).toBe("2023–2025");
  });

  it("copes with one check season and with no split", () => {
    const one = examYears({ first_year: 2005, checks: [{ year: 2025 }], test_year: 2026 })!;
    expect(yearsText(one)).toBe("2025");
    expect(examYears(undefined)).toBeUndefined();
    expect(examYears({ first_year: 2005, checks: [], test_year: 2026 })).toBeUndefined();
  });
});

function sourceFiles(dir: string, ext: string[]): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (name === "node_modules" || name === "__pycache__" || name === ".venv") return [];
    return statSync(path).isDirectory() ? sourceFiles(path, ext) : ext.some((e) => name.endsWith(e)) ? [path] : [];
  });
}

describe("where the threshold lives", () => {
  const web = fileURLToPath(new URL("../../src", import.meta.url));
  const backend = fileURLToPath(new URL("../../../backend", import.meta.url));

  it("is defined once in the browser source", () => {
    const defs = sourceFiles(web, [".ts"]).filter((f) => /TOO_CLOSE_RUNS\s*=\s*0\.5/.test(readFileSync(f, "utf8")));
    expect(defs.map((f) => f.replace(/\\/g, "/").split("/src/")[1])).toEqual(["page/exam.ts"]);
  });

  // Feature 020: the server words the agent-vs-search sentence ("matched … using just N tries"), so it must decide "too close to
  // call" for that one sentence. It holds the rule in one place, with the same value, and nowhere else.
  it("is held by the server only in headlines.py, with the same value", () => {
    const holders = sourceFiles(backend, [".py"]).filter((f) => /TOO_CLOSE|too_close|too close to call/i.test(readFileSync(f, "utf8")));
    expect(holders.map((f) => f.replace(/\\/g, "/").split("/backend/")[1])).toEqual(["linreg/headlines.py"]);
    expect(readFileSync(holders[0], "utf8")).toMatch(/TOO_CLOSE_RUNS\s*=\s*0\.5\b/);
  });
});
