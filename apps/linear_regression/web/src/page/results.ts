// Results area (app-specific): reads the accumulated state the visualiser reports.
const esc = (s: unknown) =>
  String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] as string));

interface Attempt { features: string[]; mae: number; r2: number }
interface Explanation {
  sentences: string[];
  most_important: string;
  comparison: { model_mae: number; baseline_mae: number; beat_baseline: boolean; cleared_margin: boolean; improvement: number; r2: number };
}

export const FEATURE_LABELS: Record<string, string> = {
  runs_at_10: "Runs at the halfway mark",
  wickets_at_10: "Wickets lost at the halfway mark",
  powerplay_runs: "Powerplay runs",
};

const fmt = (n: number) => n.toFixed(1);

function attemptsTable(attempts: Attempt[], baseline: number | undefined): string {
  if (!attempts.length) return "";
  const rows = attempts.map((a, i) => {
    const added = i === 0 ? a.features.map((f) => FEATURE_LABELS[f] ?? f).join(", ")
      : `+ ${FEATURE_LABELS[a.features[a.features.length - 1]] ?? a.features[a.features.length - 1]}`;
    return `<tr data-testid="attempt-row"><th scope="row">Fit ${i + 1}: ${esc(added)}</th><td>${fmt(a.mae)}</td><td>${a.r2.toFixed(2)}</td></tr>`;
  }).join("");
  const base = baseline !== undefined
    ? `<tr class="baseline"><th scope="row">TV projected score (run rate × 20 overs)</th><td>${fmt(baseline)}</td><td>–</td></tr>` : "";
  return `<table class="attempts"><caption>Average miss in runs on the test year, by feature set</caption>
    <thead><tr><th scope="col">Model</th><th scope="col">Average miss (runs)</th><th scope="col">R²</th></tr></thead>
    <tbody>${base}${rows}</tbody></table>`;
}

export function renderResults(target: HTMLElement, state: Record<string, unknown>): void {
  const attempts = (state.attempts as Attempt[] | undefined) ?? [];
  const expl = state.explanation as Explanation | undefined;
  const baseline = state.baseline_mae as number | undefined;
  const dataError = state.data_error as string | null | undefined;

  if (dataError) {
    target.innerHTML = `<p class="error" role="alert" data-testid="data-error">${esc(dataError)}</p>`;
    return;
  }
  if (!attempts.length && !expl) {
    target.innerHTML = `<p class="muted">Results appear here as the agent works. Press Play above.</p>`;
    return;
  }

  let html = attemptsTable(attempts, baseline);
  if (expl) {
    const c = expl.comparison;
    const verdictClass = c.beat_baseline ? "win" : "lose";
    html += `
      <div class="compare ${verdictClass}" data-testid="comparison">
        <div><span class="big">${fmt(c.model_mae)}</span><span class="cap">runs: our model's average miss</span></div>
        <div><span class="big">${fmt(c.baseline_mae)}</span><span class="cap">runs: the TV projection's average miss</span></div>
        <p class="verdict" data-testid="verdict">${c.beat_baseline
          ? `The model beat the TV projection by ${fmt(Math.abs(c.improvement))} runs.`
          : `The model did not beat the TV projection (${fmt(Math.abs(c.improvement))} runs worse).`}</p>
      </div>
      <h3>In cricket terms</h3>
      <ul class="explanation" data-testid="explanation">${expl.sentences.map((s) => `<li>${esc(s)}</li>`).join("")}</ul>`;
  }
  target.innerHTML = html;
}
