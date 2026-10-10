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
  /** index into `Layout.rows`, when the layout has rows */ row?: number;
}
export interface Point { x: number; y: number }
export interface LaidEdge extends StructureEdge {
  points: Point[]; label: Point | null; /** joins an item to its node */ item?: boolean;
  /** where a loop-round pill sits, clear of the line */ pill?: Point;
}
/** One full-width, borderless row: Start, a stage, or Finish. `label` is the badge centre, on the row's node line. */
export interface Row {
  key: string; kind: "start" | "stage" | "end"; stage: string | null; number: number | null; name: string;
  x: number; y: number; w: number; h: number; label: Point; nodes: string[];
  /** y of the row's first node line */ line: number;
  /** y of each node line: one, or two in a crowded row */ lines: number[];
  /** the label sits in the row's top-left corner, because a step or item would cover it on the node line */ corner: boolean;
}
export interface Layout { nodes: LaidNode[]; edges: LaidEdge[]; rows: Row[]; width: number; height: number }

const CHAR_W = 7.2;
/** An item's label on one line, or on two when it is long: split at the space nearest the middle. */
export function wrapLabel(label: string, longest = 16): string[] {
  if (label.length <= longest || !label.includes(" ")) return [label];
  let best = -1;
  for (let i = 0; i < label.length; i++) if (label[i] === " " && (best < 0 || Math.abs(i - label.length / 2) < Math.abs(best - label.length / 2))) best = i;
  return [label.slice(0, best), label.slice(best + 1)];
}
const itemSize = (label: string) => {
  const lines = wrapLabel(label);
  return { w: Math.max(lines.length > 1 ? 100 : 150, Math.ceil(Math.max(...lines.map((l) => l.length)) * CHAR_W) + 28), h: lines.length > 1 ? 46 : 36 };
};

/** The id an item gets in the layout, so it can never clash with a graph node. */
export const itemId = (id: string) => `item:${id}`;
export const ROW_LINE = 64;         // height of a row with one line of nodes
export const START_PAD = 8;         // extra room at the top of the Start row, for an item's tag
export const TRACK = 22;            // height of one arc track above a row's nodes
export const CORNER_Y = 12;         // a corner label's distance below the top of its row
export const ARC_BASE = 24;         // the lowest arc runs this far above its nodes, clear of a step's tag
const LABEL_CHAR_W = 6.2;           // a stage name at about this width a character,
const LABEL_EXTRA = 40;             // plus the badge and the padding either side
const LABEL_PAD = 8;                // space between a row's label and its first node
const LEFT_MARGIN = 8;              // space left of the leftmost node
const NODE_GAP = 40;                // between neighbouring nodes of a row
const ITEM_GAP = 22;
const CLEAR = 6;                    // how close a line may pass a node
const MARGIN_GAP = 16;              // the right margin used by long edges
const MARGIN_STEP = 12;
const BACK_COST = 1.5;              // ordering: a leftward edge costs this much more than a rightward one
const MAX_PERMUTED = 7;
const MAX_ONE_LINE = 3;             // a row with more steps than this puts its loop re-entry steps on a second line

export function nodeSize(n: StructureNode): { w: number; h: number } {
  if (n.kind !== "node") return { w: 22, h: 22 };
  // a language-model step also carries a tag, so it is 18px wider
  return { w: Math.max(96, Math.ceil(n.id.length * CHAR_W) + 28) + (n.actor === "llm" ? 18 : 0), h: 36 };
}

/** Without stages: dagre's own ranked layout, no rows. */
function layoutFlat(structure: Structure): Layout {
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
    const size = itemSize(it.label);
    g.setNode(itemId(it.id), { width: size.w, height: size.h });
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
  return { nodes, edges, rows: [], width: gl.width ?? 0, height: gl.height ?? 0 };
}

