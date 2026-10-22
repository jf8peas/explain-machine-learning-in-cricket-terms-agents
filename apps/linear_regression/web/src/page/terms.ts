// The words for the methods and ideas (feature 021, app-specific). The server owns them (backend/linreg/methods.py) and sends
// them with /api/reference; the page never types a method name, it asks here. Before the list arrives, or if it never does,
// every call gives the page's usual "not available right now" text rather than a made-up name.
export type TermId =
  | "agent" | "brute_force" | "tv" | "average_total" | "idea" | "clues" | "settings" | "check_seasons" | "test_season" | "pick";
export type DefinitionKey = "brute_force" | "brute_force_technical" | "brute_force_honest";

export interface Term { id: string; plain: string; technical: string; meaning: string; order: number; alt_plain: string | null }
export interface BannedPattern { pattern: string; allowed_in: string[] }
export interface TermsPayload {
  terms?: Term[];
  definitions?: Partial<Record<DefinitionKey, string>>;
  banned?: BannedPattern[];
  terms_version?: string;
}

export const NOT_AVAILABLE = "not available right now";

let byId = new Map<string, Term>();
let defs: Partial<Record<DefinitionKey, string>> = {};

/** Take the list the server sent. Anything missing leaves the matching words unavailable. */
export function setTerms(payload: TermsPayload | null | undefined): void {
  byId = new Map((payload?.terms ?? []).map((t) => [t.id, t]));
  defs = payload?.definitions ?? {};
}

export const hasTerms = (): boolean => byId.size > 0;

/** The plain term, used at every level. */
export function term(id: TermId): string {
  return byId.get(id)?.plain ?? NOT_AVAILABLE;
}

/** The plain term with its technical term in brackets: use it once, at the first mention in a Commentary or Scorebook panel. */
export function termWithTechnical(id: TermId): string {
  const t = byId.get(id);
  return t ? `${t.plain} (${t.technical})` : NOT_AVAILABLE;
}

/** The second accepted plain form where there is one ("final test" for the test season), otherwise the plain term. */
export function altTerm(id: TermId): string {
  const t = byId.get(id);
  return t ? t.alt_plain ?? t.plain : NOT_AVAILABLE;
}

export function technical(id: TermId): string {
  return byId.get(id)?.technical ?? NOT_AVAILABLE;
}

export function meaning(id: TermId): string {
  return byId.get(id)?.meaning ?? NOT_AVAILABLE;
}

/** The terms in the server's order, for the "Words we use" list. */
export function allTerms(): Term[] {
  return [...byId.values()].sort((a, b) => a.order - b.order);
}

export function definition(key: DefinitionKey): string {
  return defs[key] ?? NOT_AVAILABLE;
}

/** The first letter upper-cased ("brute-force search" -> "Brute-force search"). */
export const cap = (text: string): string => text.charAt(0).toUpperCase() + text.slice(1);

/** The glossary term for each method id (the ids are identifiers; the words come from the server's list). */
const METHOD_TERM: Record<string, TermId> = { llm: "agent", forward: "brute_force", broadcaster: "tv", know_nothing: "average_total" };

/** A method as the page names it on its own: "AI agent", "brute-force search", "TV projection", "average-total guess". */
export function methodName(id: string): string {
  const t = METHOD_TERM[id];
  return t ? term(t) : NOT_AVAILABLE;
}

/** The method's model or guess: "AI agent's model", "brute-force search's model", or the name itself for the two references. */
export function methodModel(id: string): string {
  return id === "llm" || id === "forward" ? `${methodName(id)}'s model` : methodName(id);
}

/** A tracker for one panel: the first mention of a concept carries its technical term in brackets, later ones do not. */
export type Introducer = (id: TermId) => string;
export function introducer(): Introducer {
  const seen = new Set<TermId>();
  return (id) => {
    if (seen.has(id)) return term(id);
    seen.add(id);
    return termWithTechnical(id);
  };
}
