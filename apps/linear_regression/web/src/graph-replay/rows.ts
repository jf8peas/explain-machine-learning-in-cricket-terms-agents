// Rows: pure grouping of a structure's steps into the display rows the app supplied. No app knowledge: row titles, notes,
// step names and stages all arrive in the structure. Steps are ordered inside a row by the order a run first reaches them
// (the structure lists nodes in no particular order), and steps no edge reaches follow in the structure's order.
import type { RowDef, Structure, StructureEdge, StructureNode } from "./structure";
import type { StructureItem } from "./stages";

export interface RowGroup extends RowDef {
  /** The row's steps (start and end markers are not drawn). */
  nodes: StructureNode[];
  /** Display-only items that sit before one of this row's steps. */
  items: StructureItem[];
  /** The ways back inside this row: a conditional edge from a step to an earlier (or the same) step of the row. */
  loops: { branch: string; to: string }[];
}

const isStep = (n: StructureNode) => n.kind === "node";

/** Node ids in the order a run first reaches them: breadth first from the start, following edges in the order given. */
export function executionOrder(structure: Pick<Structure, "nodes" | "edges">): string[] {
  const start = structure.nodes.find((n) => n.kind === "start")?.id;
  const seen = new Set<string>();
  const order: string[] = [];
  const queue = start ? [start] : [];
  while (queue.length) {
    const id = queue.shift() as string;
    if (seen.has(id)) continue;
    seen.add(id);
    order.push(id);
    for (const e of structure.edges) if (e.source === id && !seen.has(e.target)) queue.push(e.target);
  }
  for (const n of structure.nodes) if (!seen.has(n.id)) order.push(n.id);
  return order;
}

/** The structure's steps grouped into its rows, in the order the structure gives them. Steps with no row, or a row that is
 *  not in the set, are collected in a last row with an empty title so none is dropped. A structure with no rows gives one
 *  row holding every step. */
export function groupRows(structure: Structure): RowGroup[] {
  const rank = new Map(executionOrder(structure).map((id, i) => [id, i]));
  const steps = structure.nodes.filter(isStep).sort((a, b) => (rank.get(a.id) ?? 0) - (rank.get(b.id) ?? 0));
  const defs: RowDef[] = structure.rows?.length ? [...structure.rows] : [{ id: "", title: "", note: "" }];
  const known = new Set(defs.map((d) => d.id));
  const rowOf = (n: StructureNode) => (structure.rows?.length ? (n.row && known.has(n.row) ? n.row : null) : "");
  const groups: RowGroup[] = defs.map((d) => ({ ...d, nodes: steps.filter((n) => rowOf(n) === d.id), items: [], loops: [] }));
  const loose = steps.filter((n) => rowOf(n) === null);
  if (loose.length) groups.push({ id: "__other__", title: "", note: "", nodes: loose, items: [], loops: [] });
  for (const item of structure.items ?? []) {
    const home = groups.find((g) => g.nodes.some((n) => n.id === item.before)) ?? groups[0];
    home?.items.push(item);
  }
  for (const g of groups) g.loops = loopsIn(g, structure.edges);
  return groups;
}

/** The conditional edges that go back to an earlier step of the same row: a branch name and where it returns to. */
export function loopsIn(group: Pick<RowGroup, "nodes">, edges: StructureEdge[]): { branch: string; to: string }[] {
  const index = new Map(group.nodes.map((n, i) => [n.id, i]));
  const back: { branch: string; to: string }[] = [];
  for (const e of edges) {
    const from = index.get(e.source), to = index.get(e.target);
    if (!e.conditional || from === undefined || to === undefined || to > from || !e.branch) continue;
    back.push({ branch: e.branch, to: e.target });
  }
  return back;
}

/** The wording of a row's way back: "↺ continue · rejected → back to <the first step>". Empty when there is none. */
export function loopText(loops: { branch: string; to: string }[]): string {
  if (!loops.length) return "";
  const targets = [...new Set(loops.map((l) => l.to))];
  return `↺ ${loops.map((l) => l.branch).join(" · ")} → back to ${targets.join(", ")}`;
}
