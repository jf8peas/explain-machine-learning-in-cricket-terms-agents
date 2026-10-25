// Your turn: client-side only, enabled once a run has finished. The inputs are the ones the agent's own final model needs
// (the brute-force search's model when no language model ran, and the form says so), built from the feature catalogue.
import { bareShortTerm, cap, methodModel } from "./terms";
import { loadCatalogue } from "./catalogue";
import { h } from "./dom";
import { featureValues, fieldsFor, predict, problems, projection, type Catalogue, type Entered, type Field, type Model } from "./predict";

/** The model the form predicts with, and how to name it: "the agent's model" or "the brute-force search's model". */
export interface TryModel extends Model { source: "agent" | "search" }

export const modelName = (source: TryModel["source"]): string => `the ${methodModel(source === "agent" ? "llm" : "forward")}`;

/** The words under the model's number. */
export const predictedCaption = (source: TryModel["source"]): string =>
  source === "agent" ? "the agent's predicted total" : "the search's predicted total";

/** The agent's own final model from a run's state, or null before the final test. */
export function agentModel(state: Record<string, unknown> | null): TryModel | null {
  const m = (state?.final as { agent_model?: TryModel } | undefined)?.agent_model;
  if (!m || !Array.isArray(m.features) || !m.coefficients || m.intercept === undefined) return null;
  return { features: m.features, coefficients: m.coefficients, intercept: m.intercept, source: m.source === "search" ? "search" : "agent" };
}

export function setupTryIt(root: HTMLElement): (model: TryModel | null) => void {
  const form = root.querySelector("form") as HTMLFormElement;
  const holder = form.querySelector("[data-testid=tryit-fields]") as HTMLElement;
  const out = root.querySelector("[data-testid=tryit-result]") as HTMLElement;
  const err = root.querySelector("[data-testid=tryit-error]") as HTMLElement;
  const hint = root.querySelector("[data-testid=tryit-hint]") as HTMLElement;
  const submit = form.querySelector("button") as HTMLButtonElement;
  const whose = root.querySelector("[data-testid=tryit-model-label]") as HTMLElement;
  let model: TryModel | null = null;
  let catalogue: Catalogue | null = null;
  let fields: Field[] = [];
  /** What the visitor has typed, by field. A new run clears the form for a moment (no model yet) and rebuilds it for the
   *  new model; whatever was typed for a field the new form also asks for is put back. */
  const typed = new Map<string, string>();
  const remember = (ev: Event) => {
    const el = ev.target as HTMLInputElement | HTMLSelectElement | null;
    if (el && el.name) typed.set(el.name, el.value);
  };
  form.addEventListener("input", remember);
  form.addEventListener("change", remember);

  /** The last value of each number field that was within its range, so a keystroke or paste past the maximum can be taken back (issues 2 and 9). */
  const lastGood = new Map<string, string>();
  form.addEventListener("input", (ev) => {
    const el = ev.target as HTMLInputElement | null;
    if (!el || el.type !== "number") return;
    const max = el.max === "" ? Infinity : Number(el.max);
    if (el.value !== "" && Number(el.value) > max) {
      el.value = lastGood.get(el.name) ?? "";
      typed.set(el.name, el.value);
    } else lastGood.set(el.name, el.value);
  }, true);

  /** Mark the fields that are wrong (a red border and aria-invalid) and say why, one short line each. Nothing marked when nothing is wrong. */
  const show = (found: { field: string; message: string }[]) => {
    for (const el of form.querySelectorAll<HTMLElement>("[name]")) {
      if (found.some((p) => p.field === el.getAttribute("name"))) el.setAttribute("aria-invalid", "true"); else el.removeAttribute("aria-invalid");
    }
    err.replaceChildren(...found.map((p) => h("span", { class: "error-line" }, p.message)));
  };
  /** Once a message is showing, it follows what is typed: fixed fields drop out of it and it clears when nothing is left (issue 3). */
  const refresh = () => { if (err.textContent) show(model && catalogue ? problems(read(), fields) : []); };
  form.addEventListener("input", refresh);
  form.addEventListener("change", refresh);

  const control = (f: Field): HTMLElement => {
    if (f.kind === "choice") {
      const select = h("select", { name: f.id, "data-testid": `tryit-${f.id}` },
        ...f.options.map((o) => h("option", { value: o.value }, o.label)));
      const kept = typed.get(f.id);
      if (kept !== undefined && f.options.some((o) => o.value === kept)) select.value = kept;
      return h("label", {}, f.label, select);
    }
    const attrs: Record<string, string> = { name: f.id, type: "number", inputmode: "numeric", step: "1", min: String(f.min) };
    if (f.max !== undefined) attrs.max = String(f.max);
    const input = h("input", attrs);
    const kept = typed.get(f.id);
    if (kept !== undefined) { input.value = kept; lastGood.set(f.id, kept); }
    return h("label", {}, f.label, input);
  };

  const read = (): Entered => {
    const entered: Entered = {};
    for (const f of fields) {
      const el = form.elements.namedItem(f.id) as HTMLInputElement | HTMLSelectElement;
      if (f.kind === "choice") entered[f.id] = el.value;
      else {
        const v = el.value.trim();
        entered[f.id] = v === "" ? undefined : Number(v);
      }
    }
    return entered;
  };

  form.addEventListener("submit", (ev) => {
    ev.preventDefault();
    out.hidden = true;
    show([]);
    if (!model || !catalogue) return;
    const entered = read();
    const found = problems(entered, fields);
    if (found.length) {
      show(found);
      return;
    }
    const mine = predict(model, featureValues(entered, catalogue));
    const tv = projection(entered.runs_at_10 as number);
    out.hidden = false;
    out.replaceChildren(h("div", { class: "compare" },
      h("div", {}, h("span", { class: "big", "data-testid": "tryit-model" }, mine.toFixed(0)),
        h("span", { class: "cap", "data-testid": "tryit-model-cap" }, predictedCaption(model.source))),
      h("div", {}, h("span", { class: "big", "data-testid": "tryit-tv" }, tv.toFixed(0)),
        h("span", { class: "cap" }, cap(bareShortTerm("tv"))))));
  });

  let shown = "";   // the model the form was built for; the same model again must not wipe what was typed
  return (m) => {
    const key = m ? JSON.stringify(m) : "";
    if (key === shown) return;
    shown = key;
    model = m;
    out.hidden = true;
    show([]);
    submit.disabled = true;
    hint.hidden = !!m;
    whose.textContent = m ? `Predicting with ${modelName(m.source)}.` : "";
    if (!m) {
      holder.replaceChildren();
      fields = [];
      return;
    }
    void loadCatalogue().then((c) => {
      if (model !== m) return; // a newer model arrived while the catalogue loaded
      catalogue = c as unknown as Catalogue;
      fields = fieldsFor(m.features, catalogue);
      holder.replaceChildren(...fields.map(control));
      submit.disabled = false;
    });
  };
}
