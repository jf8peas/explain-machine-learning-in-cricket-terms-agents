// Generic layout: structure in, positioned nodes and routed edges out. No app knowledge.
import * as dagreNS from "@dagrejs/dagre";
import type { Loop, Notes, StageDef, StructureItem } from "./stages";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const dagre: typeof dagreNS = (dagreNS as any).default ?? dagreNS;

export interface StructureNode {
  id: string; kind: "start" | "end" | "node";
  /** Optional: who does the step. */ actor?: "llm" | "code";
  /** Optional: the id of the stage (one of `Structure.stages`) the step belongs to. */ stage?: string;
}
export interface StructureEdge { source: string; target: string; conditional: boolean; branch: string | null }
export interface Structure {
  nodes: StructureNode[]; edges: StructureEdge[];
  /** Optional: the ordered stage set, the loop to emphasise, app notes and display-only items. */
  stages?: StageDef[]; loop?: Loop; notes?: Notes; items?: StructureItem[];
}

export interface LaidNode {
  /** `item` is a display-only entry (see StructureItem), laid out like a node but never a step. */
  id: string; kind: StructureNode["kind"] | "item"; actor?: StructureNode["actor"]; stage?: string; label?: string;
  x: number; y: number; w: number; h: number;
}
export interface Point { x: number; y: number }
export interface LaidEdge extends StructureEdge { points: Point[]; label: Point | null; /** joins an item to its node */ item?: boolean }
/** A labelled box around a run of neighbouring nodes in one stage. A stage split by another stage's node has several. */
export interface Band { stage: string; nodes: string[]; x: number; y: number; w: number; h: number }
export interface Layout { nodes: LaidNode[]; edges: LaidEdge[]; bands: Band[]; width: number; height: number }

const CHAR_W = 7.2;
/** The id an item gets in the layout, so it can never clash with a graph node. */
export const itemId = (id: string) => `item:${id}`;
export const BAND_PAD = 10;      // space between a band's edge and its nodes
export const BAND_LABEL = 20;    // extra space above the nodes, for the band's label

export function nodeSize(n: StructureNode): { w: number; h: number } {
  if (n.kind !== "node") return { w: 22, h: 22 };
  return { w: Math.max(96, Math.ceil(n.id.length * CHAR_W) + 28), h: 36 };
}

export function layoutGraph(structure: Structure): Layout {
  const g = new dagre.graphlib.Graph({ multigraph: true });
  g.setGraph({ rankdir: "TB", nodesep: 40, ranksep: 58, marginx: 24, marginy: 36 });
  g.setDefaultEdgeLabel(() => ({}));
  for (const n of structure.nodes) {
    const { w, h } = nodeSize(n);
    g.setNode(n.id, { width: w, height: h });
  }
  structure.edges.forEach((e, i) => {
    const label = e.conditional && e.branch ? e.branch : "";
    g.setEdge(e.source, e.target, label
      ? { label, width: Math.ceil(label.length * 6.4) + 10, height: 16, labelpos: "c" }
      : {}, String(i));
  });
  // Display-only items: a node of their own, joined by a connector to the node they sit before. An item whose target
  // is not in the graph is ignored.
  const items = (structure.items ?? []).filter((it) => structure.nodes.some((n) => n.id === it.before));
  for (const it of items) {
    g.setNode(itemId(it.id), { width: Math.max(150, Math.ceil(it.label.length * CHAR_W) + 28), height: 36 });
    g.setEdge(itemId(it.id), it.before, {}, `item-${it.id}`);
  }
  dagre.layout(g);

  const nodes: LaidNode[] = structure.nodes.map((n) => {
    const p = g.node(n.id);
    return { id: n.id, kind: n.kind, actor: n.actor, stage: n.stage, x: p.x, y: p.y, w: p.width, h: p.height };
  });
  for (const it of items) {
    const p = g.node(itemId(it.id));
    nodes.push({ id: itemId(it.id), kind: "item", stage: it.stage, label: it.label, x: p.x, y: p.y, w: p.width, h: p.height });
  }
  const edges: LaidEdge[] = structure.edges.map((e, i) => {
    const d = g.edge(e.source, e.target, String(i)) as { points: Point[]; x?: number; y?: number };
    const hasLabel = e.conditional && !!e.branch && d.x !== undefined && d.y !== undefined;
    return { ...e, points: d.points, label: hasLabel ? { x: d.x as number, y: d.y as number } : null };
  });
  for (const it of items) {
    const d = g.edge(itemId(it.id), it.before, `item-${it.id}`) as { points: Point[] };
    edges.push({ source: itemId(it.id), target: it.before, conditional: false, branch: null, points: d.points, label: null, item: true });
  }
  const gl = g.graph();
  const known = new Set((structure.stages ?? []).map((st) => st.id));
  const bands = computeBands(nodes, (n) => ((n.kind === "node" || n.kind === "item") && n.stage && known.has(n.stage) ? n.stage : null));
  return { nodes, edges, bands, width: gl.width ?? 0, height: gl.height ?? 0 };
}

const isStep = (n: LaidNode) => n.kind !== "start" && n.kind !== "end";
const boxOf = (group: LaidNode[]) => {
  const x1 = Math.min(...group.map((n) => n.x - n.w / 2)) - BAND_PAD;
  const x2 = Math.max(...group.map((n) => n.x + n.w / 2)) + BAND_PAD;
  const y1 = Math.min(...group.map((n) => n.y - n.h / 2)) - BAND_PAD - BAND_LABEL;
  const y2 = Math.max(...group.map((n) => n.y + n.h / 2)) + BAND_PAD;
  return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
};
const overlaps = (b: { x: number; y: number; w: number; h: number }, n: LaidNode) =>
  b.x < n.x + n.w / 2 && b.x + b.w > n.x - n.w / 2 && b.y < n.y + n.h / 2 && b.y + b.h > n.y - n.h / 2;

/**
 * Bands from node positions, after layout. The staged nodes are ordered along the main direction (top to bottom, then
 * left to right) and each run of neighbours in one stage becomes a band. A band that would cover a node it does not
 * hold (a node of another stage, or an unassigned node) is split at its widest gap until it does not. Start and end are
 * not steps: they are neither in a run nor in the way, so a band may surround them.
 * `stageOf` returns a node's stage id, or null for a node with no (known) stage.
 */
export function computeBands(nodes: LaidNode[], stageOf: (n: LaidNode) => string | null): Band[] {
  const steps = nodes.filter(isStep);
  const staged = steps.filter((n) => stageOf(n) !== null)
    .sort((a, b) => Math.round(a.y * 10) - Math.round(b.y * 10) || a.x - b.x);
  const runs: LaidNode[][] = [];
  for (const n of staged) {
    const last = runs[runs.length - 1];
    if (last && stageOf(last[0]) === stageOf(n)) last.push(n); else runs.push([n]);
  }
  const bands: Band[] = [];
  const place = (group: LaidNode[]): void => {
    const box = boxOf(group);
    const blocked = steps.some((o) => !group.includes(o) && overlaps(box, o));
    if (group.length === 1 || !blocked) {
      bands.push({ stage: stageOf(group[0]) as string, nodes: group.map((n) => n.id), ...box });
      return;
    }
    let at = 1, widest = -1;
    for (let i = 1; i < group.length; i++) {
      const d = Math.hypot(group[i].x - group[i - 1].x, group[i].y - group[i - 1].y);
      if (d > widest) { widest = d; at = i; }
    }
    place(group.slice(0, at));
    place(group.slice(at));
  };
  runs.forEach(place);
  return bands;
}

export function pathData(points: Point[]): string {
  return points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
}
