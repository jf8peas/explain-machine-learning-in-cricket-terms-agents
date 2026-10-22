// The player's one button (app-specific, pure): its words and what pressing it does, from where the replay is. It starts a
// saved run (the recorded one, or the visitor's finished live one), pauses it while it plays (a visible pause for content that
// starts by itself), and watches it again at the end. Nothing here starts a run on the server.
export type ShownRun = "recorded" | "live";
export type PlayerAction = "play" | "pause" | "restart";

export interface PlayerInput {
  /** Which run the replay is showing: the recorded run, or the visitor's own live run. */
  shows: ShownRun;
  playing: boolean;
  /** The replay has finished and is on its last step. */
  atEnd: boolean;
  /** At least one step has been shown. */
  started: boolean;
}

export interface WatchButton { label: string; action: PlayerAction }

export const LABELS = {
  watch: "▶ Watch the recorded run",
  pause: "❚❚ Pause",
  resume: "▶ Resume",
  again: "▶ Watch again",
  yourAgain: "▶ Watch your run again",
} as const;

export function watchButton(i: PlayerInput): WatchButton {
  if (i.playing) return { label: LABELS.pause, action: "pause" };
  if (i.atEnd) return { label: i.shows === "live" ? LABELS.yourAgain : LABELS.again, action: "restart" };
  if (i.started) return { label: LABELS.resume, action: "play" };
  return { label: i.shows === "live" ? LABELS.yourAgain : LABELS.watch, action: "play" };
}
