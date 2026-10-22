// The reference figures (app-specific): fetched once from /api/reference and shared by the hero and the problem section.
// A failed or empty answer is reported as null, and the sections say so rather than show a number.
import type { Reference } from "./reference-types";

export const UNAVAILABLE = "The accuracy figures could not be loaded.";

let pending: Promise<Reference | null> | null = null;

/** The server's reference figures, or null when they could not be loaded (the next call tries again). */
export function loadReference(fetchFn: typeof fetch = fetch): Promise<Reference | null> {
  pending ??= (async () => {
    try {
      const res = await fetchFn("/api/reference");
      if (!res.ok) throw new Error(String(res.status));
      return (await res.json()) as Reference;
    } catch {
      pending = null;
      return null;
    }
  })();
  return pending;
}
