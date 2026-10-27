// Keeping the visit's last finished run while the reader looks at another page (issue 22): it is written to sessionStorage as the page is left
// and read back when the reader returns to this tab, so "Back to the app" finds the run, the verdict and Your turn as they were. Best effort:
// the page works without storage. A reload is a fresh start (feature 022), so it neither reads nor keeps what was saved.
import type { Run } from "./run-state";

const KEY = "linreg.lastRun";

const storage = (): Storage | null => { try { return window.sessionStorage; } catch { return null; } };

const isRun = (x: unknown): x is Run => {
  const r = x as Run | null;
  return !!r && Array.isArray(r.events) && r.events.length > 0 && typeof r.modelName === "string" && !!r.state && typeof r.state === "object" && !!r.state.final;
};

/** Keep this run, or forget any kept one when there is none. */
export function saveRun(run: Run | null): void {
  const s = storage();
  if (!s) return;
  try {
    if (run) s.setItem(KEY, JSON.stringify({ events: run.events, state: run.state, modelName: run.modelName }));
    else s.removeItem(KEY);
  } catch { /* storage full or blocked: the run is simply not kept */ }
}

/** The kept run, taken out of storage (so it is used once); null after a reload, or when nothing valid was kept. */
export function takeSavedRun(reloaded = isReload()): Run | null {
  const s = storage();
  if (!s) return null;
  try {
    const text = s.getItem(KEY);
    s.removeItem(KEY);
    if (!text || reloaded) return null;
    const saved = JSON.parse(text) as Run;
    return isRun(saved) ? { events: saved.events, state: saved.state, modelName: saved.modelName, inProgress: null, stoppedAt: null } : null;
  } catch { return null; }
}

function isReload(): boolean {
  const nav = performance.getEntriesByType?.("navigation")[0] as PerformanceNavigationTiming | undefined;
  return nav?.type === "reload";
}
