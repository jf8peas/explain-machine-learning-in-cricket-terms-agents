// How a state value is shown in the state panel. Generic: it knows nothing about what the values are.
// A long array (hundreds of numbers for a chart, say) would swamp the panel, so it is shown as a count.

/** Arrays longer than this are shown as "N items". */
export const LONG_ARRAY = 20;

export function summarise(value: unknown): unknown {
  if (Array.isArray(value)) return value.length > LONG_ARRAY ? `${value.length} items` : value.map(summarise);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, summarise(v)]));
  }
  return value;
}
