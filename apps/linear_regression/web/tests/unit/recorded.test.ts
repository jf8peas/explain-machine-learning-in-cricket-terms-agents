import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ReplayBuffer, type StepEvent } from "../../src/graph-replay/buffer";
import { loadRecorded, parseRecorded } from "../../src/page/recorded";

const fixture = () => JSON.parse(readFileSync("tests/fixtures/recorded-run.fake.json", "utf8"));

describe("the recorded run", () => {
  it("reads the scripted recording and folds it to the same final state the replay buffer reaches", () => {
    const run = parseRecorded(fixture());
    expect(run).not.toBeNull();
    const b = new ReplayBuffer();
    for (const e of fixture().events as StepEvent[]) b.push(e);
    b.finish();
    expect(run!.state).toEqual(b.stateAt(b.events.length - 1));
    expect(run!.modelName).toBe(fixture().model_name);
    expect(run!.recordedOn).toBe(fixture().recorded_on);
    expect((run!.state.final as { headlines: { case: string } }).headlines.case).toMatch(/^(beat|edged|held|no_llm)$/);
  });

  it("refuses data that is not a recording", () => {
    for (const bad of [null, {}, "x", { recorded_on: "2026-10-22", model_name: "M", events: [] },
      { recorded_on: "2026-10-22", model_name: "M", events: [{ step: 1 }] },
      { recorded_on: 5, model_name: "M", events: fixture().events },
      { recorded_on: "2026-10-22", model_name: "M", events: fixture().events.slice(0, 3) }]) {   // never reaches the final test
      expect(parseRecorded(bad)).toBeNull();
    }
  });

  it("loadRecorded reports a missing or broken file as null, never throws", async () => {
    const answer = (init: { ok: boolean; body?: unknown; throws?: boolean }) => (async () => {
      if (init.throws) throw new Error("offline");
      return { ok: init.ok, json: async () => init.body } as Response;
    }) as unknown as typeof fetch;
    expect(await loadRecorded(answer({ ok: true, body: fixture() }))).not.toBeNull();
    expect(await loadRecorded(answer({ ok: false }))).toBeNull();
    expect(await loadRecorded(answer({ ok: true, body: { nope: 1 } }))).toBeNull();
    expect(await loadRecorded(answer({ ok: true, throws: true }))).toBeNull();
  });
});
