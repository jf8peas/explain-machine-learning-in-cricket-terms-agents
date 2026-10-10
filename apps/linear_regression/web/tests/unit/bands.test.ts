import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { computeRows, labelSpan, layoutGraph, type LaidNode, type Structure } from "../../src/graph-replay/layout";
import { resolveStage, type StageDef } from "../../src/graph-replay/stages";

// `linreg-structure.json` is this app's real /api/structure response. A pytest test (test_structure_stages.py) fails
// if it drifts; regenerate it by saving the response of GET /api/structure from a server run with LLM_PROVIDER=fake.
const real: Structure = JSON.parse(readFileSync("tests/fixtures/linreg-structure.json", "utf8"));
const stageDefs = (names: string[]): StageDef[] =>
  names.map((name, i) => ({ id: `s${i + 1}`, number: i + 1, name, question: "", description: "" }));

describe("computeRows", () => {
  const stages = stageDefs(["First", "Second", "Third"]);
  const rows = computeRows(stages, 800);

  it("makes Start, one row per stage in order, then Finish", () => {
    expect(rows.map((r) => r.key)).toEqual(["start", "s1", "s2", "s3", "end"]);
    expect(rows.map((r) => r.kind)).toEqual(["start", "stage", "stage", "stage", "end"]);
    expect(rows.map((r) => r.number)).toEqual([null, 1, 2, 3, null]);
    expect(rows.map((r) => r.name)).toEqual(["Start", "First", "Second", "Third", "Finish"]);
  });

  it("follows the order the stages are given in, whatever their ids", () => {
    const flipped = computeRows([...stages].reverse(), 800);
    expect(flipped.map((r) => r.key)).toEqual(["start", "s3", "s2", "s1", "end"]);
  });

  it("runs every row the full width, stacked from the top with no gaps", () => {
    expect(rows[0].y).toBe(0);
    for (const r of rows) { expect(r.x).toBe(0); expect(r.w).toBe(800); }
    for (let i = 1; i < rows.length; i++) expect(rows[i].y).toBe(rows[i - 1].y + rows[i - 1].h);
  });

  it("centres the label on the row's node line, inside the row", () => {
    for (const r of rows) {
      expect(r.label.y).toBeGreaterThan(r.y);
      expect(r.label.y).toBeLessThan(r.y + r.h);
    }
    expect(rows[2].label.y - rows[2].y).toBe(32);
  });

  it("makes a row taller only where it is asked to", () => {
    const tall = computeRows(stages, 800, [0, 0, 44, 0, 0]);
    expect(tall[2].h).toBe(rows[2].h + 44);
    expect(tall[1].h).toBe(rows[1].h);
    expect(tall[2].label.y - tall[2].y).toBe(32 + 44);
  });

  it("still makes a row for a stage that has no nodes", () => {
    const out = layoutGraph({
      nodes: [{ id: "__start__", kind: "start" }, { id: "a", kind: "node", stage: "s1" }, { id: "__end__", kind: "end" }],
      edges: [{ source: "__start__", target: "a", conditional: false, branch: null }, { source: "a", target: "__end__", conditional: false, branch: null }],
      stages,
    });
    expect(out.rows).toHaveLength(5);
    expect(out.rows[2].nodes).toEqual([]);
    expect(out.rows[2].h).toBe(out.rows[3].h);
  });

  it("puts a label in the row's top-left corner when it is asked to, and on the node line otherwise", () => {
    const up = computeRows(stages, 800, [], 22, 64, [false, false, true, false, false]);
    expect(up[2].corner).toBe(true);
    expect(up[2].label.y).toBe(up[2].y + 12);
    expect(up[1].corner).toBe(false);
    expect(up[1].label.y).toBe(up[1].y + 32);
  });

  it("reckons a long name to reach further than a short one", () => {
    expect(labelSpan("A stage with a really rather long name indeed")).toBeGreaterThan(labelSpan("Short"));
  });
});

