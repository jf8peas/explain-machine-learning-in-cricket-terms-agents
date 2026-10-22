// The page's one run state (feature 022, app-specific, pure): where the reader's current run is (idle, running, finished or failed) and
// the visit's last run that reached its final test. Everything that depends on a run reads it: the button, the status line, the graph's
// ring, "Right now", and every lock (verdict, Your turn, the run-dependent Scorebook cards). Nothing is stored: a reload is a new state.
import { foldState, type StepEvent } from "../graph-replay/buffer";
import { term } from "./terms";

export type Phase = "idle" | "running" | "finished" | "failed";

export interface Run {
  events: StepEvent[];
  /** The state after the last step received. */
  state: Record<string, unknown>;
  modelName: string;
  /** The node that has started and not yet completed. */
  inProgress: string | null;
  /** The node that was running when the run stopped part-way. */
  stoppedAt: string | null;
}

export interface RunState {
  phase: Phase;
  /** The run streaming now, or the one that just ended. */
  current: Run | null;
  /** The visit's last run that reached its final test: what every result shows. */
  last: Run | null;
  /** A failure to show beside the player (or a refusal, until the next press). */
  message: string | null;
  /** The state before the last press, so a refused start can put everything back. */
  before: RunState | null;
}

export const initialRunState = (): RunState => ({ phase: "idle", current: null, last: null, message: null, before: null });

const emptyRun = (modelName: string): Run => ({ events: [], state: {}, modelName, inProgress: null, stoppedAt: null });

/** The reader pressed Play or Run again with this model. A run in progress ignores it. */
export function press(s: RunState, modelName: string): RunState {
  if (s.phase === "running") return s;
  return { phase: "running", current: emptyRun(modelName), last: s.last, message: null, before: s };
}

/** The server refused the start (nothing streamed): everything goes back as it was, with the refusal to show. */
export function refused(s: RunState, message: string): RunState {
  const back = s.before ?? initialRunState();
  return { ...back, message, before: null };
}

/** A node began. */
export function started(s: RunState, e: { node: string }): RunState {
  if (s.phase !== "running" || !s.current) return s;
  return { ...s, current: { ...s.current, inProgress: e.node } };
}

/** A node completed. The run becomes `last` as soon as its state holds the final test, and follows the run until it ends. */
export function stepped(s: RunState, e: StepEvent): RunState {
  if (s.phase !== "running" || !s.current) return s;
  const events = [...s.current.events, e];
  const state = foldState(events);
  const modelName = typeof state.model_name === "string" && state.model_name ? state.model_name : s.current.modelName;
  const current: Run = { events, state, modelName, inProgress: null, stoppedAt: null };
  return { ...s, current, last: state.final ? current : s.last };
}

/** The stream ended normally. */
export function finished(s: RunState): RunState {
  if (s.phase !== "running" || !s.current) return s;
  return { ...s, phase: "finished", current: { ...s.current, inProgress: null }, before: null };
}

/** The run stopped part-way (an error, or a lost connection). The node that was running keeps its error mark. */
export function failed(s: RunState, reason: string): RunState {
  if (s.phase !== "running" || !s.current) return s;
  const current = { ...s.current, inProgress: null, stoppedAt: s.current.inProgress };
  return { ...s, phase: "failed", current, message: reason, before: null };
}

// ---------------- derived ----------------

export interface Buttons {
  /** The main button's words and whether it can be pressed. */
  play: { label: string; disabled: boolean };
  /** "Watch it again" is offered when there is a run to replay. */
  watchAgain: boolean;
  selectDisabled: boolean;
}

export const PLAY = "▶ Play";
export const RUNNING = "Running…";
export const RUN_AGAIN = "▶ Run again";
export const WATCH_AGAIN = "Watch it again";

export function buttons(s: RunState): Buttons {
  const replayable = !!(s.last ?? (s.phase === "finished" ? s.current : null));
  if (s.phase === "running") return { play: { label: RUNNING, disabled: true }, watchAgain: false, selectDisabled: true };
  return { play: { label: s.last || s.phase === "finished" ? RUN_AGAIN : PLAY, disabled: false }, watchAgain: replayable, selectDisabled: false };
}

/** The run "Watch it again" replays: the visit's last finished run. */
export const replayable = (s: RunState): Run | null => s.last ?? (s.phase === "finished" ? s.current : null);

