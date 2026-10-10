import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { layoutGraph, pathData, type LaidNode, type Structure } from "../../src/graph-replay/layout";

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

describe("layoutGraph with a self-loop", () => {
  const withLoop: Structure = {
    nodes: [
      { id: "__start__", kind: "start" }, { id: "a", kind: "node" }, { id: "step", kind: "node" },
      { id: "b", kind: "node" }, { id: "__end__", kind: "end" },
    ],
    edges: [
      { source: "__start__", target: "a", conditional: false, branch: null },
      { source: "a", target: "step", conditional: false, branch: null },
      { source: "step", target: "step", conditional: true, branch: "again" },
      { source: "step", target: "b", conditional: true, branch: "done" },
      { source: "b", target: "__end__", conditional: false, branch: null },
    ],
  };
  const out = layoutGraph(withLoop);
  const loop = out.edges.find((e) => e.source === "step" && e.target === "step")!;

  it("routes the self-loop as a path that leaves the node and comes back to it", () => {
    const node = out.nodes.find((n) => n.id === "step")!;
    expect(loop.points.length).toBeGreaterThanOrEqual(4);
    const right = node.x + node.w / 2;
    expect(Math.max(...loop.points.map((p) => p.x))).toBeGreaterThan(right); // it sits beside the node
    expect(pathData(loop.points).startsWith("M")).toBe(true);
  });

  it("labels the self-loop and keeps it inside the drawing", () => {
    expect(loop.label).not.toBeNull();
    expect(Math.max(...loop.points.map((p) => p.x))).toBeLessThanOrEqual(out.width);
  });
});

describe("layoutGraph and stages", () => {
  it("passes each node's stage through to the laid-out node", () => {
    const staged: Structure = {
      ...structure,
      nodes: structure.nodes.map((n) => (n.kind === "node" ? { ...n, stage: n.id === "a" ? "one" : "two" } : n)),
    };
    const out = layoutGraph(staged);
    expect(out.nodes.find((n) => n.id === "a")?.stage).toBe("one");
    expect(out.nodes.find((n) => n.id === "c")?.stage).toBe("two");
    expect(out.nodes.find((n) => n.id === "__start__")?.stage).toBeUndefined();
  });

  it("leaves a structure without stages exactly as before", () => {
    expect(layoutGraph(structure).nodes.every((n) => n.stage === undefined)).toBe(true);
  });
});

// ---- rows: placement and routing, on this app's real structure and on a made-up one ----
const real: Structure = JSON.parse(readFileSync("tests/fixtures/linreg-structure.json", "utf8"));

describe("row placement on this app's real graph", () => {
  const out = layoutGraph(real);
  const at = (id: string) => out.nodes.find((n) => n.id === id) as LaidNode;
  const rowIndex = (id: string) => at(id).row as number;

  it("runs the main sequence down one vertical line", () => {
    const spine = ["__start__", "load_data", "split", "explore", "baseline", "propose_features"].map((id) => at(id).x);
    for (const x of spine) expect(x).toBeCloseTo(spine[0], 3);
  });

  it("puts fit_model directly under check_proposal, and final_test and the end under their predecessors", () => {
    expect(at("fit_model").x).toBeCloseTo(at("check_proposal").x, 3);
    expect(rowIndex("fit_model")).toBeGreaterThan(rowIndex("check_proposal"));
    expect(at("final_test").x).toBeCloseTo(at("grid_search").x, 3);
    expect(at("__end__").x).toBeCloseTo(at("explain_in_cricket_terms").x, 3);    // not under load_data, its other predecessor
  });

  it("orders the Choose row evaluate, propose_features, check_proposal, grid_search", () => {
    const ids = ["evaluate", "propose_features", "check_proposal", "grid_search"];
    const xs = ids.map((id) => at(id).x);
    expect([...xs].sort((a, b) => a - b)).toEqual(xs);
  });

  it("never overlaps two nodes", () => {
    const boxes = out.nodes;
    for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i], b = boxes[j];
      const apart = a.x + a.w / 2 <= b.x - b.w / 2 || b.x + b.w / 2 <= a.x - a.w / 2 || a.y + a.h / 2 <= b.y - b.h / 2 || b.y + b.h / 2 <= a.y - a.h / 2;
      expect(apart, `${a.id} and ${b.id}`).toBe(true);
    }
  });

  it("routes every edge as horizontal and vertical segments only", () => {
    for (const e of out.edges) for (let i = 1; i < e.points.length; i++) {
      const dx = Math.abs(e.points[i].x - e.points[i - 1].x), dy = Math.abs(e.points[i].y - e.points[i - 1].y);
      expect(Math.min(dx, dy), `${e.source}->${e.target}`).toBeLessThan(0.5);
    }
  });

  it("keeps a loop-back edge within the same row inside that row", () => {
    const row = out.rows.find((r) => r.stage === "choose")!;
    const back = out.edges.find((e) => e.source === "check_proposal" && e.target === "propose_features")!;
    for (const p of back.points) { expect(p.y).toBeGreaterThanOrEqual(row.y); expect(p.y).toBeLessThanOrEqual(row.y + row.h); }
    expect(back.points.length).toBe(4);                                           // an arc, not the straight edge
  });

  it("sends load_data's stop edge down the right margin, clear of every node", () => {
    const stop = out.edges.find((e) => e.source === "load_data" && e.target === "__end__")!;
    const rightmost = Math.max(...out.nodes.map((n) => n.x + n.w / 2));
    expect(Math.max(...stop.points.map((p) => p.x))).toBeGreaterThan(rightmost);
    expect(Math.max(...stop.points.map((p) => p.x))).toBeLessThanOrEqual(out.width);
  });

  it("gives conditional edges a label, and the loop edges a pill clear of their line", () => {
    for (const e of out.edges.filter((x) => x.conditional && x.branch)) expect(e.label, e.branch ?? "").not.toBeNull();
    const fit = out.edges.find((e) => e.source === "fit_model" && e.target === "evaluate")!;
    expect(fit.pill).toBeDefined();
  });

  it("makes the llm steps 18px wider", () => {
    const flat = { ...real, nodes: real.nodes.map((n) => ({ ...n, actor: undefined })) };
    const plain = layoutGraph(flat).nodes.find((n) => n.id === "propose_features") as LaidNode;
    const llm = real.nodes.find((n) => n.id === "propose_features")?.actor === "llm";
    expect(at("propose_features").w - plain.w).toBe(llm ? 18 : 0);
  });
});

