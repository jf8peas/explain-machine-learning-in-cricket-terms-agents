import { describe, expect, it } from "vitest";
import { leader, type Attempt } from "../../src/page/leaderboard";
import { summaryModel } from "../../src/page/summary";

const at = (mae: number, proposer: Attempt["proposer"], features = ["runs_at_10"]): Attempt =>
  ({ features, proposer, validation_mae: mae, validation_r2: 0.5, improved: true, round: 1 });

describe("the summary line", () => {
  it("says results will appear before any run", () => {
    expect(summaryModel({})).toEqual({ kind: "empty" });
    expect(summaryModel({ attempts: [] })).toEqual({ kind: "empty" });
  });

  it("names the leading attempt's average miss and who proposed it", () => {
    const m = summaryModel({ attempts: [at(20.46, "llm"), at(19.04, "forward_selection", ["a", "b"])] });
    expect(m).toEqual({ kind: "leader", miss: "19.0", proposer: "Forward selection", features: 2 });
  });

  it("names the same leader the leaderboard names, whatever the set of attempts", () => {
    const sets: Attempt[][] = [
      [at(18, "llm")],
      [at(18, "llm"), at(17, "forward_selection"), at(19, "llm")],
      [at(18, "llm"), at(18, "forward_selection")],                    // a tie goes to the earliest
      [at(25, "forward_selection"), at(24.99, "llm"), at(25, "llm")],
    ];
    for (const attempts of sets) {
      const m = summaryModel({ attempts });
      const best = leader(attempts)!;
      expect(m.kind).toBe("leader");
      if (m.kind === "leader") {
        expect(m.miss).toBe(best.validation_mae.toFixed(1));
        expect(m.proposer).toBe(best.proposer === "llm" ? "Language model" : "Forward selection");
      }
      expect(Math.min(...attempts.map((a) => a.validation_mae))).toBe(best.validation_mae);
    }
  });

  it("breaks a tie in favour of the earliest attempt", () => {
    const first = at(18, "llm"), second = at(18, "forward_selection");
    expect(leader([first, second])).toBe(first);
  });

  it("shows the data error instead of the line", () => {
    expect(summaryModel({ data_error: "The data could not be loaded.", attempts: [at(18, "llm")] }))
      .toEqual({ kind: "error", message: "The data could not be loaded." });
  });
});
