import { beforeEach, describe, expect, it } from "vitest";
import { ReplayBuffer, type Clock, type StepEvent } from "../../src/graph-replay/buffer";

class FakeClock implements Clock {
  fn: (() => void) | null = null;
  ms = 0;
  setInterval(fn: () => void, ms: number) { this.fn = fn; this.ms = ms; return 1; }
  clearInterval() { this.fn = null; }
  tick(n = 1) { for (let i = 0; i < n; i++) this.fn?.(); }
}

const ev = (step: number, node: string, changes: Record<string, unknown> = {}): StepEvent =>
  ({ step, node, summary: `did ${node}`, changes });

let clock: FakeClock;
let b: ReplayBuffer;
beforeEach(() => { clock = new FakeClock(); b = new ReplayBuffer(clock); });

describe("buffering and paced playback", () => {
  it("buffers events in order without moving the display", () => {
    b.push(ev(1, "a")); b.push(ev(2, "b"));
    expect(b.events.map((e) => e.node)).toEqual(["a", "b"]);
    expect(b.cursor).toBe(-1);
  });

  it("shows the first step as soon as it arrives while playing", () => {
    b.play();
    expect(b.cursor).toBe(-1);
    b.push(ev(1, "a"));
    expect(b.cursor).toBe(0);
  });

  it("advances one step per interval, holding events that arrived early", () => {
    b.push(ev(1, "a")); b.push(ev(2, "b")); b.push(ev(3, "c"));
    b.play();
    expect(b.cursor).toBe(0);
    clock.tick();
    expect(b.cursor).toBe(1);
    clock.tick();
    expect(b.cursor).toBe(2);
  });

  it("waits when the display catches up, then continues when more arrive", () => {
    b.push(ev(1, "a")); b.play();
    clock.tick(); clock.tick();
    expect(b.cursor).toBe(0);
    expect(b.playing).toBe(true);
    b.push(ev(2, "b"));
    clock.tick();
    expect(b.cursor).toBe(1);
  });

  it("stops playing at the end once the stream has finished", () => {
    b.push(ev(1, "a")); b.play(); b.finish();
    expect(b.playing).toBe(false);
    expect(b.atEnd).toBe(true);
  });

  it("applies a speed change to later steps", () => {
    b.push(ev(1, "a")); b.push(ev(2, "b")); b.play();
    expect(clock.ms).toBe(1500);
    b.setSpeed(500);
    expect(clock.ms).toBe(500);
    expect(b.playing).toBe(true);
  });

  it("pause stops advancing and resume continues", () => {
    b.push(ev(1, "a")); b.push(ev(2, "b")); b.push(ev(3, "c")); b.play();
    b.pause();
    clock.tick();
    expect(b.cursor).toBe(0);
    b.play(); clock.tick();
    expect(b.cursor).toBe(1);
  });
});

describe("the timeline lists only steps reached so far", () => {
  it("grows as the display advances, not as events arrive", () => {
    ["a", "b", "c"].forEach((n, i) => b.push(ev(i + 1, n)));
    expect(b.reached).toHaveLength(0);
    b.play();
    expect(b.reached.map((e) => e.node)).toEqual(["a"]);
    clock.tick();
    expect(b.reached.map((e) => e.node)).toEqual(["a", "b"]);
  });

  it("cannot jump to a step that has not been reached", () => {
    ["a", "b", "c"].forEach((n, i) => b.push(ev(i + 1, n)));
    b.play(); b.pause();
    b.jump(2);
    expect(b.cursor).toBe(0);
  });
});

describe("navigation replays from the buffer", () => {
  beforeEach(() => {
    ["a", "b", "c", "b"].forEach((n, i) => b.push(ev(i + 1, n)));
    b.finish();
    for (let i = 0; i < 4; i++) b.next(); // the visitor has reached every step
  });

  it("steps back and forward", () => {
    b.prev(); expect(b.cursor).toBe(2);
    b.next(); expect(b.cursor).toBe(3);
  });

  it("jumps to any step", () => {
    b.jump(1); expect(b.cursor).toBe(1);
  });

  it("ignores stepping past either end", () => {
    b.next(); expect(b.cursor).toBe(3);
    b.jump(0); b.prev(); b.prev(); expect(b.cursor).toBe(-1);
    b.prev(); expect(b.cursor).toBe(-1);
  });

  it("ignores an out-of-range jump", () => {
    b.jump(99); expect(b.cursor).toBe(3);
  });

  it("keeps steps reachable after stepping back", () => {
    b.jump(0);
    expect(b.reached).toHaveLength(4);
    b.jump(3); expect(b.cursor).toBe(3);
  });

  it("does not change what was received", () => {
    const before = JSON.stringify(b.events);
    b.prev(); b.jump(0); b.next();
    expect(JSON.stringify(b.events)).toBe(before);
    expect(b.events).toHaveLength(4);
  });

  it("stepping pauses playback", () => {
    b.jump(0); b.play(); b.next();
    expect(b.playing).toBe(false);
  });

  it("counts repeat visits up to the cursor", () => {
    expect(b.visitCounts(3).get("b")).toBe(2);
    expect(b.visitCounts(2).get("b")).toBe(1);
    expect(b.visitCounts().get("a")).toBe(1);
  });

  it("reset clears everything for a fresh run", () => {
    b.reset();
    expect(b.events).toEqual([]);
    expect(b.cursor).toBe(-1);
    expect(b.finished).toBe(false);
    expect(b.playing).toBe(false);
  });
});
