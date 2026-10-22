import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { cardView, type Headlines } from "../../src/page/scoreboard";

interface Case { name: string; inputs: { tv_miss: number }; expected: Headlines }
const CASES: Case[] = JSON.parse(readFileSync("tests/fixtures/headline_cases.json", "utf8"));

describe("the Scoreboard card shows what the server sent", () => {
  for (const c of CASES) {
    it(c.name, () => {
      const card = cardView(c.expected, 2025, 171)!;
      expect(card.kicker).toBe("SCOREBOARD · 2025 SEASON, 171 UNSEEN INNINGS");
      expect(card.subject.label).toBe(c.expected.scoreboard.subject_label);
      expect(card.subject.miss).toBe(c.expected.scoreboard.subject_miss!.toFixed(1));
      expect(card.tv).toEqual({ label: "TV projection", miss: c.inputs.tv_miss.toFixed(1) });
      expect(card.facts).toEqual(c.expected.scoreboard.facts);              // words unchanged, in the server's order
    });
  }

  it("is the agent's own figure even when the search is the pick: the hero never swaps it", () => {
    const searchAhead = CASES.find((c) => c.name.startsWith("the search is clearly ahead"))!;
    expect(cardView(searchAhead.expected, 2025, 171)!.subject).toEqual({ label: "AI agent", miss: "19.0" });
  });

  it("with no language model labels the card Brute-force search and drops the tries and the claim about the AI", () => {
    const none = CASES.find((c) => c.expected.case === "no_llm")!;
    const card = cardView(none.expected, 2025, 171)!;
    expect(card.subject.label).toBe("Brute-force search");
    expect(card.facts.map((f) => f.id)).toEqual(["gap"]);
    expect(JSON.stringify(card)).not.toMatch(/tries|made up by the AI/);
  });

  it("leaves out what is not known yet", () => {
    expect(cardView(undefined, 2025, 171)).toBeNull();
    const any = CASES[0].expected;
    expect(cardView(any, undefined, undefined)!.kicker).toBe("SCOREBOARD · UNSEEN INNINGS");
    expect(cardView(any, 2025, undefined)!.kicker).toBe("SCOREBOARD · 2025 SEASON, UNSEEN INNINGS");
  });
});

describe("the page never writes a headline of its own", () => {
  it("passes the server's h1 and lead through (they are fields of the headline set)", () => {
    for (const c of CASES) {
      expect(c.expected.hero_h1.length).toBeGreaterThan(10);
      expect(c.expected.lead).toMatch(/^Halfway through a T20 innings, where will it finish\?/);
    }
  });
});