/**
 * The rows, stacked from the top with no gaps: Start, one per stage in `stages` order, Finish. Each is `ROW_LINE` high
 * (Start also has `START_PAD` above, for an item's tag), plus `extraTop[i]` where arcs need room above the nodes. A stage
 * with no nodes still gets a row. `lines[i]` is the number of node lines in row i (default 1). `corner[i]` puts row i's label in its top-left corner, not on the node line. `line` is the height of the node line (more than `ROW_LINE` when the drawing is
 * stretched to a taller space). `nodes` is left empty for the caller to fill.
 */
export function computeRows(stages: StageDef[], width: number, extraTop: number[] = [], labelX = 22, line = ROW_LINE,
                            corner: boolean[] = [], lines: number[] = []): Row[] {
  const defs: Pick<Row, "key" | "kind" | "stage" | "number" | "name">[] = [
    { key: "start", kind: "start", stage: null, number: null, name: "Start" },
    ...stages.map((s, i) => ({ key: s.id, kind: "stage" as const, stage: s.id, number: i + 1, name: s.name })),
    { key: "end", kind: "end", stage: null, number: null, name: "Finish" },
  ];
  let y = 0;
  return defs.map((d, i) => {
    const pad = (extraTop[i] ?? 0) + (i === 0 ? START_PAD : 0);
    const n = lines[i] ?? 1;
    const h = pad + n * line;
    const up = !!corner[i];
    const ys = Array.from({ length: n }, (_, k) => y + pad + (k + 0.5) * line);
    const at = ys[0];
    const row: Row = { ...d, x: 0, y, w: width, h, label: { x: labelX, y: up ? y + CORNER_Y : at }, nodes: [], line: at, lines: ys, corner: up };
    y += h;
    return row;
  });
}

/** How far from the left edge a row's label reaches: its badge, its name and a little room. */
export const labelSpan = (name: string) => Math.ceil(name.length * LABEL_CHAR_W) + LABEL_EXTRA;

/** Order a row's nodes left to right: the order that keeps its own edges short, with as few leftward ones as possible.
 *  `pairs` are the edges between nodes of this row. Ties keep dagre's order; a big row falls back to it. */
function orderRow(ids: string[], pairs: [string, string][], dagreX: Map<string, number>): string[] {
  const base = [...ids].sort((a, b) => (dagreX.get(a) ?? 0) - (dagreX.get(b) ?? 0));
  if (base.length < 2 || base.length > MAX_PERMUTED) return base;
  let best = base, bestCost = Infinity;
  const perm = (rest: string[], chosen: string[]) => {
    if (!rest.length) {
      const at = new Map(chosen.map((id, i) => [id, i]));
      let cost = 0;
      for (const [s, t] of pairs) {
        const d = (at.get(t) as number) - (at.get(s) as number);
        cost += Math.abs(d) + (d < 0 ? BACK_COST : 0);
      }
      if (cost < bestCost - 1e-9) { bestCost = cost; best = chosen; }
      return;
    }
    rest.forEach((id, i) => perm([...rest.slice(0, i), ...rest.slice(i + 1)], [...chosen, id]));
  };
  perm(base, []);
  return best;
}

const longestSegment = (pts: Point[]) => {
  let best = { a: pts[0], b: pts[pts.length - 1], len: -1 };
  for (let i = 1; i < pts.length; i++) {
    const len = Math.abs(pts[i].x - pts[i - 1].x) + Math.abs(pts[i].y - pts[i - 1].y);
    if (len > best.len) best = { a: pts[i - 1], b: pts[i], len };
  }
  return best;
};

/** With stages: one row per stage. Dagre only gives each row's starting order; the row comes from the node's stage.
 *  A row with more than `MAX_ONE_LINE` steps puts the ones the run comes back to from a later row (a loop's way in) on a
 *  second line under it, which keeps the drawing narrow. Placement and routing work on "slots": a row's lines. */
