import { describe, expect, it } from "vitest";
import { bothTiny, compareSentence, gap, lead, leadSentence, reasonTwo, scaleMax } from "../../src/page/final/copy";
import { countCandidateModels, examView, type ExamView } from "../../src/page/final/view";
import { designFigs, examState, type Fig } from "./final-fixtures";

const v = (opts: Parameters<typeof examState>[0] = {}): ExamView => examView(examState(opts))!;
const text = (x: ExamView) => compareSentence(x).map((s) => s.text).join("");
const figs = (llm: number, forward: number, tv = 21.4, know = 34.5): Record<string, Fig> => ({
  ...designFigs, llm: { ...designFigs.llm, average_miss: llm }, forward: { ...designFigs.forward, average_miss: forward },
  broadcaster: { ...designFigs.broadcaster, average_miss: tv }, know_nothing: { ...designFigs.know_nothing, average_miss: know },
});

describe("examView", () => {
  it("reads both exams' scores in tenths, the years, the innings and the number of candidate models", () => {
    const x = v();
    expect(x.validation).toEqual({ rival: 170, ai: 174 });
    expect(x.test).toEqual({ rival: 178, ai: 177 });
    expect(x).toMatchObject({ aiTook: true, chosen: "rival", innings: 214, candidateModels: 29, tv: 214, knowNothing: 345 });
    expect(x.years).toEqual({ checks: [2023, 2024, 2025], first: 2023, last: 2025, test: 2026 });
  });

  it("is undefined before the final test is on display", () => {
    expect(examView({ split: { first_year: 2005, checks: [{ year: 2023 }], test_year: 2026 } })).toBeUndefined();
  });

  it("counts the AI's fitted attempts plus the grid's allowed cells, and nothing else", () => {
    expect(countCandidateModels(examState({ aiAttempts: 5, allowedCells: 24, notAllowedCells: 3 }).attempts as never, examState().grid as never)).toBe(29);
    expect(v({ aiAttempts: 0, allowedCells: 24 }).candidateModels).toBe(24);
    expect(v({ aiAttempts: 7, allowedCells: 20, notAllowedCells: 9 }).candidateModels).toBe(27);
    expect(countCandidateModels(undefined, undefined)).toBe(0);
    // the rival's own attempt is the grid's best cell and is not counted twice
    expect(countCandidateModels([{ proposer: "forward_selection" } as never, { proposer: "llm" } as never], { cells: [{ allowed: true }] })).toBe(2);
  });

  it("has no AI scores without the AI's model", () => {
    const { llm: _llm, ...without } = designFigs;
    const x = v({ figs: without });
    expect(x.aiTook).toBe(false);
    expect(x.validation).toEqual({ rival: 170, ai: null });
    expect(x.test).toEqual({ rival: 178, ai: null });
  });
});

describe("lead and gap on one exam", () => {
  it("names the lower displayed score and flags a gap under the threshold, at 0.4, 0.5 and 1.2", () => {
    expect(lead({ rival: 170, ai: 174 })).toEqual({ who: "rival", close: true });
    expect(lead({ rival: 170, ai: 175 })).toEqual({ who: "rival", close: false });     // exactly 0.5
    expect(lead({ rival: 182, ai: 170 })).toEqual({ who: "ai", close: false });        // 1.2
    expect(lead({ rival: 170, ai: 170 })).toEqual({ who: "level", close: true });
    expect(lead({ rival: 170, ai: null })).toBeUndefined();
    expect(gap({ rival: 170, ai: 182 })).toBe(12);
  });
});

describe("leadSentence and bothTiny", () => {
  it("for the design's run says the rival was ahead on the check seasons and the AI edged it on the test, and both gaps are tiny", () => {
    const x = v();
    expect(leadSentence(x)).toBe("On the check seasons the brute-force search was ahead; on 2026 the AI agent edged it.");
    expect(bothTiny(x)).toBe("Both gaps are tiny.");
  });

  it("when the AI is ahead on both exams by a clear margin, says so once and does not say both gaps are tiny", () => {
    const x = v({ figs: figs(15.0, 17.0), validation: { llm: 15.0, forward: 17.0 } });
    expect(leadSentence(x)).toBe("On the check seasons and again on 2026 the AI agent was ahead.");
    expect(bothTiny(x)).toBe("");
  });

  it("when the rival is ahead on both exams, says so", () => {
    const x = v({ figs: figs(18.7, 17.9), validation: { llm: 18.5, forward: 17.0 } });
    expect(leadSentence(x)).toBe("On the check seasons and again on 2026 the brute-force search was ahead.");
  });

  it("when the exams disagree by clear margins says each leader, and does not say tiny", () => {
    const x = v({ figs: figs(16.5, 17.7), validation: { llm: 18.2, forward: 17.0 } });
    expect(leadSentence(x)).toBe("On the check seasons the brute-force search was ahead; on 2026 the AI agent came out ahead.");
    expect(bothTiny(x)).toBe("");
  });

  it("says both gaps are tiny only when both are under the threshold; one tiny is not enough", () => {
    expect(bothTiny(v({ figs: figs(17.7, 17.8), validation: { llm: 17.4, forward: 17.0 } }))).toBe("Both gaps are tiny.");
    expect(bothTiny(v({ figs: figs(17.7, 18.9), validation: { llm: 17.4, forward: 17.0 } }))).toBe("");     // test gap 1.2
    expect(bothTiny(v({ figs: figs(17.7, 17.8), validation: { llm: 18.2, forward: 17.0 } }))).toBe("");     // validation gap 1.2
    expect(bothTiny(v({ figs: figs(17.7, 18.2), validation: { llm: 17.5, forward: 17.0 } }))).toBe("");     // both exactly 0.5
  });

  it("copes with a level exam", () => {
    expect(leadSentence(v({ figs: figs(17.8, 17.8), validation: { llm: 17.0, forward: 17.0 } }))).toBe("On the check seasons and on 2026 the two were level.");
    expect(leadSentence(v({ figs: figs(17.0, 17.8), validation: { llm: 17.0, forward: 17.0 } }))).toBe("On the check seasons the two were level; on 2026 the AI agent came out ahead.");
  });

  it("is empty, and nothing is too close, without the AI's model", () => {
    const { llm: _l, ...without } = designFigs;
    const x = v({ figs: without });
    expect(leadSentence(x)).toBe("");
    expect(bothTiny(x)).toBe("");
    expect(compareSentence(x)).toEqual([]);
  });
});

