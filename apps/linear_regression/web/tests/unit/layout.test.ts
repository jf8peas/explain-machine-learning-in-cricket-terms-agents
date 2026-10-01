import { describe, expect, it } from "vitest";
import { layoutGraph, pathData, type Structure } from "../../src/graph-replay/layout";

const structure: Structure = {
  nodes: [
    { id: "__start__", kind: "start" }, { id: "a", kind: "node" }, { id: "b", kind: "node" },
    { id: "c", kind: "node" }, { id: "__end__", kind: "end" },
  ],
  edges: [
    { source: "__start__", target: "a", conditional: false, branch: null },
    { source: "a", target: "b", conditional: false, branch: null },
    { source: "b", target: "c", conditional: true, branch: "go" },
    { source: "b", target: "__end__", conditional: true, branch: "stop" },
    { source: "c", target: "a", conditional: false, branch: null }, // a loop
    { source: "c", target: "__end__", conditional: false, branch: null },
  ],
};

describe("layoutGraph", () => {
  const out = layoutGraph(structure);

  it("positions every node with a size", () => {
    expect(out.nodes).toHaveLength(5);
    for (const n of out.nodes) {
      expect(Number.isFinite(n.x) && Number.isFinite(n.y)).toBe(true);
      expect(n.w).toBeGreaterThan(0);
    }
  });

  it("routes every edge, including the loop edge", () => {
    expect(out.edges).toHaveLength(6);
    for (const e of out.edges) expect(e.points.length).toBeGreaterThanOrEqual(2);
    const loop = out.edges.find((e) => e.source === "c" && e.target === "a");
    expect(loop && pathData(loop.points)).toMatch(/^M/);
  });

  it("gives conditional edges a label position and plain edges none", () => {
    const cond = out.edges.filter((e) => e.conditional);
    expect(cond.every((e) => e.label !== null)).toBe(true);
    expect(out.edges.filter((e) => !e.conditional).every((e) => e.label === null)).toBe(true);
  });

  it("reports a bounding size", () => {
    expect(out.width).toBeGreaterThan(0);
    expect(out.height).toBeGreaterThan(0);
  });
});
