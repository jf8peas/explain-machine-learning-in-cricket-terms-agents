import { beforeEach, describe, expect, it } from "vitest";
import { NOT_AVAILABLE, allTerms, cap, definition, hasTerms, meaning, setTerms, technical, term, termWithTechnical } from "../../src/page/terms";

const payload = {
  terms: [
    { id: "brute_force", plain: "brute-force search", technical: "grid search with forward selection", meaning: "Plain code.", order: 2, alt_plain: null },
    { id: "agent", plain: "AI agent", technical: "language-model agent", meaning: "A program.", order: 1, alt_plain: null },
  ],
  definitions: { brute_force: "The brute-force search is plain code, no AI." },
};

describe("the terms the server sends", () => {
  beforeEach(() => setTerms(null));

  it("says not available before the list arrives, never a made-up name", () => {
    expect(hasTerms()).toBe(false);
    expect(term("agent")).toBe(NOT_AVAILABLE);
    expect(termWithTechnical("brute_force")).toBe(NOT_AVAILABLE);
    expect(definition("brute_force")).toBe(NOT_AVAILABLE);
  });

  it("gives the plain term, the bracketed form, the technical term and the meaning", () => {
    setTerms(payload);
    expect(term("brute_force")).toBe("brute-force search");
    expect(termWithTechnical("brute_force")).toBe("brute-force search (grid search with forward selection)");
    expect(technical("agent")).toBe("language-model agent");
    expect(meaning("agent")).toBe("A program.");
    expect(definition("brute_force")).toContain("plain code");
  });

  it("lists the terms in the server's order and follows a changed list", () => {
    setTerms(payload);
    expect(allTerms().map((t) => t.id)).toEqual(["agent", "brute_force"]);
    setTerms({ terms: [{ ...payload.terms[1], plain: "robot" }] });
    expect(term("agent")).toBe("robot");
    expect(term("brute_force")).toBe(NOT_AVAILABLE);
  });

  it("capitalises the first letter only", () => {
    expect(cap("brute-force search")).toBe("Brute-force search");
  });
});