function layoutRows(structure: Structure, flat: Layout, line = ROW_LINE): Layout {
  const stages = structure.stages as StageDef[];
  const last = stages.length + 1;
  const stageRow = new Map(stages.map((s, i) => [s.id, i + 1]));
  const dagreX = new Map(flat.nodes.map((n) => [n.id, n.x]));
  const nodes: LaidNode[] = flat.nodes.filter((n) => n.kind !== "item").map((n) => ({ ...n }));
  const items = flat.nodes.filter((n) => n.kind === "item").map((n) => ({ ...n }));
  const edges = structure.edges;

  // 1. each node's row: its stage's, Start, Finish; an unassigned step takes the row of its latest predecessor (else Start)
  const rowOf = new Map<string, number>();
  for (const n of nodes) {
    if (n.kind === "start") rowOf.set(n.id, 0);
    else if (n.kind === "end") rowOf.set(n.id, last);
    else if (n.stage && stageRow.has(n.stage)) rowOf.set(n.id, stageRow.get(n.stage) as number);
  }
  for (const n of nodes.filter((x) => !rowOf.has(x.id)).sort((a, b) => a.y - b.y)) {
    const preds = edges.filter((e) => e.target === n.id && e.source !== n.id && rowOf.has(e.source));
    rowOf.set(n.id, preds.length ? Math.max(...preds.map((e) => rowOf.get(e.source) as number)) : 0);
  }
  const byRow: string[][] = Array.from({ length: last + 1 }, () => []);
  for (const n of nodes) byRow[rowOf.get(n.id) as number].push(n.id);
  const by = new Map(nodes.map((n) => [n.id, n]));

  // 2. slots: a row's lines. A crowded row moves the steps a later row loops back to onto a second line.
  const reentry = new Set(edges.filter((e) => (rowOf.get(e.target) as number) < (rowOf.get(e.source) as number)).map((e) => e.target));
  const slotOf = new Map<string, number>();
  const slotsOfRow: number[][] = [];
  const bySlot: string[][] = [];
  byRow.forEach((ids, r) => {
    const low = ids.length > MAX_ONE_LINE ? ids.filter((id) => reentry.has(id)) : [];
    const groups = low.length && low.length < ids.length ? [ids.filter((id) => !low.includes(id)), low] : [ids];
    slotsOfRow[r] = groups.map((g) => {
      const s = bySlot.length;
      bySlot.push(g);
      g.forEach((id) => slotOf.set(id, s));
      return s;
    });
  });
  const slot = (id: string) => slotOf.get(id) as number;
  const rowIdx = (id: string) => rowOf.get(id) as number;
  const lineIdx = (id: string) => slotsOfRow[rowIdx(id)].indexOf(slot(id));

  // 3. left to right within each slot, then x: a step sits under its nearest earlier predecessor, so the main sequence
  //    is one vertical line; the rest of its line packs around it. A step on a second line sits under the leftmost step
  //    of the first line that it is joined to.
  const order: string[][] = bySlot.map((ids, s) => orderRow(ids,
    edges.filter((e) => e.source !== e.target && slotOf.get(e.source) === s && slotOf.get(e.target) === s)
      .map((e) => [e.source, e.target] as [string, string]), dagreX));
  const x = new Map<string, number>();
  let limit = -Infinity;
  const sep = (a: LaidNode, b: LaidNode) => a.w / 2 + NODE_GAP + b.w / 2;
  order.forEach((ids, s) => {
    const want = ids.map((id) => {
      const preds = edges.filter((e) => e.target === id && slot(e.source) < s);
      if (preds.length) {
        const nearest = Math.max(...preds.map((e) => slot(e.source)));
        return x.get((preds.find((e) => slot(e.source) === nearest) as StructureEdge).source);
      }
      const r = slotRow(s);
      if (slotsOfRow[r][0] === s) return undefined;
      const first = slotsOfRow[r][0];
      const joined = edges.flatMap((e) => (e.source === id ? [e.target] : e.target === id ? [e.source] : []))
        .filter((o) => slotOf.get(o) === first).map((o) => x.get(o) as number);
      return joined.length ? Math.min(...joined) : undefined;
    });
    const a = want.findIndex((v) => v !== undefined);
    const xs: number[] = new Array(ids.length).fill(0);
    const from = a < 0 ? 0 : a;
    xs[from] = a < 0 ? 0 : (want[a] as number);
    for (let i = from - 1; i >= 0; i--) xs[i] = xs[i + 1] - sep(by.get(ids[i]) as LaidNode, by.get(ids[i + 1]) as LaidNode);
    for (let i = from + 1; i < ids.length; i++) {
      const next = xs[i - 1] + sep(by.get(ids[i - 1]) as LaidNode, by.get(ids[i]) as LaidNode);
      xs[i] = Math.max(next, want[i] ?? -Infinity);
    }
    // a line never reaches further right than the widest multi-step line above it, so a wide step (or a short chain of
    // them) does not widen the drawing: the line is moved left as a whole, keeping its order
    const rightEdge = Math.max(...ids.map((id, i) => xs[i] + (by.get(id) as LaidNode).w / 2));
    if (limit > -Infinity && rightEdge > limit) for (let i = 0; i < xs.length; i++) xs[i] -= rightEdge - limit;
    if (ids.length > 1) limit = Math.max(limit, ...ids.map((id, i) => xs[i] + (by.get(id) as LaidNode).w / 2));
    ids.forEach((id, i) => x.set(id, xs[i]));
  });
  function slotRow(s: number) { return slotsOfRow.findIndex((a) => a.includes(s)); }
  for (const n of nodes) n.x = x.get(n.id) as number;

  // display-only items: in the Start row, to the left of the start node
  const start = nodes.find((n) => n.kind === "start");
  let edge = start ? start.x - start.w / 2
    : Math.min(0, ...byRow[0].map((id) => (by.get(id) as LaidNode).x - (by.get(id) as LaidNode).w / 2));
  for (const it of items) { it.x = edge - ITEM_GAP - it.w / 2; edge = it.x - it.w / 2; it.row = 0; }

  // 4. a small left margin; arcs above a line decide how tall each row is
  const all = [...nodes, ...items];
  const shift = LEFT_MARGIN - Math.min(...all.map((n) => n.x - n.w / 2));
  for (const n of all) n.x += shift;
  const right = Math.max(...all.map((n) => n.x + n.w / 2));

  const pos = (id: string) => order[slot(id)].indexOf(id);
  const opposite = (e: StructureEdge) => edges.some((o) => o.source === e.target && o.target === e.source);
  const arcOf = (e: StructureEdge) => {
    if (e.source === e.target || slot(e.source) !== slot(e.target)) return false;
    const d = pos(e.target) - pos(e.source);
    return !(Math.abs(d) === 1 && !(d < 0 && opposite(e)));
  };
  const level = new Map<StructureEdge, number>();
  const extraTop: number[] = new Array(last + 1).fill(0);
  for (let r = 0; r <= last; r++) {
    const s = slotsOfRow[r][0];
    const arcs = edges.filter((e) => slotOf.get(e.source) === s && arcOf(e))
      .map((e) => {
        const sx = (by.get(e.source) as LaidNode).x, tx = (by.get(e.target) as LaidNode).x;
        return { e, lo: Math.min(sx, tx) - 12, hi: Math.max(sx, tx) + 12 };
      })
      .sort((p, q) => (p.hi - p.lo) - (q.hi - q.lo));
    const placed: { lo: number; hi: number; k: number }[] = [];
    for (const arc of arcs) {
      let k = 1;
      while (placed.some((o) => o.k === k && o.lo < arc.hi && arc.lo < o.hi)) k++;
      placed.push({ lo: arc.lo, hi: arc.hi, k });
      level.set(arc.e, k);
      extraTop[r] = Math.max(extraTop[r], k * TRACK + ARC_BASE - 8);
    }
  }
  const names = ["Start", ...stages.map((st) => st.name), "Finish"];
  const corner = names.map((name, r) => {
    const left = Math.min(Infinity, ...byRow[r].map((id) => (by.get(id) as LaidNode).x - (by.get(id) as LaidNode).w / 2),
                          ...(r === 0 ? items.map((it) => it.x - it.w / 2) : []));
    return left < labelSpan(name) + LABEL_PAD;
  });
  const rows = computeRows(stages, 0, extraTop, 22, line, corner, slotsOfRow.map((a) => a.length));
  for (const n of nodes) {
    const row = rows[rowIdx(n.id)];
    n.row = rowIdx(n.id);
    n.y = row.lines[lineIdx(n.id)];
    row.nodes.push(n.id);
  }
  for (const it of items) { it.y = rows[0].line; rows[0].nodes.push(it.id); }

  // 5. orthogonal routes
  let margins = 0;
  const marginX = () => right + MARGIN_GAP + margins++ * MARGIN_STEP;
  const blockedAt = (px: number, from: number, to: number) => {
    for (let s = Math.min(from, to) + 1; s < Math.max(from, to); s++)
      for (const id of bySlot[s]) { const n = by.get(id) as LaidNode; if (Math.abs(px - n.x) < n.w / 2 + CLEAR) return true; }
    return false;
  };
  const blockedAlong = (s: number, self: string, x1: number, x2: number) =>
    bySlot[s].some((id) => {
      const n = by.get(id) as LaidNode;
      return id !== self && n.x + n.w / 2 + CLEAR > Math.min(x1, x2) && n.x - n.w / 2 - CLEAR < Math.max(x1, x2);
    });
  const viaMargin = (s: LaidNode, t: LaidNode): Point[] => {
    const mx = marginX();
    return [{ x: s.x + s.w / 2, y: s.y }, { x: mx, y: s.y }, { x: mx, y: t.y }, { x: t.x + t.w / 2, y: t.y }];
  };
  const route = (e: StructureEdge): Point[] => {
    const s = by.get(e.source) as LaidNode, t = by.get(e.target) as LaidNode;
    const ss = slot(s.id), st = slot(t.id);
    if (s === t) {
      const r = s.x + s.w / 2;
      return [{ x: r, y: s.y - 8 }, { x: r + 22, y: s.y - 8 }, { x: r + 22, y: s.y + 8 }, { x: r, y: s.y + 8 }];
    }
    if (ss === st) {
      const dir = t.x > s.x ? 1 : -1;
      if (!arcOf(e)) return [{ x: s.x + dir * s.w / 2, y: s.y }, { x: t.x - dir * t.w / 2, y: t.y }];
      const ya = s.y - 18 - ARC_BASE - ((level.get(e) as number) - 1) * TRACK;
      const sx = s.x + dir * 10, tx = t.x - dir * 10;
      return [{ x: sx, y: s.y - s.h / 2 }, { x: sx, y: ya }, { x: tx, y: ya }, { x: tx, y: t.y - t.h / 2 }];
    }
    if (ss < st) {                                            // forward, to a later line
      if (blockedAt(s.x, ss, st)) return viaMargin(s, t);
      if (Math.abs(s.x - t.x) < 1) return [{ x: s.x, y: s.y + s.h / 2 }, { x: t.x, y: t.y - t.h / 2 }];
      const yb = lineIdx(t.id) === 0 ? rows[rowIdx(t.id)].y : (s.y + t.y) / 2;   // between the lines
      return [{ x: s.x, y: s.y + s.h / 2 }, { x: s.x, y: yb }, { x: t.x, y: yb }, { x: t.x, y: t.y - t.h / 2 }];
    }
    // back to an earlier line: leave sideways, turn once, come in from below
    if (blockedAt(t.x, st, ss) || (Math.abs(s.x - t.x) >= 1 && blockedAlong(ss, s.id, s.x, t.x))) return viaMargin(s, t);
    if (Math.abs(s.x - t.x) < 1) return [{ x: s.x, y: s.y - s.h / 2 }, { x: t.x, y: t.y + t.h / 2 }];
    const dir = t.x > s.x ? 1 : -1;
    const tx = bySlot[st].some((id) => id !== t.id) || edges.some((o) => o.source === t.id && slot(o.target) > st)
      ? t.x - dir * 12 : t.x;                                  // off centre when another edge leaves that side
    return [{ x: s.x + dir * s.w / 2, y: s.y }, { x: tx, y: s.y }, { x: tx, y: t.y + t.h / 2 }];
  };
  const finish = (e: StructureEdge, points: Point[]): LaidEdge => {
    const seg = longestSegment(points);
    const along = (f: number) => ({ x: seg.a.x + (seg.b.x - seg.a.x) * f, y: seg.a.y + (seg.b.y - seg.a.y) * f });
    const vertical = Math.abs(seg.a.x - seg.b.x) < 1;
    const mid = along(0.5);
    const pillAt = vertical && seg.len > 60 ? along(0.3) : mid;   // a long vertical keeps its pill clear of a line crossing mid-way
    return { ...e, points, label: e.conditional && e.branch ? along(0.65) : null,   // nearer the head, clear of the tail's other lines
      pill: vertical ? { x: pillAt.x + 52, y: pillAt.y } : { x: mid.x, y: mid.y - 18 } };
  };
  const laid: LaidEdge[] = edges.map((e) => finish(e, route(e)));
  for (const fe of flat.edges.filter((e) => e.item)) {
    const it = items.find((n) => n.id === fe.source) as LaidNode;
    const to = start ?? (by.get(fe.target) as LaidNode);
    const end = start ? { x: to.x - to.w / 2, y: it.y } : { x: to.x - to.w / 2, y: to.y };
    laid.push({ source: fe.source, target: fe.target, conditional: false, branch: null, label: null, item: true,
      points: [{ x: it.x + it.w / 2, y: it.y }, end] });
  }

  // a label on the node line is moved to the corner of its row if a line of an edge would run through it
  rows.forEach((row, r) => {
    if (row.corner) return;
    const reach = labelSpan(names[r]) + LABEL_PAD;
    const crosses = laid.some((e) => e.points.some((pt, i) => {
      if (i === 0) return false;
      const q = e.points[i - 1];
      const horizontal = Math.abs(pt.y - q.y) < 1;
      const xs = [Math.min(pt.x, q.x), Math.max(pt.x, q.x)], ys = [Math.min(pt.y, q.y), Math.max(pt.y, q.y)];
      return row.lines.some((ly) => horizontal ? Math.abs(pt.y - ly) < 10 && xs[0] < reach && xs[1] > 0
                                               : xs[0] < reach && ys[0] < ly + 8 && ys[1] > ly - 8);
    }));
    if (crosses) { row.corner = true; row.label.y = row.y + CORNER_Y; }
  });

  const width = Math.ceil(Math.max(right + 16, ...laid.flatMap((e) => e.points.map((p) => p.x + 16))));
  for (const r of rows) r.w = width;
  const lastRow = rows[rows.length - 1];
  return { nodes: [...nodes, ...items], edges: laid, rows, width, height: lastRow.y + lastRow.h };
}

/** `minHeight`, when given, is the least height wanted for the drawing: with rows, the extra is shared out equally
 *  between them (a row's nodes stay the same size, with longer edges between rows). */
export function layoutGraph(structure: Structure, minHeight = 0): Layout {
  const flat = layoutFlat(structure);
  if (!structure.stages || !structure.stages.length) return flat;
  const natural = layoutRows(structure, flat);
  if (minHeight <= natural.height) return natural;
  const lines = natural.rows.reduce((sum, r) => sum + r.lines.length, 0);
  return layoutRows(structure, flat, ROW_LINE + (minHeight - natural.height) / lines);
}

export function pathData(points: Point[]): string {
  return points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
}
