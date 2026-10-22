import { describe, expect, it } from "vitest";
import { groupRows, loopText } from "../../src/graph-replay/rows";
import type { Structure } from "../../src/graph-replay/structure";
import linreg from "../fixtures/linreg-structure.json";

const node = (id: string, row?: string, kind: "start" | "end" | "node" = "node") => ({ id, kind, ...(row ? { row } : {}) });
const rows = [{ id: "a", title: "First", note: "n1" }, { id: "b", title: "Second", note: "n2" }];

describe("groupRows", () => {
  it("groups steps into the server's rows, in the server's order, keeping step order", () => {
    const s: Structure = { nodes: [node("__start__", undefined, "start"), node("x", "b"), node("y", "a"), node("z", "b"), node("__end__", undefined, "end")], edges: [], rows };
    const g = groupRows(s);
    expect(g.map((r) => r.id)).toEqual(["a", "b"]);
    expect(g.map((r) => r.nodes.map((n) => n.id))).toEqual([["y"], ["x", "z"]]);
    expect(g[0]).toMatchObject({ title: "First", note: "n1" });
  });

  it("never draws the start and end markers", () => {
    const g = groupRows({ nodes: [node("__start__", undefined, "start"), node("x", "a"), node("__end__", undefined, "end")], edges: [], rows });
    expect(g.flatMap((r) => r.nodes.map((n) => n.id))).toEqual(["x"]);
  });

  it("keeps a step with no row or an unknown row in a last, untitled row", () => {
    const g = groupRows({ nodes: [node("x", "a"), node("lost"), node("odd", "nope")], edges: [], rows });
    expect(g.at(-1)).toMatchObject({ id: "__other__", title: "" });
    expect(g.at(-1)!.nodes.map((n) => n.id)).toEqual(["lost", "odd"]);
  });

  it("gives one row holding every step when the structure has no rows", () => {
    const g = groupRows({ nodes: [node("x"), node("y")], edges: [] });
    expect(g).toHaveLength(1);
    expect(g[0].nodes.map((n) => n.id)).toEqual(["x", "y"]);
  });

  it("puts a done-beforehand item in the row of the step it comes before", () => {
    const item = { id: "prep", label: "prep", stage: "s", before: "y", summary: {} };
    const g = groupRows({ nodes: [node("x", "a"), node("y", "b")], edges: [], rows, items: [item] });
    expect(g[1].items).toEqual([item]);
    expect(g[0].items).toEqual([]);
  });

  it("finds the ways back inside a row from conditional edges that return to an earlier step", () => {
    const s: Structure = {
      nodes: [node("p", "a"), node("c", "a"), node("e", "a"), node("g", "b")],
      edges: [
        { source: "p", target: "c", conditional: false, branch: null },
        { source: "c", target: "p", conditional: true, branch: "rejected" },
        { source: "e", target: "p", conditional: true, branch: "continue" },
        { source: "e", target: "g", conditional: true, branch: "stop" },
      ],
      rows,
    };
    const first = groupRows(s)[0];
    expect(first.loops).toEqual([{ branch: "rejected", to: "p" }, { branch: "continue", to: "p" }]);
    expect(loopText(first.loops)).toBe("↺ rejected · continue → back to p");
    expect(groupRows(s)[1].loops).toEqual([]);
    expect(loopText([])).toBe("");
  });
});

describe("order inside a row", () => {
  it("follows the order a run first reaches the steps, not the order the structure lists them", () => {
    const s: Structure = {
      nodes: [node("__start__", undefined, "start"), node("c", "a"), node("a", "a"), node("b", "a"), node("__end__", undefined, "end")],
      edges: [
        { source: "__start__", target: "a", conditional: false, branch: null },
        { source: "a", target: "b", conditional: false, branch: null },
        { source: "b", target: "c", conditional: false, branch: null },
        { source: "c", target: "__end__", conditional: false, branch: null },
      ],
      rows,
    };
    expect(groupRows(s)[0].nodes.map((n) => n.id)).toEqual(["a", "b", "c"]);
  });
});

describe("this app's structure", () => {
  it("lists the steps of each row in the order the agent runs them", () => {
    const g = groupRows(linreg as unknown as Structure);
    expect(g.map((r) => r.nodes.map((n) => n.id))).toEqual([
      ["load_data", "split", "explore", "baseline"],
      ["propose_features", "check_proposal", "fit_model", "evaluate"],
      ["grid_search"],
      ["final_test", "explain_in_cricket_terms", "write_in_cricket_terms"],
    ]);
  });

  it("puts the twelve steps in four rows", () => {
    const g = groupRows(linreg as unknown as Structure);
    expect(g.map((r) => r.id)).toEqual(["start", "round", "yardstick", "end"]);
    expect(g.map((r) => r.nodes.length)).toEqual([4, 4, 1, 3]);
    expect(g[1].loops.length).toBeGreaterThan(0);
  });
});
