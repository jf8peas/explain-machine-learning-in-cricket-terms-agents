import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  EXPLANATIONS,
  buildFigures,
  numberWord,
  type DataResponse,
  type ReferenceResponse,
} from "../../src/page/under-the-hood/figures";

// Recorded from the running app: the summary of /api/data and the whole of /api/reference.
const data: DataResponse = JSON.parse(readFileSync("tests/fixtures/under-the-hood-data-summary.json", "utf8"));
const reference: ReferenceResponse = JSON.parse(readFileSync("tests/fixtures/under-the-hood-reference.json", "utf8"));

const rows = (title: string) => data.summary!.sections!.find((s) => s.title === title)!.rows!;
const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x));

describe("the page's figures from the served responses", () => {
  const figures = buildFigures(data, reference);

  it("show exactly what the server sent for the data", () => {
    const headline = data.summary!.headline!;
    expect(figures.totalInnings).toBe(headline.find((r) => r.label === "Innings")!.value);
    expect(figures.dateRange).toBe(headline.find((r) => r.label === "Dates")!.value);
    expect(figures.downloaded).toBe(headline.find((r) => r.label === "Downloaded from Cricsheet")!.value);
    expect(figures.testPopulation).toBe(rows("Test population").find((r) => r.label === "In the test population")!.value);
    expect(figures.competitions).toEqual(rows("Innings per competition").map((r) => ({ name: r.label, innings: r.value })));
  });

  it("list every served exclusion in order with its count", () => {
    expect(figures.exclusions!.map((e) => [e.label, e.count])).toEqual(rows("Excluded, and why").map((r) => [r.label, r.value]));
  });

  it("add up the served exclusion counts", () => {
    const sum = rows("Excluded, and why").reduce((n, r) => n + Number(r.value!.replace(/,/g, "")), 0);
    expect(figures.excludedTotal).toBe(sum.toLocaleString("en-US"));
  });

  it("explain the reasons the page knows and leave an unknown one as label and count", () => {
    const withUnknown = clone(data);
    withUnknown.summary!.sections!.find((s) => s.title === "Excluded, and why")!.rows!.push({ label: "Something new", value: "3" });
    const result = buildFigures(withUnknown, reference).exclusions!;
    expect(result.find((e) => e.label === "Rain-affected (DLS)")!.explanation).toBe(EXPLANATIONS["Rain-affected (DLS)"]);
    expect(result.find((e) => e.label === "Something new")).toEqual({ label: "Something new", count: "3" });
  });

  it("do not invent a reason the server left out", () => {
    const trimmed = clone(data);
    const section = trimmed.summary!.sections!.find((s) => s.title === "Excluded, and why")!;
    section.rows = section.rows!.filter((r) => r.label !== "No result");
    const labels = buildFigures(trimmed, reference).exclusions!.map((e) => e.label);
    expect(labels).not.toContain("No result");
    expect(labels).toHaveLength(rows("Excluded, and why").length - 1);
  });

  it("show the reference period, the two average misses, the bias and the goal as served", () => {
    expect(figures.refInnings).toBe(reference.training!.innings!.toLocaleString("en-US"));
    expect(figures.refFirstYear).toBe(String(reference.training!.first_year));
    expect(figures.refLastYear).toBe(String(reference.training!.last_year));
    expect(figures.knowNothingMiss).toBe(reference.figures!.know_nothing!.average_miss!.toFixed(1));
    expect(figures.tvMiss).toBe(reference.figures!.broadcaster!.average_miss!.toFixed(1));
    expect(figures.goalMargin).toBe(String(reference.goal!.margin_runs));
  });

  it("word the broadcaster's bias from its sign", () => {
    const low = buildFigures(data, { figures: { broadcaster: { bias: -14.3 } } });
    expect([low.tvBias, low.tvBiasWords]).toEqual(["14.3", "too low"]);
    const high = buildFigures(data, { figures: { broadcaster: { bias: 2.04 } } });
    expect([high.tvBias, high.tvBiasWords]).toEqual(["2.0", "too high"]);
    const none = buildFigures(data, { figures: { broadcaster: { bias: 0 } } });
    expect(none.tvBias).toBeUndefined();
    expect(none.tvBiasWords).toBeUndefined();
  });
});

