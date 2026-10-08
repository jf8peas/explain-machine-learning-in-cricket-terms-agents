import { describe, expect, it } from "vitest";
import { LONG_ARRAY, summarise } from "../../src/graph-replay/state-view";

const items = (n: number) => Array.from({ length: n }, (_, i) => i);

describe("summarise", () => {
  it("turns an array longer than the limit into a count", () => {
    expect(LONG_ARRAY).toBe(20);
    expect(summarise(items(21))).toBe("21 items");
    expect(summarise(items(412))).toBe("412 items");
  });

  it("leaves an array of the limit or fewer as it is", () => {
    expect(summarise(items(20))).toEqual(items(20));
    expect(summarise([])).toEqual([]);
    expect(summarise(["a", "b"])).toEqual(["a", "b"]);
  });

  it("summarises long arrays at any depth and keeps the rest of the object readable", () => {
    const value = { actual: items(515), predicted: { llm: items(515), forward: items(30) }, note: "kept", n: 515, ok: true, none: null };
    expect(summarise(value)).toEqual({
      actual: "515 items", predicted: { llm: "515 items", forward: "30 items" }, note: "kept", n: 515, ok: true, none: null,
    });
  });

  it("looks inside a short array for long ones", () => {
    expect(summarise([{ points: items(50) }, { points: items(3) }])).toEqual([{ points: "50 items" }, { points: [0, 1, 2] }]);
  });

  it("leaves strings, numbers, booleans and null alone", () => {
    for (const v of ["text", 7, 0, false, null]) expect(summarise(v)).toBe(v);
  });

  it("does not change what it is given", () => {
    const value = { a: items(25) };
    const before = JSON.stringify(value);
    summarise(value);
    expect(JSON.stringify(value)).toBe(before);
  });

  it("knows nothing about what the items are", () => {
    expect(summarise({ anything: items(99) })).toEqual({ anything: "99 items" });
  });
});
