// Try-your-own: runs entirely in the browser from the finished run's winning model and the feature catalogue.
// The form asks only for base measurements; derived values (wickets in hand and so on) are worked out with the
// shared recipes, and competition is a choice that sets the dummies.
import { deriveAll, type Values } from "./recipes";

export interface Model {
  features: string[];
  coefficients: Record<string, number>;
  intercept: number;
}

export interface CatalogueFeature {
  id: string;
  label: string;
  unit: string;
  bounds: { min: number; max?: number };
  source: Record<string, unknown>;
  inputs: string[];
}

export interface CompetitionChoice {
  column: string;
  reference: string;
  options: { value: string; label: string }[];
}

export interface Catalogue {
  limit: number;
  features: CatalogueFeature[];
  competition: CompetitionChoice;
}

export type Field =
  | { kind: "number"; id: string; label: string; min: number; max?: number }
  | { kind: "choice"; id: string; label: string; options: { value: string; label: string }[] };

const capitalise = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** The base measurements a model needs. Runs at 10 overs always comes first: the TV projection needs it too. */
export function fieldsFor(features: string[], catalogue: Catalogue): Field[] {
  const byId = new Map(catalogue.features.map((f) => [f.id, f]));
  const needed = ["runs_at_10"];
  for (const id of features) for (const base of byId.get(id)?.inputs ?? [id]) if (!needed.includes(base)) needed.push(base);
  return needed.map((id): Field => {
    if (id === catalogue.competition.column) {
      return { kind: "choice", id, label: "Competition", options: catalogue.competition.options };
    }
    const f = byId.get(id)!;
    return { kind: "number", id, label: capitalise(f.label), min: f.bounds.min, max: f.bounds.max };
  });
}

export type Entered = Record<string, number | string | undefined>;

export function validate(entered: Entered, fields: Field[]): string[] {
  const errors: string[] = [];
  for (const f of fields) {
    const v = entered[f.id];
    if (f.kind === "choice") {
      if (!f.options.some((o) => o.value === v)) errors.push(`${f.label}: choose one.`);
      continue;
    }
    if (v === undefined || typeof v !== "number" || Number.isNaN(v)) errors.push(`${f.label}: enter a number.`);
    else if (!Number.isInteger(v)) errors.push(`${f.label} must be a whole number.`);
    else if (v < f.min) errors.push(f.min === 0 ? `${f.label} cannot be negative.` : `${f.label} must be at least ${f.min}.`);
    else if (f.max !== undefined && v > f.max) errors.push(`${f.label} must be between ${f.min} and ${f.max}.`);
  }
  if (errors.length) return errors;
  const runs = entered.runs_at_10 as number;
  if (typeof entered.powerplay_runs === "number" && entered.powerplay_runs > runs) {
    errors.push("Powerplay runs cannot be more than the runs at 10 overs.");
  }
  if (typeof entered.runs_overs_7_10 === "number" && entered.runs_overs_7_10 > runs) {
    errors.push("Runs in overs 7 to 10 cannot be more than the runs at 10 overs.");
  }
  return errors;
}

/** Every feature value for the model: the measurements as entered, plus the derived ones from the recipes. */
export function featureValues(entered: Entered, catalogue: Catalogue): Values {
  const base = Object.fromEntries(Object.entries(entered).filter(([, v]) => v !== undefined)) as Values;
  return { ...base, ...deriveAll(catalogue.features, base) };
}

export function predict(m: Model, values: Values): number {
  let total = m.intercept;
  for (const f of m.features) total += (m.coefficients[f] ?? 0) * (values[f] as number);
  return total;
}

/** The broadcaster's projected score: current run rate x 20 overs. */
export function projection(runsAt10: number): number {
  return (runsAt10 / 10) * 20;
}