describe("compareSentence under the bars", () => {
  it("for the design's run says too close to call and that both beat both references", () => {
    const x = v();
    const t = text(x);
    expect(t).toContain("too close to call (17.7 and 17.8 runs).");
    expect(t).toContain("Both beat the broadcaster's projection and the average-total guess.");
    expect(compareSentence(x).some((s) => s.kind === "tooclose")).toBe(true);
  });

  it("at exactly 0.5 and at 1.2 says which was more accurate and by how much, never too close to call", () => {
    for (const [llm, forward, who, by] of [[17.7, 18.2, "AI agent's", "0.5"], [17.7, 18.9, "AI agent's", "1.2"], [19.1, 17.9, "brute-force search's", "1.2"]] as const) {
      const x = v({ figs: figs(llm, forward) });
      const t = text(x);
      expect(t).toContain(`the ${who} idea was more accurate, by ${by} runs.`);
      expect(t).not.toMatch(/too close to call/i);
      expect(compareSentence(x).some((s) => s.kind === "tooclose")).toBe(false);
    }
  });

  it("says too close to call at 0.4 for either side ahead", () => {
    expect(text(v({ figs: figs(17.8, 17.4) }))).toContain("too close to call (17.8 and 17.4 runs).");
    expect(text(v({ figs: figs(17.4, 17.8) }))).toContain("too close to call (17.4 and 17.8 runs).");
  });

  it("says who beat the references when they differ", () => {
    const only = text(v({ figs: figs(17.7, 22.0) }));      // the rival (22.0) does not beat the broadcaster (21.4)
    expect(only).toContain("Only the AI agent's idea beat the broadcaster's projection.");
    expect(only).toContain("Both beat the average-total guess.");
    const neither = text(v({ figs: figs(25.0, 24.0, 21.4, 22.0) }));
    expect(neither).toContain("Neither beat the broadcaster's projection and the average-total guess.");
  });

  it("does not count a tie with a reference as beating it", () => {
    expect(text(v({ figs: figs(21.4, 21.4) }))).toContain("Neither beat the broadcaster's projection.");
  });
});

describe("the reasons and the shared scale", () => {
  it("shows the run's own count of candidate models, never a typed word like dozens", () => {
    expect(reasonTwo(v())).toBe("29 ideas were tried on the check seasons and the best one kept. Some of that best score is luck, so it usually slips on fresh data.");
    expect(reasonTwo(v({ aiAttempts: 0, allowedCells: 1 }))).toBe("1 idea was tried on the check seasons. Some of its score is luck, so it usually slips on fresh data.");
    expect(reasonTwo(v({ aiAttempts: 7, allowedCells: 24 }))).toMatch(/^31 ideas/);
    for (const n of [1, 5, 29, 31, 40]) expect(reasonTwo(v({ aiAttempts: n, allowedCells: 0 }))).not.toMatch(/dozens/i);
  });

  it("puts both exams on one scale from zero: the largest score rounded up to the next whole 5 runs", () => {
    expect(scaleMax(v())).toBe(20);
    expect(scaleMax(v({ figs: figs(20.1, 21.0) }))).toBe(25);
    expect(scaleMax(v({ validation: { llm: 24.5, forward: 20.0 } }))).toBe(25);
    expect(scaleMax(v({ validation: { llm: 25.0, forward: 20.0 } }))).toBe(25);
  });
});

describe("vocabulary", () => {
  it("never says winner or setup, in any sentence, for three differing figure sets", () => {
    const { llm: _l, ...without } = designFigs;
    for (const x of [v(), v({ figs: figs(15.0, 17.0), validation: { llm: 15.0, forward: 17.0 } }), v({ figs: figs(16.5, 17.7), validation: { llm: 18.2, forward: 17.0 } }), v({ figs: without })]) {
      const all = [leadSentence(x), bothTiny(x), text(x), reasonTwo(x)].join(" ");
      expect(all).not.toMatch(/winner|setup/i);
    }
  });
});
