// The language-model choices for a live run (app-specific, pure): the owner's list from /api/models, shown by name and note only
// (never an id), the default first and marked. The live-run panel builds the picker from these.
export interface ModelChoice {
  name: string;
  note: string;
  default: boolean;
  choice: string; // an opaque token; the server maps it to the real model id
}

export interface RunLimits { per_hour: number; per_day?: number; deadline_seconds: number }
export interface ModelsResponse { models: ModelChoice[]; run?: RunLimits }

export function runUrl(choice: string | null): string {
  return choice ? `/api/run?model=${encodeURIComponent(choice)}` : "/api/run";
}

/** The default first, then the rest in the owner's order. */
export function orderModels(models: ModelChoice[]): ModelChoice[] {
  return [...models.filter((m) => m.default), ...models.filter((m) => !m.default)];
}

/** The option's text: its name, with "(default)" on the default. */
export const optionText = (m: ModelChoice): string => (m.default ? `${m.name} (default)` : m.name);

/** How long a live run takes and how many a visitor may start, from the server's settings; empty without them. */
export function limitsText(run: RunLimits | undefined): string {
  if (!run) return "";
  const times = run.per_hour === 1 ? "one live run" : `${run.per_hour} live runs`;
  return `A run takes up to about ${run.deadline_seconds} seconds; ${times} an hour per visitor.`;
}

export async function loadModels(fetchFn: typeof fetch = fetch): Promise<ModelsResponse | null> {
  try {
    const res = await fetchFn("/api/models", { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const body = (await res.json()) as ModelsResponse;
    return { ...body, models: orderModels(body.models) };
  } catch {
    return null;
  }
}
