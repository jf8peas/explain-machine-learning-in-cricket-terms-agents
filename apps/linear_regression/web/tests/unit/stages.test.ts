import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import type { Structure } from "../../src/graph-replay/layout";
import { NEUTRAL_TOKEN, colourToken, loopEdges, resolveStage, roundAt, stageNumberOf, type StageDef } from "../../src/graph-replay/stages";

// A stage set that is not this app's: the helpers must work for any names and ids.
const stages: StageDef[] = [
  { id: "alpha", number: 1, name: "First", question: "Q1?", description: "One." },
  { id: "beta", number: 2, name: "Second", question: "Q2?", description: "Two." },
  { id: "gamma", number: 3, name: "Third", question: "Q3?", description: "Three." },
];

describe("resolveStage", () => {
  it("finds the stage of a node that names a known stage", () => {
    const r = resolveStage({ kind: "node", stage: "beta" }, stages);
    expect(r.state).toBe("assigned");
    if (r.state === "assigned") {
      expect(r.stage.name).toBe("Second");
      expect(r.number).toBe(2);
      expect(r.token).toBe("--gr-stage-2");
    }
  });

  it("treats a node with no stage, or an unknown stage, as unassigned", () => {
    expect(resolveStage({ kind: "node" }, stages).state).toBe("unassigned");
    expect(resolveStage({ kind: "node", stage: "nonsense" }, stages).state).toBe("unassigned");
  });

  it("gives start and end nodes no stage at all", () => {
    expect(resolveStage({ kind: "start" }, stages).state).toBe("none");
    expect(resolveStage({ kind: "end", stage: "alpha" }, stages).state).toBe("none");
  });

  it("shows no stages when the structure has none", () => {
    expect(resolveStage({ kind: "node", stage: "alpha" }, undefined).state).toBe("none");
    expect(resolveStage({ kind: "node" }, []).state).toBe("none");
  });

  it("numbers by position in the list, not by the number a response claims", () => {
    const odd: StageDef[] = [{ ...stages[1], number: 9 }, { ...stages[0], number: 9 }];
    expect(stageNumberOf(odd, "beta")).toBe(1);
    expect(stageNumberOf(odd, "alpha")).toBe(2);
    expect(stageNumberOf(odd, "missing")).toBeNull();
  });
});

describe("colourToken", () => {
  it("keys the eight colours by number and falls back to neutral above eight or below one", () => {
    expect(colourToken(1)).toBe("--gr-stage-1");
    expect(colourToken(8)).toBe("--gr-stage-8");
    expect(colourToken(9)).toBe(NEUTRAL_TOKEN);
    expect(colourToken(0)).toBe(NEUTRAL_TOKEN);
    expect(NEUTRAL_TOKEN).toBe("--gr-stage-none");
  });

  it("gives a stage number above eight the neutral colour when resolving", () => {
    const many: StageDef[] = Array.from({ length: 10 }, (_, i) => ({
      id: `s${i + 1}`, number: i + 1, name: `S${i + 1}`, question: "?", description: ".",
    }));
    const r = resolveStage({ kind: "node", stage: "s10" }, many);
    expect(r.state === "assigned" && r.token).toBe(NEUTRAL_TOKEN);
  });
});

describe("roundAt", () => {
  const stageOf = (node: string) => ({ a: "A", fit: "F", c1: "C", c2: "C" } as Record<string, string>)[node] ?? null;
  const path = ["a", "c1", "fit", "c2", "c1", "fit", "c2", "c1", "fit", "c2"].map((node) => ({ node }));

  it("is 0 before anything has run and before the first fit", () => {
    expect(roundAt(path, -1, stageOf, "F")).toBe(0);
    expect(roundAt(path, 0, stageOf, "F")).toBe(0);
    expect(roundAt(path, 1, stageOf, "F")).toBe(0);
  });

  it("counts the events in the fit stage up to the cursor", () => {
    expect(roundAt(path, 2, stageOf, "F")).toBe(1);
    expect(roundAt(path, 4, stageOf, "F")).toBe(1);
    expect(roundAt(path, 5, stageOf, "F")).toBe(2);
    expect(roundAt(path, 7, stageOf, "F")).toBe(2);
    expect(roundAt(path, 8, stageOf, "F")).toBe(3);
    expect(roundAt(path, 9, stageOf, "F")).toBe(3);
  });

  it("falls when the cursor moves back, because it depends only on the position", () => {
    expect(roundAt(path, 8, stageOf, "F")).toBe(3);
    expect(roundAt(path, 5, stageOf, "F")).toBe(2);
    expect(roundAt(path, 2, stageOf, "F")).toBe(1);
    expect(roundAt(path, -1, stageOf, "F")).toBe(0);   // Reset
  });

  it("ignores a cursor past the end and nodes with no stage", () => {
    expect(roundAt(path, 99, stageOf, "F")).toBe(3);
    expect(roundAt([{ node: "x" }, { node: "y" }], 1, stageOf, "F")).toBe(0);
  });
});

describe("loopEdges", () => {
  const edgeKeys = (s: Structure) => loopEdges(s).map((e) => `${e.source}->${e.target}`).sort();

  it("finds the edges joining a fit node and a choose node, in either direction", () => {
    const real = JSON.parse(readFileSync("tests/fixtures/linreg-structure.json", "utf8")) as Structure;
    expect(edgeKeys(real)).toEqual(["check_proposal->fit_model", "fit_model->evaluate"]);
  });

  it("leaves out an edge between two choose nodes and any edge touching another stage", () => {
    const real = JSON.parse(readFileSync("tests/fixtures/linreg-structure.json", "utf8")) as Structure;
    const keys = edgeKeys(real);
    expect(keys).not.toContain("evaluate->propose_features");
    expect(keys).not.toContain("explore->baseline");
  });

  it("works for another graph with other stage ids", () => {
    const other: Structure = {
      nodes: [
        { id: "__start__", kind: "start" }, { id: "p", kind: "node", stage: "pick" }, { id: "t", kind: "node", stage: "train" },
        { id: "r", kind: "node", stage: "report" }, { id: "__end__", kind: "end" },
      ],
      edges: [
        { source: "__start__", target: "p", conditional: false, branch: null },
        { source: "p", target: "t", conditional: false, branch: null },
        { source: "t", target: "p", conditional: true, branch: "again" },
        { source: "t", target: "r", conditional: true, branch: "done" },
        { source: "r", target: "__end__", conditional: false, branch: null },
      ],
      stages: [], loop: { fit: "train", choose: "pick" },
    };
    expect(edgeKeys(other)).toEqual(["p->t", "t->p"]);
  });

  it("returns nothing when the structure names no loop", () => {
    const real = JSON.parse(readFileSync("tests/fixtures/linreg-structure.json", "utf8")) as Structure;
    expect(loopEdges({ ...real, loop: undefined })).toEqual([]);
  });
});
