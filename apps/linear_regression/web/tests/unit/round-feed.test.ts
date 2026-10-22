import { describe, expect, it } from "vitest";
import { feedRows, ideaWords, llmNotice, nextAnnouncement, plainWords, spokenLine, type FeedRow } from "../../src/page/round-feed";
import type { RoundView } from "../../src/page/found/view";

const label = (id: string) => ({ runs_at_10: "runs at 10 overs", wickets_in_hand: "wickets in hand", sixes_at_10: "sixes" }[id] ?? id);
const menu = (m: string, id: string) => `${m}:${id}`;

const view = (over: Partial<RoundView> = {}): RoundView => ({
  round: 1, kind: "fitted", features: ["runs_at_10"], window: "last_3", weighting: "even", training_innings: "all", reason: "Start simple.",
  message: "", change: "first", added: [], miss: 215, improved: true, drop: null, firstScore: true, isBest: false, ...over,
});

describe("the idea in plain words", () => {
  it("starts with the full list, then adds one clue, keeps the same, or tries a new set", () => {
    expect(ideaWords(view({ features: ["runs_at_10", "wickets_in_hand"] }), label)).toBe("Starts with runs at 10 overs, wickets in hand");
    expect(ideaWords(view({ change: "added", added: ["sixes"], features: ["runs_at_10", "sixes"] }), label)).toBe("Adds sixes");
    expect(ideaWords(view({ change: "same" }), label)).toBe("Keeps the same clues");
    expect(ideaWords(view({ change: "changed", features: ["sixes"] }), label)).toBe("Tries sixes");
    expect(ideaWords(view({ features: [] }), label)).toBe("No clues proposed");
    expect(ideaWords(view({ features: [], kind: "finished" }), label)).toBe("No new idea");
  });
});

describe("a round's status", () => {
  const rows = (v: RoundView) => feedRows([v], label, menu)[0];

  it("is first score, new best or no better for a fitted round, with its score to one decimal", () => {
    expect(rows(view())).toMatchObject({ status: "first_score", statusText: "first score", score: "21.5" });
    expect(rows(view({ firstScore: false, improved: true, miss: 190 }))).toMatchObject({ status: "new_best", score: "19.0" });
    expect(rows(view({ firstScore: false, improved: false, miss: 230 }))).toMatchObject({ status: "no_better", statusText: "no better" });
  });

  it("is code rejected with the reason when code refused the idea, and has no score", () => {
    const r = rows(view({ kind: "rejected", message: "that set was already tried", miss: null, improved: false, firstScore: false }));
    expect(r).toMatchObject({ status: "rejected", statusText: "code rejected: that set was already tried", score: null });
  });

  it("is agent finished when the agent says it is done, being scored while code is still scoring, and stopped on failure", () => {
    expect(rows(view({ kind: "finished", miss: null, features: [] })).statusText).toBe("agent finished");
    expect(rows(view({ kind: "pending", miss: null }))).toMatchObject({ status: "scoring", statusText: "being scored" });
    expect(rows(view({ kind: "failed", message: "no reply", miss: null })).statusText).toBe("stopped: no reply");
  });

  it("keeps the agent's reasoning exactly as written and words each setting choice", () => {
    const r = rows(view({ reason: "  Wickets matter <b>a lot</b>. " }));
    expect(r.reason).toBe("  Wickets matter <b>a lot</b>. ");
    expect(r.seasons).toBe("window:last_3");
    expect(r.settings).toEqual(["weighting:even", "training_innings:all"]);
    expect(rows(view({ window: undefined, weighting: null, training_innings: undefined })).settings).toEqual([]);
  });

  it("lists a later round's settings only when they changed from the round before", () => {
    const list = feedRows([view(), view({ round: 2, change: "added", firstScore: false }), view({ round: 3, weighting: "recent", firstScore: false })], label, menu);
    expect(list[0].settings).toEqual(["weighting:even", "training_innings:all"]);
    expect(list[1].settings).toEqual([]);
    expect(list[2].settings).toEqual(["weighting:recent"]);
  });
});

