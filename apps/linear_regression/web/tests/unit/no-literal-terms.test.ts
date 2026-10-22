// The page never types a method name (feature 021, FR-003): the words for the methods come from the server's list through terms.ts.
// This reads every source file of the page, takes out the comments, and fails if a string or template literal still holds a
// method name, or a name the page must not use. CSS class names, test ids and state keys are identifiers; the banned words are
// matched whole, so "rival" in a key such as `rival:` outside a string is not a literal and is not looked at.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = "src/page";

const NAMES = [
  /\bAI agent\b/i, /brute[- ]force search/i, /TV projection/i, /broadcaster'?s? projection/i, /TV/, /average[- ]total guess/i, /\bour pick\b/i,
  /\brivals?\b/i, /know[- ]nothing/i, /forward selection/i, /mechanical search/i, /\bsetups?\b/i, /candidate models?/i,
];

// Strings that are not words shown to the visitor: CSS class lists and attribute values are identifiers, matched by what they sit in.
const ALLOWED_CONTEXT = [/data-testid/, /class:/, /className/, /querySelector/, /"data-/];

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? files(path) : path.endsWith(".ts") ? [path] : [];
  });
}

function withoutComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`\\])\/\/.*$/gm, "$1");
}

function literals(source: string): { line: number; text: string }[] {
  const out: { line: number; text: string }[] = [];
  const pattern = /"((?:[^"\\\n]|\\.)*)"|'((?:[^'\\\n]|\\.)*)'|`((?:[^`\\]|\\.)*)`/g;
  for (const m of source.matchAll(pattern)) {
    const text = m[1] ?? m[2] ?? m[3] ?? "";
    const line = source.slice(0, m.index).split("\n").length;
    out.push({ line, text });
  }
  return out;
}

describe("no method name is typed in the page", () => {
  const sources = files(ROOT).filter((f) => !f.endsWith("terms.ts"));

  it("reads the whole page's source", () => {
    expect(sources.length).toBeGreaterThan(30);
  });

  it("has no glossary method name or banned name inside a string or template literal", () => {
    const hits: string[] = [];
    for (const file of sources) {
      const source = withoutComments(readFileSync(file, "utf8"));
      const lines = source.split("\n");
      for (const { line, text } of literals(source)) {
        if (ALLOWED_CONTEXT.some((c) => c.test(lines[line - 1] ?? ""))) continue;
        if (!/\s/.test(text)) continue;           // a single token is an identifier (a key, an id, a path), not a sentence
        const words = text.replace(/\$\{[^}]*\}/g, "");           // code inside ${...} is not a word the visitor reads
        const bad = NAMES.find((re) => re.test(words));
        if (bad) hits.push(`${file}:${line} ${bad} in "${text.slice(0, 70)}"`);
      }
    }
    expect(hits).toEqual([]);
  });
});
