// Try-your-own form: client-side only, enabled once a run has completed.
import { predict, projection, validate, type Innings, type Model } from "./predict";

export function setupTryIt(root: HTMLElement): (model: Model | null) => void {
  const form = root.querySelector("form") as HTMLFormElement;
  const out = root.querySelector("[data-testid=tryit-result]") as HTMLElement;
  const err = root.querySelector("[data-testid=tryit-error]") as HTMLElement;
  const hint = root.querySelector("[data-testid=tryit-hint]") as HTMLElement;
  const submit = form.querySelector("button") as HTMLButtonElement;
  let model: Model | null = null;

  const read = (name: string): number | undefined => {
    const v = (form.elements.namedItem(name) as HTMLInputElement).value.trim();
    return v === "" ? undefined : Number(v);
  };

  form.addEventListener("submit", (ev) => {
    ev.preventDefault();
    out.hidden = true;
    err.textContent = "";
    if (!model) return;
    const input = { runs_at_10: read("runs_at_10"), wickets_at_10: read("wickets_at_10"), powerplay_runs: read("powerplay_runs") };
    const problems = validate(input);
    if (problems.length) {
      err.textContent = problems.join(" ");
      return;
    }
    const innings = input as Innings; // validate() has confirmed every field is a number
    const mine = predict(model, innings);
    const tv = projection(innings.runs_at_10);
    out.hidden = false;
    out.innerHTML = `
      <div class="compare"><div><span class="big" data-testid="tryit-model">${mine.toFixed(0)}</span><span class="cap">our model's predicted total</span></div>
      <div><span class="big" data-testid="tryit-tv">${tv.toFixed(0)}</span><span class="cap">the TV projected score</span></div></div>`;
  });

  return (m) => {
    model = m;
    submit.disabled = !m;
    hint.hidden = !!m;
    if (!m) { out.hidden = true; err.textContent = ""; }
  };
}