export type LockVariant = "before" | "during" | "failed";
export interface Lock { locked: boolean; variant: LockVariant }

/** The state of the verdict, Your turn and the run-dependent Scorebook cards: unlocked once any run of the visit has reached its
 *  final test, and then kept (a later run, running or failed, does not lock them again). */
export function lock(s: RunState): Lock {
  if (s.last) return { locked: false, variant: "before" };
  const variant: LockVariant = s.phase === "running" ? "during" : s.phase === "idle" ? "before" : "failed";
  return { locked: true, variant };
}

const roundsOf = (state: Record<string, unknown>) => Number(state.rounds_used ?? 0);
const best = (state: Record<string, unknown>): number | null => {
  const a = state.llm_best as { validation_mae?: number } | null | undefined;
  const f = state.forward_best as { validation_mae?: number } | null | undefined;
  const v = a?.validation_mae ?? f?.validation_mae;
  return typeof v === "number" ? v : null;
};
const tookPart = (state: Record<string, unknown>) => (state.final as { llm_took_part?: boolean } | undefined)?.llm_took_part !== false;
const tenth = (x: number) => x.toFixed(1);

/** The shown status line. `doing` is the plain-words line for the node now running. */
export function statusText(s: RunState, doing: string | null): string {
  if (s.phase === "idle") return "Ready. Choose the AI and press play.";
  const run = s.current;
  const model = run?.modelName ?? "";
  if (s.phase === "running") return `Live with ${model}${doing ? ` · ${doing}` : ""}`;
  if (s.phase === "failed") return `Stopped: ${s.message ?? ""}`.trim();
  const score = run ? best(run.state) : null;
  const scored = score === null ? "" : ` · best ${tenth(score)} on the ${term("check_seasons")}`;
  if (run && !tookPart(run.state)) return `Finished with the ${term("brute_force")} alone${scored}`;
  const tries = run ? roundsOf(run.state) : 0;
  return `Finished with ${model} · ${tries} ${tries === 1 ? "try" : "tries"}${scored}`;
}

/** What is spoken: phase changes, and changes between an AI step and a code step. Never every node. */
export function announcement(s: RunState, kind: "ai" | "code" | null): string {
  if (s.phase === "idle") return "";
  const model = s.current?.modelName ?? "";
  if (s.phase === "running") {
    if (!s.current?.events.length && !kind) return `The run has started with ${model}.`;
    return kind === "ai" ? `The ${term("agent")} is deciding.` : kind === "code" ? "Code is working." : "";
  }
  if (s.phase === "failed") return `The run stopped: ${s.message ?? ""}`;
  return `The run has finished with ${model}.`;
}

export interface RightNow {
  step: string;
  doing: string;
  round: string;
  best: string;
  stopped: string | null;
}

/** The "Right now" card for a step: the node, what it is doing, the round and the best score so far. */
export function describeStep(node: string | null, state: Record<string, unknown>, doing: Record<string, string>,
                             roundCap: number | null, stopped: string | null = null): RightNow {
  const rounds = roundsOf(state);
  const score = best(state);
  return {
    step: node ?? "—",
    doing: node ? doing[node] ?? "—" : "—",
    round: rounds > 0 ? (roundCap ? `${rounds} of up to ${roundCap}` : String(rounds)) : "—",
    best: score === null ? "—" : tenth(score),
    stopped,
  };
}

/** The card for the run now on the page: the node working (or last to finish, or the one that was working when it stopped). */
export function rightNow(s: RunState, doing: Record<string, string>, roundCap: number | null): RightNow {
  const run = s.current ?? s.last;
  if (!run) return describeStep(null, {}, doing, roundCap);
  const events = run.events;
  const node = run.stoppedAt ?? run.inProgress ?? (events.length ? events[events.length - 1].node : null);
  return describeStep(node, run.state, doing, roundCap, s.phase === "failed" ? `Stopped: ${s.message ?? ""}`.trim() : null);
}

/** The result strip's words ("goal reached", "The agent was 17.9 runs out, the broadcaster 21.4."), from the run whose results are shown. */
export function resultStrip(s: RunState): { label: string; text: string } | null {
  const strip = ((s.last?.state.final as { headlines?: { result_strip?: { label: string; text: string } } } | undefined)?.headlines ?? {}).result_strip;
  return strip ?? null;
}
