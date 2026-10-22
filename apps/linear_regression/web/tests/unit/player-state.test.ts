import { describe, expect, it } from "vitest";
import { watchButton, type PlayerInput } from "../../src/page/player-state";

const input = (over: Partial<PlayerInput> = {}): PlayerInput => ({ shows: "recorded", playing: false, atEnd: false, started: false, ...over });

describe("the player's one button", () => {
  it("offers the recorded run before anything has played", () => {
    expect(watchButton(input())).toEqual({ label: "▶ Watch the recorded run", action: "play" });
  });

  it("reads Pause while the run plays, which pauses it (content that starts by itself can be paused)", () => {
    expect(watchButton(input({ playing: true, started: true }))).toEqual({ label: "❚❚ Pause", action: "pause" });
    expect(watchButton(input({ playing: true, started: true, shows: "live" }))).toEqual({ label: "❚❚ Pause", action: "pause" });
  });

  it("reads Resume when paused part-way", () => {
    expect(watchButton(input({ started: true }))).toEqual({ label: "▶ Resume", action: "play" });
  });

  it("reads Watch again when the recorded run has finished, and starts it from the beginning", () => {
    expect(watchButton(input({ atEnd: true, started: true }))).toEqual({ label: "▶ Watch again", action: "restart" });
  });

  it("reads Watch your run again after a live run, and replays that run", () => {
    expect(watchButton(input({ shows: "live", atEnd: true, started: true }))).toEqual({ label: "▶ Watch your run again", action: "restart" });
    expect(watchButton(input({ shows: "live" }))).toEqual({ label: "▶ Watch your run again", action: "play" });
  });

  it("never asks for a new run: every action replays what is already saved", () => {
    const combos = [true, false].flatMap((playing) => [true, false].flatMap((atEnd) => [true, false].flatMap((started) =>
      (["recorded", "live"] as const).map((shows) => watchButton({ shows, playing, atEnd, started })))));
    expect(new Set(combos.map((b) => b.action))).toEqual(new Set(["play", "pause", "restart"]));
  });
});
