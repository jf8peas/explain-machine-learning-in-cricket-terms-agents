// When each result tab is ready, which markers to show, and when to move the visitor to What the agent found.
// A pure function: it takes the previous readiness and a replaychange detail, and returns the new readiness and the actions
// for the page to carry out. It knows nothing about the DOM.

export type ResultTab = "found" | "final-test" | "try-your-own";
const TABS: ResultTab[] = ["found", "final-test", "try-your-own"];
const KEY: Record<ResultTab, "found" | "final" | "tryit"> = { found: "found", "final-test": "final", "try-your-own": "tryit" };

export interface Readiness {
  run: number;
  /** What the display shows now: it can fall when the visitor steps back (try-your-own follows the finished run). */
  ready: { found: boolean; final: boolean; tryit: boolean };
  /** A tab's marker is announced once per run, so stepping back and forward does not set it again. */
  announced: { found: boolean; final: boolean; tryit: boolean };
  /** The switch to What the agent found has happened for this run. */
  switched: boolean;
}

export type Action =
  | { type: "switch"; tab: "found"; focus: true }
  | { type: "marker"; tab: ResultTab; on: boolean }
  | { type: "notReady"; tab: ResultTab; show: boolean };

/** The part of a replaychange detail the machine reads. */
export interface Detail {
  run: number;
  steps: number;
  atEnd: boolean;
  failed: boolean;
  state: Record<string, unknown>;
  finalState: Record<string, unknown> | null;
}

const none = { found: false, final: false, tryit: false };
export const initial: Readiness = { run: 0, ready: { ...none }, announced: { ...none }, switched: false };

/** The winner's model, once the run has finished (the same test the try-your-own form uses). */
export function hasModel(state: Record<string, unknown> | null): boolean {
  return !!state && !!state.coefficients && state.intercept !== undefined && !!state.final && !!state.explanation;
}

const hasList = (v: unknown) => Array.isArray(v) && v.length > 0;

/** `active` is the id of the tab on display. */
export function step(prev: Readiness, d: Detail, active: string): { state: Readiness; actions: Action[] } {
  const actions: Action[] = [];
  let base = prev;
  if (d.run > prev.run) {
    // a new run: every result tab goes back to "not ready" and the switch is armed again; the visitor stays where they are
    base = { run: d.run, ready: { ...none }, announced: { ...none }, switched: false };
    for (const tab of TABS) actions.push({ type: "marker", tab, on: false }, { type: "notReady", tab, show: true });
  }
  const s = d.state;
  const ready = {
    found: hasList(s.attempts) || hasList(s.rounds) || !!s.final,
    final: !!s.final,
    tryit: hasModel(d.finalState),
  };
  const announced = { ...base.announced };
  for (const tab of TABS) {
    const k = KEY[tab];
    if (ready[k] !== base.ready[k]) actions.push({ type: "notReady", tab, show: !ready[k] });
    if (ready[k] && !announced[k] && tab !== active) {
      announced[k] = true;
      actions.push({ type: "marker", tab, on: true });
    }
  }
  let switched = base.switched;
  if (d.atEnd && d.steps > 0 && !d.failed && !s.data_error && !base.switched && d.run > 0) {
    switched = true;
    actions.push({ type: "switch", tab: "found", focus: true });
    announced.found = true;                          // the visitor is taken there: no marker for it
    actions.push({ type: "marker", tab: "found", on: false });
  }
  return { state: { run: base.run, ready, announced, switched }, actions };
}
