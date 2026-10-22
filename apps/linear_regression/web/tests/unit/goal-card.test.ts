import { describe, expect, it } from "vitest";
import type { GoalCard } from "../../src/page/goal-card";

// The card and the strip are drawn from the server's words in a browser; the logic worth a unit test is what is shown when. The
// drawing itself is checked end to end (tests/e2e/idle.spec.ts, hero.spec.ts, locks.spec.ts).
import { resultStrip, initialRunState } from "../../src/page/run-state";

const full: GoalCard = {
  kicker: "THE GOAL", sentence: "Beat the TV's projection by at least 3 runs on average.",
  tv: { miss: 22.5, label: "runs: how far out the TV usually is, on past innings (2005–2022)" },
  target: { runs: "3+", label: "runs closer: what the agent must do" }, judged: "Judged on 171 innings from 2026, a season the agent never sees while it works.",
};

describe("the goal card's words", () => {
  it("are the server's, whole", () => {
    expect(full.tv?.label).toContain("2005–2022");
    expect(full.target?.runs).toBe("3+");
  });

  it("there is no result strip before a run has a final test", () => {
    expect(resultStrip(initialRunState())).toBeNull();
  });
});
