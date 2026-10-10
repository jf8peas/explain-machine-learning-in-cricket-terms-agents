// Try-your-own form: client-side only, enabled once a run has finished. The inputs are the ones the winning model
// needs, built from the feature catalogue.
import { loadCatalogue } from "./catalogue";
import { h } from "./dom";
import { featureValues, fieldsFor, predict, projection, validate, type Catalogue, type Entered, type Field, type Model } from "./predict";

export function setupTryIt(root: HTMLElement): (model: Model | null) => void {
  const form = root.querySelector("form") as HTMLFormElement;
  const holder = form.querySelector("[data-testid=tryit-fields]") as HTMLElement;
  const out = root.querySelector("[data-testid=tryit-result]") as HTMLElement;
  const err = root.querySelector("[data-testid=tryit-error]") as HTMLElement;
  const hint = root.querySelector("[data-testid=tryit-hint]") as HTMLElement;
  const submit = form.querySelector("button") as HTMLButtonElement;
  let model: Model | null = null;
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

  const control = (f: Field): HTMLElement => {
    if (f.kind === "choice") {
      const select = h("select", { name: f.id, "data-testid": `tryit-${f.id}` },
        ...f.options.map((o) => h("option", { value: o.value }, o.label)));
      const kept = typed.get(f.id);
      if (kept !== undefined && f.options.some((o) => o.value === kept)) select.value = kept;
      return h("label", {}, f.label, select);
    }
    const attrs: Record<string, string> = { name: f.id, type: "number", inputmode: "numeric", min: String(f.min) };
    if (f.max !== undefined) attrs.max = String(f.max);
    const input = h("input", attrs);
    const kept = typed.get(f.id);
    if (kept !== undefined) input.value = kept;
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
    err.textContent = "";
    if (!model || !catalogue) return;
    const entered = read();
    const problems = validate(entered, fields);
    if (problems.length) {
      err.textContent = problems.join(" ");
      return;
    }
    const mine = predict(model, featureValues(entered, catalogue));
    const tv = projection(entered.runs_at_10 as number);
    out.hidden = false;
    out.replaceChildren(h("div", { class: "compare" },
      h("div", {}, h("span", { class: "big", "data-testid": "tryit-model" }, mine.toFixed(0)),
        h("span", { class: "cap" }, "our model's predicted total")),
      h("div", {}, h("span", { class: "big", "data-testid": "tryit-tv" }, tv.toFixed(0)),
        h("span", { class: "cap" }, "the TV projected score"))));
  });

  let shown = "";   // the model the form was built for; the same model again must not wipe what was typed
  return (m) => {
    const key = m ? JSON.stringify(m) : "";
    if (key === shown) return;
    shown = key;
    model = m;
    out.hidden = true;
    err.textContent = "";
    submit.disabled = true;
    hint.hidden = !!m;
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