describe("row placement on another app's structure", () => {
  const other: Structure = {
    nodes: [
      { id: "__start__", kind: "start" }, { id: "p", kind: "node", stage: "z" }, { id: "q", kind: "node", stage: "y" },
      { id: "u", kind: "node" }, { id: "__end__", kind: "end" },
    ],
    edges: [
      { source: "__start__", target: "p", conditional: false, branch: null },
      { source: "p", target: "q", conditional: false, branch: null },
      { source: "q", target: "u", conditional: false, branch: null },
      { source: "u", target: "__end__", conditional: false, branch: null },
    ],
    stages: [
      { id: "z", number: 1, name: "Zed", question: "", description: "" },
      { id: "y", number: 2, name: "Why", question: "", description: "" },
    ],
  };
  const out = layoutGraph(other);

  it("draws the rows in the order the stages are given", () => {
    expect(out.rows.map((r) => r.key)).toEqual(["start", "z", "y", "end"]);
  });

  it("puts an unassigned step in the row of its predecessor", () => {
    const u = out.nodes.find((n) => n.id === "u") as LaidNode;
    expect(out.rows[u.row as number].key).toBe("y");
  });

  it("draws no rows for a structure without stages", () => {
    expect(layoutGraph({ ...other, stages: undefined }).rows).toEqual([]);
  });
});

describe("a taller drawing", () => {
  const natural = layoutGraph(real);
  const tall = layoutGraph(real, natural.height + 600);

  it("is at least as tall as asked, with the extra shared out between the rows", () => {
    expect(tall.height).toBeCloseTo(natural.height + 600, 3);
    expect(tall.rows).toHaveLength(natural.rows.length);
    const extra = 600 / natural.rows.length;
    tall.rows.forEach((r, i) => expect(r.h).toBeCloseTo(natural.rows[i].h + extra, 3));
  });

  it("keeps every step in its row, with the same x and the rows stacked with no gaps", () => {
    for (const n of tall.nodes) {
      const was = natural.nodes.find((o) => o.id === n.id)!;
      expect(n.x).toBeCloseTo(was.x, 3);
      const row = tall.rows[n.row ?? 0];
      expect(n.y).toBeGreaterThan(row.y);
      expect(n.y).toBeLessThan(row.y + row.h);
    }
    for (let i = 1; i < tall.rows.length; i++) expect(tall.rows[i].y).toBeCloseTo(tall.rows[i - 1].y + tall.rows[i - 1].h, 3);
  });

  it("changes nothing when the asked height is below the natural one", () => {
    expect(layoutGraph(real, 10).height).toBe(natural.height);
  });
});