describe("what is spoken", () => {
  const row = (round: number, over: Partial<FeedRow> = {}): FeedRow => ({
    round, idea: "x", seasons: null, reason: "", score: "18.2", status: "new_best", statusText: "new best", settings: [], ...over });
  const start = { cursor: -1, spoken: new Set<number>() };

  it("says one short line when a round gets its final status as the replay moves forward one step", () => {
    const out = nextAnnouncement({ cursor: 3, spoken: new Set() }, { cursor: 4, rows: [row(1)] });
    expect(out.line).toBe("Round 1: new best, 18.2 runs off.");
    expect(out.line!.length).toBeLessThan(60);
  });

  it("says nothing for a round still being scored, then speaks it once it is scored", () => {
    const scoring = row(1, { status: "scoring", statusText: "being scored", score: null });
    const a = nextAnnouncement({ cursor: 0, spoken: new Set() }, { cursor: 1, rows: [scoring] });
    expect(a.line).toBeNull();
    const b = nextAnnouncement(a.state, { cursor: 2, rows: [row(1)] });
    expect(b.line).toBe("Round 1: new best, 18.2 runs off.");
  });

  it("says each round once, however often the feed is redrawn", () => {
    let s = nextAnnouncement({ cursor: 3, spoken: new Set() }, { cursor: 4, rows: [row(1)] }).state;
    const again = nextAnnouncement(s, { cursor: 5, rows: [row(1)] });
    expect(again.line).toBeNull();
  });

  it("says nothing going back or jumping, and does not read those rounds out later", () => {
    const back = nextAnnouncement({ cursor: 8, spoken: new Set([1, 2]) }, { cursor: 7, rows: [row(1), row(2)] });
    expect(back.line).toBeNull();
    const jump = nextAnnouncement(start, { cursor: 9, rows: [row(1), row(2), row(3)] });
    expect(jump.line).toBeNull();
    expect([...jump.state.spoken]).toEqual([1, 2, 3]);
    expect(nextAnnouncement(jump.state, { cursor: 10, rows: [row(1), row(2), row(3)] }).line).toBeNull();
  });

  it("speaks a rejection and the end of the agent's search in the same short form", () => {
    expect(spokenLine(row(2, { status: "rejected", statusText: "code rejected: that set of clues was already tried in an earlier round", score: null }))).toBe("Round 2: code rejected.");
    expect(spokenLine(row(4, { status: "finished", statusText: "agent finished", score: null }))).toBe("Round 4: agent finished.");
  });
});

describe("when the language model did not do its work", () => {
  it("says nothing while it is fine", () => {
    expect(llmNotice("ok", null, 3)).toBeNull();
    expect(llmNotice(undefined, undefined, 0)).toBeNull();
  });

  it("says it did not take part, with the server's reason, when it made no rounds", () => {
    expect(llmNotice("failed", "The provider is down.", 0)).toBe(
      "The AI agent did not take part in this run: The provider is down. The brute-force search carried on alone.");
    expect(llmNotice("not_used", null, 0)).toContain("did not take part in this run.");
  });

  it("says it stopped early, keeping its best idea, when it made some rounds first", () => {
    expect(llmNotice("failed", "It timed out.", 2)).toBe(
      "The AI agent stopped early: It timed out. Its best idea so far was kept, and the brute-force search carried on.");
  });
});

describe("the Scoreboard's plain words", () => {
  it("say idea for candidate model, clues for features and check seasons for validation, and leave the rest alone", () => {
    expect(plainWords("That candidate model was already tried: the same features, window, weighting and training innings."))
      .toBe("That idea was already tried: the same clues, window, weighting and training innings.");
    expect(plainWords("Candidate models need at least one feature.")).toBe("Ideas need at least one clue.");
    expect(plainWords("Too little validation data.")).toBe("Too little check seasons data.");
    expect(plainWords("Nothing technical here.")).toBe("Nothing technical here.");
  });

  it("are used in a rejected round's status, and the reason is otherwise as the server sent it", () => {
    const r = feedRows([view({ kind: "rejected", message: "That candidate model was already tried.", miss: null, firstScore: false })], label, menu)[0];
    expect(r.statusText).toBe("code rejected: That idea was already tried.");
  });
});

describe("the feed's short reason", () => {
  it("keeps the point of a repeat and leaves other reasons whole", async () => {
    const { shortReason } = await import("../../src/page/round-feed");
    expect(shortReason("That idea was already tried: the same clues, window, weighting and training innings.")).toBe("That idea was already tried.");
    expect(shortReason("Nine is too many.")).toBe("Nine is too many.");
  });
});
