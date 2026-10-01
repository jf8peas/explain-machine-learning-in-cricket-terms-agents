// Event buffer + paced playback + cursor navigation. Pure logic: no DOM, injectable clock.
// Fetching and display are separate: events are buffered as they arrive, and the display
// cursor advances at the chosen pace. Back/jump/reset replay from the buffer only.

export interface StepEvent {
  step: number;
  node: string;
  summary: string;
  changes: Record<string, unknown>;
}

export interface Clock {
  setInterval(fn: () => void, ms: number): unknown;
  clearInterval(handle: unknown): void;
}

export const realClock: Clock = {
  setInterval: (fn, ms) => setInterval(fn, ms),
  clearInterval: (h) => clearInterval(h as ReturnType<typeof setInterval>),
};

export const DEFAULT_INTERVAL_MS = 1500;

export class ReplayBuffer {
  events: StepEvent[] = [];
  /** Index of the step on display; -1 before the first step is shown. */
  cursor = -1;
  /** Highest step index ever shown in this run; the timeline lists only steps reached so far. */
  maxCursor = -1;
  /** True once the stream has delivered `done` (or ended). */
  finished = false;
  playing = false;
  intervalMs = DEFAULT_INTERVAL_MS;
  private timer: unknown = null;

  constructor(private clock: Clock = realClock, private onChange: () => void = () => {}) {}

  // ---- receiving ----
  push(e: StepEvent): void {
    this.events.push(e);
    // The first step shows as soon as it arrives while playing; later steps follow the pace.
    if (this.playing && this.cursor === -1) this.setCursor(0);
    this.onChange();
  }

  finish(): void {
    this.finished = true;
    if (this.playing && this.cursor >= this.events.length - 1) this.stopTimer(true);
    this.onChange();
  }

  /** Clear everything for a fresh run (Play again) or Reset. */
  reset(): void {
    this.stopTimer(false);
    this.events = [];
    this.cursor = -1;
    this.maxCursor = -1;
    this.finished = false;
    this.playing = false;
    this.onChange();
  }

  private setCursor(i: number): void {
    this.cursor = i;
    if (i > this.maxCursor) this.maxCursor = i;
  }

  // ---- playback ----
  play(): void {
    if (this.playing) return;
    this.playing = true;
    if (this.cursor === -1 && this.events.length) this.setCursor(0);
    this.startTimer();
    this.onChange();
  }

  pause(): void {
    this.stopTimer(true);
    this.onChange();
  }

  setSpeed(intervalMs: number): void {
    this.intervalMs = intervalMs;
    if (this.playing) {
      this.clock.clearInterval(this.timer);
      this.startTimer();
    }
    this.onChange();
  }

  private startTimer(): void {
    this.timer = this.clock.setInterval(() => this.tick(), this.intervalMs);
  }

  private stopTimer(clearPlaying: boolean): void {
    if (this.timer !== null) this.clock.clearInterval(this.timer);
    this.timer = null;
    if (clearPlaying) this.playing = false;
  }

  private tick(): void {
    if (this.cursor < this.events.length - 1) {
      this.setCursor(this.cursor + 1);
      this.onChange();
    } else if (this.finished) {
      this.stopTimer(true);
      this.onChange();
    } // otherwise: wait for more events
  }

  // ---- navigation (always from the buffer, never refetching) ----
  next(): void {
    this.pause();
    if (this.cursor < this.events.length - 1) {
      this.setCursor(this.cursor + 1);
      this.onChange();
    }
  }

  prev(): void {
    this.pause();
    if (this.cursor > -1) {
      this.cursor -= 1;
      this.onChange();
    }
  }

  jump(index: number): void {
    this.pause();
    if (index >= 0 && index <= this.maxCursor && index < this.events.length) {
      this.setCursor(index);
      this.onChange();
    }
  }

  // ---- derived views ----
  /** Steps the visitor has reached so far (what the timeline shows). */
  get reached(): StepEvent[] {
    return this.events.slice(0, this.maxCursor + 1);
  }

  get atEnd(): boolean {
    return this.finished && this.cursor === this.events.length - 1;
  }

  /** Visit counts per node for steps 0..cursor. */
  visitCounts(upTo = this.cursor): Map<string, number> {
    const m = new Map<string, number>();
    for (let i = 0; i <= upTo && i < this.events.length; i++) {
      m.set(this.events[i].node, (m.get(this.events[i].node) ?? 0) + 1);
    }
    return m;
  }

  /** Accumulated state after step `index`: shallow merge of every `changes` up to it. */
  stateAt(index = this.cursor): Record<string, unknown> {
    const state: Record<string, unknown> = {};
    for (let i = 0; i <= index && i < this.events.length; i++) Object.assign(state, this.events[i].changes);
    return state;
  }

  /** Keys that the step at `index` changed. */
  changedKeysAt(index = this.cursor): string[] {
    return index >= 0 && index < this.events.length ? Object.keys(this.events[index].changes) : [];
  }
}
