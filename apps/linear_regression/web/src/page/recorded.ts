// The recorded run (app-specific): the events /api/run streams, saved once by the owner (scripts/record_run.py) and shipped as
// web/public/recorded-run.json. The page reads it for the hero, the verdict and the Scorebook from page load, and plays it back
// through the replay buffer. Nothing is fetched from the run route. A missing or malformed file is reported, never guessed at.
import { foldState, type StepEvent } from "../graph-replay/buffer";

export const RECORDED_URL = "/recorded-run.json";

export interface RecordedRun {
  recordedOn: string;
  modelName: string;
  events: StepEvent[];
  /** The state after the last step. */
  state: Record<string, unknown>;
}

const isEvent = (e: unknown): e is StepEvent => {
  const x = e as StepEvent | null;
  return !!x && typeof x === "object" && typeof x.step === "number" && typeof x.node === "string" &&
    typeof x.summary === "string" && !!x.changes && typeof x.changes === "object";
};

/** The recording, if the data has the shape the page reads: a date, a model name and a list of steps that reaches the final test. */
export function parseRecorded(data: unknown): RecordedRun | null {
  const d = data as { recorded_on?: unknown; model_name?: unknown; events?: unknown } | null;
  if (!d || typeof d !== "object" || typeof d.recorded_on !== "string" || typeof d.model_name !== "string") return null;
  if (!Array.isArray(d.events) || d.events.length === 0 || !d.events.every(isEvent)) return null;
  const events = d.events as StepEvent[];
  const state = foldState(events);
  if (!state.final) return null;
  return { recordedOn: d.recorded_on, modelName: d.model_name, events, state };
}

/** Fetch and check the recording. Null when it is missing or unusable. */
export async function loadRecorded(fetchFn: typeof fetch = fetch, url = RECORDED_URL): Promise<RecordedRun | null> {
  try {
    const res = await fetchFn(url);
    if (!res.ok) return null;
    return parseRecorded(await res.json());
  } catch {
    return null;
  }
}

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/** "22 October 2026" from "2026-10-22"; the input unchanged if it is not a date. */
export function dayText(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return iso;
  const month = MONTHS[Number(m[2]) - 1];
  return month ? `${Number(m[3])} ${month} ${m[1]}` : iso;
}
