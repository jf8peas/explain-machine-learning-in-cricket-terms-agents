import { describe, expect, it } from "vitest";
import { limitsText, loadModels, optionText, orderModels, runUrl, type ModelChoice } from "../../src/page/models";

const m = (name: string, def = false, choice = "m1"): ModelChoice => ({ name, note: `${name} note`, default: def, choice });

describe("the live-run model list", () => {
  it("puts the default first, marks it, and keeps the others in the owner's order", () => {
    const ordered = orderModels([m("Quick", false, "m1"), m("Fast", true, "m2"), m("Thorough", false, "m3")]);
    expect(ordered.map((x) => x.name)).toEqual(["Fast", "Quick", "Thorough"]);
    expect(ordered.map(optionText)).toEqual(["Fast (default)", "Quick", "Thorough"]);
  });

  it("asks for the run by the choice token, never an id", () => {
    expect(runUrl("m2")).toBe("/api/run?model=m2");
    expect(runUrl(null)).toBe("/api/run");
  });

  it("words the limits from the server's settings, and says nothing without them", () => {
    expect(limitsText({ per_hour: 5, deadline_seconds: 80 })).toBe("A run takes up to about 80 seconds; 5 live runs an hour per visitor.");
    expect(limitsText({ per_hour: 1, deadline_seconds: 45 })).toContain("one live run an hour per visitor");
    expect(limitsText(undefined)).toBe("");
  });

  it("loadModels reports a failure as null and returns the default first", async () => {
    const answer = (ok: boolean, body: unknown) => (async () => ({ ok, json: async () => body }) as Response) as unknown as typeof fetch;
    const got = await loadModels(answer(true, { models: [m("A"), m("B", true)], run: { per_hour: 5, deadline_seconds: 80 } }));
    expect(got!.models[0].name).toBe("B");
    expect(got!.run).toEqual({ per_hour: 5, deadline_seconds: 80 });
    expect(await loadModels(answer(false, {}))).toBeNull();
    expect(await loadModels((async () => { throw new Error("offline"); }) as unknown as typeof fetch)).toBeNull();
  });
});
