// The figures on the Under the hood page that change when the data is refreshed. They come from two routes the app
// already serves (/api/data's summary and /api/reference), never from typed text. Pure: no DOM, so it is unit-tested.
// A missing or unreadable piece leaves its key out, and the page then shows a placeholder instead of a figure.

export const PLACEHOLDER = "not available right now";
export const GROUP_PLACEHOLDER = "These figures are not available right now.";

export interface Row { label?: string; value?: string }
export interface Section { title?: string; rows?: Row[] }
export interface DataResponse { summary?: { headline?: Row[]; sections?: Section[] } | null }
interface Method { average_miss?: number | null; bias?: number | null }
export interface ReferenceResponse {
  training?: { first_year?: number; last_year?: number; innings?: number } | null;
  figures?: { know_nothing?: Method | null; broadcaster?: Method | null } | null;
  goal?: { margin_runs?: number } | null;
}

export interface Competition { name: string; innings: string }
export interface Exclusion { label: string; count: string; explanation?: string }

export interface LiveFigures {
  totalInnings?: string;
  dateRange?: string;
  downloaded?: string;
  testPopulation?: string;
  excludedTotal?: string;
  refInnings?: string;
  refFirstYear?: string;
  refLastYear?: string;
  knowNothingMiss?: string;
  tvMiss?: string;
  tvBias?: string;
  tvBiasWords?: string;
  goalMargin?: string;
  competitions?: Competition[];
  exclusions?: Exclusion[];
}

/** The keys that fill a `[data-figure]` span with text (the two lists are built separately). */
export const TEXT_KEYS = [
  "totalInnings", "dateRange", "downloaded", "testPopulation", "excludedTotal", "refInnings", "refFirstYear",
  "refLastYear", "knowNothingMiss", "tvMiss", "tvBias", "tvBiasWords", "goalMargin",
] as const;
export type TextKey = (typeof TEXT_KEYS)[number];

/** Why each reason was left out, in the page's own words, keyed by the server's label (EXCLUSION_LABELS in data_table.py). */
export const EXPLANATIONS: Record<string, string> = {
  "Rain-affected (DLS)": "rain changed the overs or the target, so the total is not a normal 20-over score.",
  "No result": "the match was abandoned, so the innings may have been cut short.",
  "Innings ended before 10 overs": "all out or stopped early, so there is no 10-over score.",
  "Reduced overs": "scheduled for fewer than 20 overs, so run rate × 20 does not apply.",
  "Women's matches": "the app is built on men's matches only.",
  "Super overs": "a one-over tie-break, not a normal innings.",
  "No first innings": "there is no first innings to predict.",
};

const section = (data: DataResponse | null | undefined, title: string): Row[] | undefined =>
  data?.summary?.sections?.find((s) => s.title === title)?.rows;

const rowValue = (rows: Row[] | undefined, label: string): string | undefined => {
  const value = rows?.find((r) => r.label === label)?.value;
  return typeof value === "string" && value !== "" ? value : undefined;
};

const isNumber = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n);
const count = (n: number): string => n.toLocaleString("en-US");
const parseCount = (value: string): number => (/^\d{1,3}(,\d{3})*$|^\d+$/.test(value) ? Number(value.replace(/,/g, "")) : NaN);

export function buildFigures(data?: DataResponse | null, reference?: ReferenceResponse | null): LiveFigures {
  const out: LiveFigures = {};

  const headline = data?.summary?.headline;
  out.totalInnings = rowValue(headline, "Innings");
  out.dateRange = rowValue(headline, "Dates");
  out.downloaded = rowValue(headline, "Downloaded from Cricsheet");
  out.testPopulation = rowValue(section(data, "Test population"), "In the test population");

  const competitions = section(data, "Innings per competition");
  if (competitions) {
    out.competitions = competitions
      .filter((r) => typeof r.label === "string" && typeof r.value === "string")
      .map((r) => ({ name: r.label as string, innings: r.value as string }));
  }

  const excluded = section(data, "Excluded, and why");
  if (excluded) {
    const rows = excluded.filter((r) => typeof r.label === "string" && typeof r.value === "string");
    out.exclusions = rows.map((r) => {
      const explanation = EXPLANATIONS[r.label as string];
      return { label: r.label as string, count: r.value as string, ...(explanation ? { explanation } : {}) };
    });
    const counts = rows.map((r) => parseCount(r.value as string));
    if (counts.every((n) => !Number.isNaN(n))) out.excludedTotal = count(counts.reduce((a, b) => a + b, 0));
  }

  const training = reference?.training;
  if (training && isNumber(training.innings)) out.refInnings = count(training.innings);
  if (training && isNumber(training.first_year)) out.refFirstYear = String(training.first_year);
  if (training && isNumber(training.last_year)) out.refLastYear = String(training.last_year);

  const miss = (m?: Method | null): string | undefined => (m && isNumber(m.average_miss) ? m.average_miss.toFixed(1) : undefined);
  out.knowNothingMiss = miss(reference?.figures?.know_nothing);
  out.tvMiss = miss(reference?.figures?.broadcaster);

  const bias = reference?.figures?.broadcaster?.bias;
  if (isNumber(bias) && bias !== 0) {
    out.tvBias = Math.abs(bias).toFixed(1);
    out.tvBiasWords = bias < 0 ? "too low" : "too high";
  }

  const margin = reference?.goal?.margin_runs;
  if (isNumber(margin)) out.goalMargin = String(margin);

  // leave out what could not be worked out, so "has a value" is just "is present"
  for (const key of Object.keys(out) as (keyof LiveFigures)[]) if (out[key] === undefined) delete out[key];
  return out;
}
