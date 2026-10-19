import { describe, expect, it } from "vitest";
import { choiceHeading, choiceText, choiceView, type ChoiceView } from "../../src/page/found/view";

// scores are in tenths of a run, as the found view holds them
const view = (winner: "llm" | "forward", ai: number | null, rival: number | null): ChoiceView => choiceView({ winner }, ai, rival);
const text = (v: ChoiceView) => choiceText(v).map((s) => s.text).join("");

describe("choiceView", () => {
  it("is pending with no recorded decision", () => {
    expect(choiceView(undefined, 170, 174)).toMatchObject({ state: "pending", chosen: null, gap: null, tooClose: false });
  });

  it("calls the design's validation gap a whisker, with the rival chosen (rival 17.0, AI 17.4)", () => {
    expect(view("forward", 174, 170)).toMatchObject({ state: "whisker", chosen: "rival", chosenMiss: 170, otherMiss: 174, gap: 4, tooClose: true });
  });

  it("is a whisker at 0.4 and clear at 0.5 and 1.2, for either side chosen", () => {
    expect(view("llm", 170, 174).state).toBe("whisker");
    expect(view("llm", 170, 175).state).toBe("clear");
    expect(view("llm", 170, 182)).toMatchObject({ state: "clear", gap: 12, tooClose: false });
    expect(view("forward", 182, 170)).toMatchObject({ state: "clear", chosen: "rival", gap: 12 });
    expect(view("forward", 175, 170).state).toBe("clear");
    expect(view("forward", 174, 170).state).toBe("whisker");
  });

  it("sends a tie to the AI and calls it a whisker with a zero gap", () => {
    expect(view("llm", 170, 170)).toMatchObject({ state: "whisker", chosen: "ai", gap: 0 });
  });

  it("never overrides a recorded rival choice when the displayed scores are equal", () => {
    expect(view("forward", 170, 170)).toMatchObject({ state: "whisker", chosen: "rival", gap: 0 });
  });

  it("is noAi, with no gap and never too close, when the AI has no scorable candidate model", () => {
    expect(view("forward", null, 170)).toMatchObject({ state: "noAi", chosen: "rival", gap: null, tooClose: false });
    expect(view("llm", null, 170)).toMatchObject({ state: "noAi", tooClose: false });
  });
});

describe("the choice heading", () => {
  it("names the chosen candidate model and adds 'by a whisker' only when too close", () => {
    expect(choiceHeading(view("llm", 170, 182))).toBe("The AI agent's candidate model");
    expect(choiceHeading(view("forward", 174, 170))).toBe("The rival's candidate model, by a whisker");
    expect(choiceHeading(view("llm", 170, 170))).toBe("The AI agent's candidate model, by a whisker");
    expect(choiceHeading(view("forward", 182, 170))).toBe("The rival's candidate model");
    expect(choiceHeading(view("forward", null, 170))).toBe("The rival's candidate model");
    expect(choiceHeading(choiceView(undefined, null, null))).toBe("Still searching");
  });
});

describe("the choice text", () => {
  it("for a whisker says too close to call, that the lower score goes forward, and that the final test settles it", () => {
    const t = text(view("forward", 174, 170));
    expect(t).toContain("It missed by 17.0 runs on the check seasons, against 17.4 for the AI agent.");
    expect(t).toContain("A gap of 0.4 runs is too close to call: the two are about equally good.");
    expect(t).toContain("A choice still has to be made, so the lower score goes forward");
    expect(t).toContain("How good it really is gets settled by the final test, on a season nothing has seen.");
    expect(choiceText(view("forward", 174, 170)).some((s) => s.kind === "tooclose")).toBe(true);
  });

  it("for a clear choice says how many runs better and never says too close to call", () => {
    for (const [v, runs] of [[view("llm", 170, 182), "1.2"], [view("forward", 195, 170), "2.5"], [view("llm", 170, 175), "0.5"]] as const) {
      const t = text(v);
      expect(t).toContain(`${runs} runs better.`);
      expect(t).not.toMatch(/too close to call/i);
      expect(t).not.toContain("A choice still has to be made");
      expect(choiceText(v).some((s) => s.kind === "tooclose")).toBe(false);
    }
  });

  it("for a tie mentions the tie rule, and for no AI says the rival goes forward with no comparison", () => {
    expect(text(view("llm", 170, 170))).toContain("equal scores go to the AI agent's candidate model");
    const none = text(view("forward", null, 170));
    expect(none).toContain("The AI agent made no candidate model that could be scored, so the rival's goes forward.");
    expect(none).not.toMatch(/too close to call|against/i);
  });

  it("does not claim the tie rule when the rival was the recorded choice on equal scores", () => {
    const t = text(view("forward", 170, 170));
    expect(t).not.toContain("equal scores go to the AI agent");
    expect(t).toContain("too close to call");
    expect(choiceHeading(view("forward", 170, 170))).toBe("The rival's candidate model, by a whisker");
  });

  it("never uses the word winner or the word setup, in any state", () => {
    for (const v of [view("llm", 170, 174), view("forward", 182, 170), view("llm", 170, 170), view("forward", null, 170), choiceView(undefined, null, null)]) {
      expect(`${choiceHeading(v)} ${text(v)}`).not.toMatch(/winner|setup/i);
    }
  });
});