describe("a failure leaves figures out and never throws", () => {
  it("when nothing could be loaded", () => {
    expect(buildFigures(undefined, undefined)).toEqual({});
    expect(buildFigures(null, null)).toEqual({});
  });

  it("when the data fails but the reference loads", () => {
    const f = buildFigures(undefined, reference);
    expect(f.totalInnings).toBeUndefined();
    expect(f.exclusions).toBeUndefined();
    expect(f.excludedTotal).toBeUndefined();
    expect(f.tvMiss).toBeDefined();
  });

  it("when the reference loads without its figures (the server's message case)", () => {
    const f = buildFigures(data, { training: null, figures: null, goal: { margin_runs: 3 } });
    expect(f.refInnings).toBeUndefined();
    expect(f.tvMiss).toBeUndefined();
    expect(f.goalMargin).toBe("3");
    expect(f.totalInnings).toBeDefined();
  });

  it("when a section or a row is missing", () => {
    const noPopulation = clone(data);
    noPopulation.summary!.sections = noPopulation.summary!.sections!.filter((s) => s.title !== "Test population");
    expect(buildFigures(noPopulation, reference).testPopulation).toBeUndefined();
    const noDates = clone(data);
    noDates.summary!.headline = noDates.summary!.headline!.filter((r) => r.label !== "Dates");
    expect(buildFigures(noDates, reference).dateRange).toBeUndefined();
    expect(buildFigures({ summary: {} }, {})).toEqual({});
  });

  it("leaves the total out when a count does not parse", () => {
    const odd = clone(data);
    odd.summary!.sections!.find((s) => s.title === "Excluded, and why")!.rows![0].value = "lots";
    const f = buildFigures(odd, reference);
    expect(f.excludedTotal).toBeUndefined();
    expect(f.exclusions).toHaveLength(rows("Excluded, and why").length);
  });
});

describe("the explanations", () => {
  it("are keyed by labels the server really uses", () => {
    const source = readFileSync("../backend/linreg/data_table.py", "utf8");
    const block = source.slice(source.indexOf("EXCLUSION_LABELS = {"));
    const labels = [...block.slice(0, block.indexOf("}")).matchAll(/:\s*"([^"]+)"/g)].map((m) => m[1]);
    expect(labels.length).toBeGreaterThanOrEqual(7);
    for (const key of Object.keys(EXPLANATIONS)) expect(labels).toContain(key);
  });
});

// ---------------- feature 020: the counts and the gate's limits, from the structure, the catalogue and the models list ----------------

const structure = JSON.parse(readFileSync("tests/fixtures/linreg-structure.json", "utf8"));
const catalogue = { features: Array.from({ length: 19 }, (_, i) => ({ id: `f${i}` })) };
const models = { run: { per_hour: 5, per_day: 300, deadline_seconds: 80 } };

describe("the counted facts and the gate's limits", () => {
  const figures = buildFigures(data, reference, { structure, catalogue, models });

  it("count the agent's steps and the ones that use a language model from the structure, not counting start and end", () => {
    expect(figures.agentSteps).toBe("12");
    expect(figures.llmSteps).toBe("2");
    expect(figures.stepsWord).toBe("Twelve");
  });

  it("count the clues from the catalogue", () => {
    expect(figures.clues).toBe("19");
  });

  it("read the gate's limits from the models list", () => {
    expect(figures.perHour).toBe("5");
    expect(figures.perDay).toBe("300");
    expect(figures.deadline).toBe("80");
  });

  it("leave out whatever source is missing, and only that", () => {
    const none = buildFigures(data, reference, { structure: null, catalogue: undefined, models: { run: { per_hour: 5 } } });
    expect(none.agentSteps).toBeUndefined();
    expect(none.llmSteps).toBeUndefined();
    expect(none.clues).toBeUndefined();
    expect(none.perHour).toBe("5");
    expect(none.perDay).toBeUndefined();
    expect(none.totalInnings).toBeDefined();
    expect(Object.keys(buildFigures(undefined, undefined))).toEqual([]);
  });

  it("do not count a structure with no steps or a catalogue with no clues", () => {
    const empty = buildFigures(undefined, undefined, { structure: { nodes: [{ kind: "start" }, { kind: "end" }] }, catalogue: { features: [] } });
    expect(empty.agentSteps).toBeUndefined();
    expect(empty.clues).toBeUndefined();
  });
});

describe("a count in words for a heading", () => {
  it("capitalises the word up to twenty and uses digits after", () => {
    expect(numberWord(12)).toBe("Twelve");
    expect(numberWord(1)).toBe("One");
    expect(numberWord(20)).toBe("Twenty");
    expect(numberWord(21)).toBe("21");
    expect(numberWord(-1)).toBe("-1");
    expect(numberWord(2.5)).toBe("2.5");
  });
});
