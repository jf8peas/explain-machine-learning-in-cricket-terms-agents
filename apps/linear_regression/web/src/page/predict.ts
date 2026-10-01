// Try-your-own: runs entirely in the browser from the completed run's coefficients.

export interface Model {
  features: string[];
  coefficients: Record<string, number>;
  intercept: number;
}

export interface Innings {
  runs_at_10: number;
  wickets_at_10: number;
  powerplay_runs: number;
}

export const MAX_WICKETS_AT_10 = 9;

export function validate(i: Partial<Record<keyof Innings, number>>): string[] {
  const errors: string[] = [];
  const fields: [keyof Innings, string][] = [
    ["runs_at_10", "Runs at 10 overs"], ["wickets_at_10", "Wickets at 10 overs"],
    ["powerplay_runs", "Powerplay runs"],
  ];
  for (const [k, name] of fields) {
    const v = i[k];
    if (v === undefined || Number.isNaN(v)) errors.push(`${name}: enter a number.`);
    else if (v < 0) errors.push(`${name} cannot be negative.`);
    else if (!Number.isInteger(v)) errors.push(`${name} must be a whole number.`);
  }
  if (errors.length) return errors;
  if (i.wickets_at_10! > MAX_WICKETS_AT_10) errors.push(`Wickets at 10 overs must be between 0 and ${MAX_WICKETS_AT_10}.`);
  if (i.powerplay_runs! > i.runs_at_10!) errors.push("Powerplay runs cannot be more than the runs at 10 overs.");
  return errors;
}

export function predict(m: Model, i: Innings): number {
  let total = m.intercept;
  for (const f of m.features) total += (m.coefficients[f] ?? 0) * i[f as keyof Innings];
  return total;
}

/** The broadcaster's projected score: current run rate x 20 overs. */
export function projection(runsAt10: number): number {
  return (runsAt10 / 10) * 20;
}
