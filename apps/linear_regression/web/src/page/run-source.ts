// Which run the page is showing (app-specific, pure). The recorded run is the default. A live run replaces it only once its
// final test has arrived, so the hero and the verdict never go blank or half-new; a live run that is refused or fails before then
// changes nothing. Everything that shows results reads `currentRun`; only the player reads the replay element.
import type { StepEvent } from "../graph-replay/buffer";

export interface RunInfo {
  kind: "recorded" | "live";
  modelName: string;
  /** The day it was recorded (recorded runs only). */
  recordedOn?: string;
  events: StepEvent[];
  state: Record<string, unknown>;
}

export interface SourceState {
  recorded: RunInfo | null;
  /** The visitor's latest finished live run, if any (until the page is reloaded). */
  live: RunInfo | null;
  /** A live run that has started and has not yet reached its final test. */
  pending: { modelName: string } | null;
}

export const initialSource = (recorded: RunInfo | null): SourceState => ({ recorded, live: null, pending: null });

/** The run the hero, verdict, Your turn and Scorebook show. */
export const currentRun = (s: SourceState): RunInfo | null => s.live ?? s.recorded;

/** A live run has been accepted and is streaming. The page keeps showing the current run. */
export function startLive(s: SourceState, modelName: string): SourceState {
  return { ...s, pending: { modelName } };
}

/** Steps have arrived. When the pending run has received its final test it becomes the current run. */
export function received(s: SourceState, events: StepEvent[], state: Record<string, unknown>): SourceState {
  if (!s.pending || !state.final) return s;
  const modelName = typeof state.model_name === "string" && state.model_name ? state.model_name : s.pending.modelName;
  return { ...s, pending: null, live: { kind: "live", modelName, events, state } };
}

/** The server refused the start (nothing streamed): nothing changes. */
export function refused(s: SourceState): SourceState {
  return { ...s, pending: null };
}

/** The live run ended badly. Returns the new state and the events the replay should go back to showing: the current run's
 *  (the recorded run, or an earlier or already-switched live run), or none if there is nothing to go back to. */
export function failed(s: SourceState): { state: SourceState; show: StepEvent[] | null } {
  const next = { ...s, pending: null };
  return { state: next, show: currentRun(next)?.events ?? null };
}

/** The toolbar's label for the run on the page. */
export function runLabel(run: RunInfo | null, day: (iso: string) => string): string {
  if (!run) return "";
  return run.kind === "live" ? `Your live run · ${run.modelName}` : `Recorded ${day(run.recordedOn ?? "")} · ${run.modelName}`;
}

/** The line under the Scoreboard card. */
export function originLine(run: RunInfo | null, day: (iso: string) => string): string {
  if (!run) return "";
  return run.kind === "live"
    ? `From your live run with ${run.modelName}.`
    : `From a recorded run on ${day(run.recordedOn ?? "")} with ${run.modelName}. Run it live to see your own.`;
}
