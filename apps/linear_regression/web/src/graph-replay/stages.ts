// Stage helpers: pure functions over what the structure response says. No stage name or app knowledge lives here;
// the stage set, the loop, the notes and the items all arrive in the structure.

/** One stage of the set the app supplies, in order. */
export interface StageDef { id: string; number: number; name: string; question: string; description: string }
/** The two stages whose connecting edges are emphasised once the run has gone round them. */
export interface Loop { fit: string; choose: string }
export interface Notes { general?: string; stages?: Record<string, string> }
export interface ItemSummary { text?: string; rows?: { label: string; value: string }[]; link?: { label: string; href: string } }
/** A display-only entry (work done before the run). Never a step: never active, visited, counted or in the timeline. */
export interface StructureItem { id: string; label: string; stage: string; before: string; summary: ItemSummary }

export const NEUTRAL_TOKEN = "--gr-stage-none";
const COLOURS = 8;

/** The colour token for a stage number; anything outside 1 to 8 gets the neutral one. */
export function colourToken(number: number): string {
  return Number.isInteger(number) && number >= 1 && number <= COLOURS ? `--gr-stage-${number}` : NEUTRAL_TOKEN;
}

/** The 1-based position of a stage id in the list, or null. The position is the number shown, whatever `number` says. */
export function stageNumberOf(stages: StageDef[], id: string): number | null {
  const i = stages.findIndex((s) => s.id === id);
  return i < 0 ? null : i + 1;
}

export type Resolved =
  | { state: "assigned"; stage: StageDef; number: number; token: string }
  | { state: "unassigned" }
  | { state: "none" };

/** What to show for a node: its stage, "unassigned" (no stage, or one not in the set), or nothing (start and end, or no
 *  stages in the structure at all). */
export function resolveStage(node: { kind: string; stage?: string }, stages: StageDef[] | undefined): Resolved {
  if ((node.kind !== "node" && node.kind !== "item") || !stages || stages.length === 0) return { state: "none" };
  const number = node.stage ? stageNumberOf(stages, node.stage) : null;
  if (number === null) return { state: "unassigned" };
  return { state: "assigned", stage: stages[number - 1], number, token: colourToken(number) };
}

/** The number of events up to the cursor whose node is in the fit stage: how many times the run has fitted the model.
 *  It depends only on the position, so moving back lowers it and a cursor of -1 (after Reset) gives 0. */
export function roundAt(events: { node: string }[], cursor: number, stageOf: (node: string) => string | null, fitStage: string): number {
  let rounds = 0;
  for (let i = 0; i <= Math.min(cursor, events.length - 1); i++) if (stageOf(events[i].node) === fitStage) rounds++;
  return rounds;
}

/** The edges that join a node in the loop's fit stage and a node in its choose stage, in either direction. */
export function loopEdges(structure: { nodes: { id: string; stage?: string }[]; edges: { source: string; target: string }[]; loop?: Loop }): { source: string; target: string }[] {
  const loop = structure.loop;
  if (!loop) return [];
  const stageOf = new Map(structure.nodes.map((n) => [n.id, n.stage]));
  return structure.edges.filter((e) => {
    const a = stageOf.get(e.source), b = stageOf.get(e.target);
    return (a === loop.fit && b === loop.choose) || (a === loop.choose && b === loop.fit);
  }).map((e) => ({ source: e.source, target: e.target }));
}