describe("rows for this app's real graph", () => {
  const out = layoutGraph(real);
  const byId = new Map(out.nodes.map((n) => [n.id, n]));

  it("has Start, the eight stages in structure order, and Finish", () => {
    expect(out.rows.map((r) => r.key)).toEqual(["start", ...(real.stages ?? []).map((s) => s.id), "end"]);
    expect(out.rows).toHaveLength(10);
  });

  it("puts every step in the row of its stage, with its y inside that row", () => {
    for (const n of real.nodes.filter((x) => x.kind === "node")) {
      const row = out.rows.find((r) => r.stage === n.stage);
      const laid = byId.get(n.id) as LaidNode;
      expect(row?.nodes, n.id).toContain(n.id);
      expect(laid.y - laid.h / 2).toBeGreaterThanOrEqual((row?.y ?? 0));
      expect(laid.y + laid.h / 2).toBeLessThanOrEqual((row?.y ?? 0) + (row?.h ?? 0));
    }
  });

  it("gives Choose the setup, with its loop-back arcs, a taller row than a single line", () => {
    const choose = out.rows.find((r) => r.stage === "choose");
    const split = out.rows.find((r) => r.stage === "split");
    expect(choose?.h).toBeGreaterThan(split?.h ?? 0);
    expect(out.rows.filter((r) => r.h > (split?.h ?? 0) && r.kind !== "start")).toHaveLength(1);
  });

  it("resolves every real node to a stage", () => {
    for (const n of real.nodes) if (n.kind === "node") expect(resolveStage(n, real.stages).state).toBe("assigned");
  });

  it("keeps the rows as tall as the drawing and as wide as its width", () => {
    const last = out.rows[out.rows.length - 1];
    expect(last.y + last.h).toBe(out.height);
    for (const r of out.rows) expect(r.w).toBe(out.width);
  });
});

describe("done-beforehand items in the layout", () => {
  const out = layoutGraph(real);
  const itemId = "item:prepare_data";

  it("lays an item out as a node of its own, joined to the node it sits before by a connector", () => {
    const item = out.nodes.find((n) => n.id === itemId);
    expect(item).toBeDefined();
    expect(item?.kind).toBe("item");
    expect(item?.stage).toBe("prepare");
    const joint = out.edges.find((e) => e.source === itemId && e.target === "load_data");
    expect(joint).toBeDefined();
    expect(joint?.item).toBe(true);
    expect(joint?.points.length).toBeGreaterThan(1);
    expect(out.edges.filter((e) => e.item)).toHaveLength(1);
  });

  it("puts the item in the Start row, to the left of the start node", () => {
    const item = out.nodes.find((n) => n.id === itemId) as LaidNode;
    const start = out.nodes.find((n) => n.kind === "start") as LaidNode;
    expect(out.rows[0].nodes).toContain(itemId);
    expect(item.x + item.w / 2).toBeLessThan(start.x - start.w / 2);
    expect(item.y).toBe(start.y);
  });

  it("points the item's connector into the start node", () => {
    const joint = out.edges.find((e) => e.item)!;
    const start = out.nodes.find((n) => n.kind === "start") as LaidNode;
    const end = joint.points[joint.points.length - 1];
    expect(end.x).toBeCloseTo(start.x - start.w / 2, 3);
    expect(end.y).toBeCloseTo(start.y, 3);
  });

  it("moves the Start label to the row's corner, since the item would cover it", () => {
    expect(out.rows[0].corner).toBe(true);
    expect(out.rows[0].label.y).toBeLessThan((out.nodes.find((n) => n.id === itemId) as LaidNode).y - 18);
  });

  it("ignores an item whose target node does not exist, without failing", () => {
    const odd: Structure = { ...real, items: [{ id: "lost", label: "lost", stage: "prepare", before: "nowhere", summary: {} }] };
    const laid = layoutGraph(odd);
    expect(laid.nodes.some((n) => n.id === "item:lost")).toBe(false);
    expect(laid.nodes.filter((n) => n.kind === "node")).toHaveLength(11);
  });

  it("changes nothing for a structure without items", () => {
    const plain = layoutGraph({ ...real, items: undefined });
    expect(plain.nodes.some((n) => n.kind === "item")).toBe(false);
    expect(plain.edges.some((e) => e.item)).toBe(false);
    expect(plain.rows[0].nodes).toEqual(["__start__"]);
  });
});
