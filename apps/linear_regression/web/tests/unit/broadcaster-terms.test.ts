// The broadcaster's names (feature 023): the long form, the short form and its possessive come from the server's list; the
// h1 is built from the list's words, with a neutral fallback before the list arrives.
import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it } from "vitest";
import { question } from "../../src/page/hero";
import { bareShortTerm, cap, setTerms, shortPossessive, shortTerm, term, type TermsPayload } from "../../src/page/terms";

const payload: TermsPayload = JSON.parse(readFileSync("tests/fixtures/terms.json", "utf8"));

describe("the broadcaster's names", () => {
  beforeEach(() => setTerms(payload));

  it("gives the long form, the short form and the short possessive from the list", () => {
    expect(term("tv")).toBe("broadcaster's projection");
    expect(shortTerm("tv")).toBe("the broadcaster");
    expect(shortPossessive("tv")).toBe("the broadcaster's");
    expect(cap(bareShortTerm("tv"))).toBe("Broadcaster");
  });

  it("falls back to the plain term for a concept with no short form", () => {
    expect(shortTerm("agent")).toBe("AI agent");
    expect(shortPossessive("agent")).toBe("AI agent");
  });

  it("asks the question with the agent's name and the server's projected-score phrase", () => {
    expect(question()).toBe("Can an AI agent build a regression model that beats the broadcaster's projected score?");
  });
});

describe("before the list arrives", () => {
  it("still asks a neutral question, never a placeholder", () => {
    setTerms(null);
    expect(question()).toBe("Can an agent build a regression model that beats the projected score?");
  });
});
