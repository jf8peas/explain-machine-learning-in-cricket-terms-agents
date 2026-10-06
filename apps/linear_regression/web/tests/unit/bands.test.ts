import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { computeBands, layoutGraph, type LaidNode, type Structure } from "../../src/graph-replay/layout";
import { resolveStage } from "../../src/graph-replay/stages";

// `linreg-structure.json` is this app's real /api/structure response. A pytest test (test_structure_stages.py) fails
// if it drifts; regenerate it by saving the response of GET /api/structure from a server run with LLM_PROVIDER=fake.
const real: Structure = JSON.parse(readFileSync("tests/fixtures/linreg-structure.json", "utf8"));

const node = (id: string, stage: string | undefined, x: number, y: number, kind: LaidNode["kind"] = "node"): LaidNode =>
  ({ id, kind, stage, x, y, w: 100, h: 36 });
const stageOf = (n: LaidNode) => (n.kind === "node" || (n.kind as string) === "item" ? n.stage ?? null : null);
const overlaps = (b: { x: number; y: number; w: number; h: number }, n: LaidNode) =>
  b.x < n.x + n.w / 2 && b.x + b.w > n.x - n.w / 2 && b.y < n.y + n.h / 2 && b.y + b.h > n.y - n.h / 2;

describe("computeBands", () => {
  it("makes one band of a run of neighbours in one stage", () => {
    const bands = computeBands([node("a", "s1", 0, 0), node("b", "s1", 0, 100)], stageOf);
    expect(bands).toHaveLength(1);
    expect(bands[0]).toMatchObject({ stage: "s1", nodes: ["a", "b"] });
  });

  it("gives a stage that another stage's node splits two bands", () => {
    const bands = computeBands([
      node("a", "choose", 0, 0), node("b", "choose", 0, 100), node("c", "fit", 0, 200),
      node("d", "choose", 0, 300), node("e", "choose", 0, 400),
    ], stageOf);
    expect(bands.map((b) => [b.stage, b.nodes])).toEqual([
      ["choose", ["a", "b"]], ["fit", ["c"]], ["choose", ["d", "e"]],
    ]);
  });

  it("splits a group whose box would enclose an unassigned node", () => {
    const bands = computeBands([node("a", "s1", 0, 0), node("b", "s1", 500, 0), node("u", undefined, 250, 0)], stageOf);
    expect(bands.map((b) => b.nodes)).toEqual([["a"], ["b"]]);
    const u = node("u", undefined, 250, 0);
    expect(bands.some((b) => overlaps(b, u))).toBe(false);
  });

  it("keeps a node of another stage out of a band", () => {
    const nodes = [node("a", "s1", 0, 0), node("f", "s2", 0, 100), node("b", "s1", 0, 200)];
    const bands = computeBands(nodes, stageOf);
    expect(bands.map((x) => [x.stage, x.nodes])).toEqual([["s1", ["a"]], ["s2", ["f"]], ["s1", ["b"]]]);
    for (const band of bands) for (const n of nodes) if (!band.nodes.includes(n.id)) expect(overlaps(band, n)).toBe(false);
  });

  it("lets a band surround start and end, which are not steps", () => {
    const bands = computeBands([
      node("a", "s1", 0, 0), node("b", "s1", 500, 0), node("__start__", undefined, 250, 0, "start"),
    ], stageOf);
    expect(bands).toHaveLength(1);
    expect(bands[0].nodes).toEqual(["a", "b"]);
  });

  it("does not put an unassigned node in any band, and puts every staged node in exactly one", () => {
    const nodes = [node("a", "s1", 0, 0), node("u", undefined, 0, 100), node("b", "s1", 0, 200), node("c", "s2", 0, 300)];
    const bands = computeBands(nodes, stageOf);
    const all = bands.flatMap((b) => b.nodes);
    expect(all.sort()).toEqual(["a", "b", "c"]);
    expect(new Set(all).size).toBe(all.length);
  });

  it("pads the box around its nodes and leaves room for the label", () => {
    const [b] = computeBands([node("a", "s1", 0, 0)], stageOf);
    expect(b.x).toBeLessThan(-50);
    expect(b.x + b.w).toBeGreaterThan(50);
    expect(b.y).toBeLessThan(-18);          // above the node by more than the bottom padding: the label sits there
    expect(b.y + b.h).toBeGreaterThan(18);
  });

  it("returns nothing when no node has a stage", () => {
    expect(computeBands([node("a", undefined, 0, 0)], stageOf)).toEqual([]);
  });
});

describe("bands for this app's real graph", () => {
  const out = layoutGraph(real);
  const stageNodes = out.nodes.filter((n) => n.kind === "node");
  const bandsOf = (stage: string) => out.bands.filter((b) => b.stage === stage);

  it("gives Choose the setup two bands, with Fit the model between them", () => {
    const choose = bandsOf("choose");
    expect(choose.length).toBe(2);
    expect(choose.map((b) => b.nodes).flat().sort()).toEqual(["check_proposal", "evaluate", "forward_selection", "propose_features"]);
    expect(bandsOf("fit")).toHaveLength(1);
  });

  it("puts every real node in exactly one band, in its own stage", () => {
    const seen = new Map<string, string>();
    for (const b of out.bands) for (const id of b.nodes) {
      expect(seen.has(id)).toBe(false);
      seen.set(id, b.stage);
    }
    for (const n of stageNodes) expect(seen.get(n.id)).toBe(n.stage);
  });

  it("never lets a band cover a node of another stage", () => {
    for (const b of out.bands) for (const n of stageNodes) if (!b.nodes.includes(n.id)) expect(overlaps(b, n)).toBe(false);
  });

  it("resolves every real node to a stage", () => {
    for (const n of real.nodes) if (n.kind === "node") expect(resolveStage(n, real.stages).state).toBe("assigned");
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

  it("puts the item in one band with the node it sits before", () => {
    const band = out.bands.find((b) => b.nodes.includes(itemId));
    expect(band?.stage).toBe("prepare");
    expect(band?.nodes).toContain("load_data");
  });

  it("keeps that one band even when the start marker sits between them on the same rank", () => {
    const nodes = [
      node("item:x", "prepare", 0, 0, "item" as LaidNode["kind"]), node("__start__", undefined, 150, 0, "start"),
      node("load_data", "prepare", 300, 100),
    ];
    const bands = computeBands(nodes, stageOf);
    expect(bands).toHaveLength(1);
    expect(bands[0].nodes.sort()).toEqual(["item:x", "load_data"]);
  });

  it("keeps an item out of another stage's band", () => {
    const nodes = [node("a", "s1", 0, 0), node("item:x", "s2", 0, 100, "item" as LaidNode["kind"]), node("b", "s1", 0, 200)];
    const bands = computeBands(nodes, stageOf);
    const item = nodes[1];
    for (const band of bands) if (band.stage === "s1") expect(overlaps(band, item)).toBe(false);
    expect(bands.map((x) => x.stage)).toEqual(["s1", "s2", "s1"]);
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
  });
});
