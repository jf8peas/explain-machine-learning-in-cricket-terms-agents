import { describe, expect, it } from "vitest";
import { ReplayBuffer, type StepEvent } from "../../src/graph-replay/buffer";

const events: StepEvent[] = [
  { step: 1, node: "a", summary: "s1", changes: { x: 1, y: "one" } },
  { step: 2, node: "b", summary: "s2", changes: { y: "two", z: [1, 2] } },
  { step: 3, node: "c", summary: "s3", changes: { z: [1, 2, 3] } },
];

function buffer() {
  const b = new ReplayBuffer();
  events.forEach((e) => b.push(e));
  b.finish();
  return b;
}

describe("accumulated state", () => {
  it("is the shallow merge of changes 1..N", () => {
    const b = buffer();
    expect(b.stateAt(0)).toEqual({ x: 1, y: "one" });
    expect(b.stateAt(1)).toEqual({ x: 1, y: "two", z: [1, 2] });
    expect(b.stateAt(2)).toEqual({ x: 1, y: "two", z: [1, 2, 3] });
  });

  it("is the same when revisited in any order", () => {
    const b = buffer();
    const forward = [0, 1, 2].map((i) => JSON.stringify(b.stateAt(i)));
    const backward = [2, 1, 0].map((i) => JSON.stringify(b.stateAt(i))).reverse();
    expect(backward).toEqual(forward);
  });

  it("reports exactly the keys the step changed", () => {
    const b = buffer();
    expect(b.changedKeysAt(0)).toEqual(["x", "y"]);
    expect(b.changedKeysAt(1)).toEqual(["y", "z"]);
    expect(b.changedKeysAt(2)).toEqual(["z"]);
  });

  it("is empty before the first step", () => {
    const b = new ReplayBuffer();
    expect(b.stateAt()).toEqual({});
    expect(b.changedKeysAt()).toEqual([]);
  });
});
