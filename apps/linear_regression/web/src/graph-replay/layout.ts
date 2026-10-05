// Generic layout: structure in, positioned nodes and routed edges out. No app knowledge.
import * as dagreNS from "@dagrejs/dagre";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const dagre: typeof dagreNS = (dagreNS as any).default ?? dagreNS;

export interface StructureNode { id: string; kind: "start" | "end" | "node"; /** Optional: who does the step. */ actor?: "llm" | "code" }
export interface StructureEdge { source: string; target: string; conditional: boolean; branch: string | null }
export interface Structure { nodes: StructureNode[]; edges: StructureEdge[] }

export interface LaidNode { id: string; kind: StructureNode["kind"]; actor?: StructureNode["actor"]; x: number; y: number; w: number; h: number }
export interface Point { x: number; y: number }
export interface LaidEdge extends StructureEdge { points: Point[]; label: Point | null }
export interface Layout { nodes: LaidNode[]; edges: LaidEdge[]; width: number; height: number }

const CHAR_W = 7.2;

export function nodeSize(n: StructureNode): { w: number; h: number } {
  if (n.kind !== "node") return { w: 22, h: 22 };
  return { w: Math.max(96, Math.ceil(n.id.length * CHAR_W) + 28), h: 36 };
}

export function layoutGraph(structure: Structure): Layout {
  const g = new dagre.graphlib.Graph({ multigraph: true });
  g.setGraph({ rankdir: "TB", nodesep: 40, ranksep: 46, marginx: 20, marginy: 20 });
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
  dagre.layout(g);

  const nodes: LaidNode[] = structure.nodes.map((n) => {
    const p = g.node(n.id);
    return { id: n.id, kind: n.kind, actor: n.actor, x: p.x, y: p.y, w: p.width, h: p.height };
  });
  const edges: LaidEdge[] = structure.edges.map((e, i) => {
    const d = g.edge(e.source, e.target, String(i)) as { points: Point[]; x?: number; y?: number };
    const hasLabel = e.conditional && !!e.branch && d.x !== undefined && d.y !== undefined;
    return { ...e, points: d.points, label: hasLabel ? { x: d.x as number, y: d.y as number } : null };
  });
  const gl = g.graph();
  return { nodes, edges, width: gl.width ?? 0, height: gl.height ?? 0 };
}

export function pathData(points: Point[]): string {
  return points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
}
