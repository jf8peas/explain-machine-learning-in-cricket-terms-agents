// The shape of the structure response the component draws from (see contracts/structure.schema.json). Types only.
import type { Loop, Notes, StageDef, StructureItem } from "./stages";

export interface StructureNode {
  id: string; kind: "start" | "end" | "node";
  /** Optional: who does the step. */ actor?: "llm" | "code";
  /** Optional: the id of the stage (one of `Structure.stages`) the step belongs to. */ stage?: string;
  /** Optional: the id of the display row (one of `Structure.rows`) the step is drawn in. */ row?: string;
}
export interface StructureEdge { source: string; target: string; conditional: boolean; branch: string | null }
/** One display row: its title and a one-line note, both supplied by the app. */
export interface RowDef { id: string; title: string; note: string }
export interface Structure {
  nodes: StructureNode[]; edges: StructureEdge[];
  /** Optional: the ordered display rows, the stage set, the loop to emphasise, app notes and display-only items. */
  rows?: RowDef[]; stages?: StageDef[]; loop?: Loop; notes?: Notes; items?: StructureItem[];
  /** Optional: a plain-words line for each node saying what it is doing, keyed by node id (the app's words). */
  doing?: Record<string, string>;
}
