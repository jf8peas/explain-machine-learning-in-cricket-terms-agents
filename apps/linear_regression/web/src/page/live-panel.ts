// The live-run panel (app-specific): closed until its toggle (or Show me everything) opens it. A labelled Language model select
// filled from /api/models (names and notes only, the default first and marked, the chosen note linked with aria-describedby),
// the note that runs can differ, how long a run takes and how many a visitor may start (read from the server's settings),
// and "Start live run". The gate's refusal is shown here, in the panel. The panel never starts a run itself: the page does.
import { h } from "./dom";
import { limitsText, loadModels, optionText, runUrl, type ModelChoice, type ModelsResponse } from "./models";

export const START_LABEL = "Start live run";
export const NO_LIST = "The list of language models could not be loaded; the default model will be used.";
export const WHY_DIFFERENT = "Code still checks and scores everything it proposes.";

export interface LivePanel {
  el: HTMLElement;
  /** The run URL for the model now chosen, and the model's display name. */
  chosen(): { url: string; name: string };
  onStart(handler: () => void): void;
  /** Disable Start while a run is on; enable it again when it ends. */
  setBusy(busy: boolean): void;
  /** One line under the button (the gate's message, or progress); empty clears it. */
  say(text: string, isError?: boolean): void;
  /** Fetch the list again and go back to the default (a model that was taken off the owner's list). */
  reload(): Promise<void>;
}

export function buildLivePanel(fetchModels: () => Promise<ModelsResponse | null> = loadModels): LivePanel {
  const select = h("select", { "data-testid": "model-select", "aria-describedby": "model-note", id: "model-select" });
  const note = h("p", { class: "muted model-note", id: "model-note", "data-testid": "model-note" });
  const limits = h("span", { "data-testid": "run-limits" });
  const start = h("button", { type: "button", class: "btn filled", "data-testid": "live-start" }, START_LABEL);
  const message = h("p", { class: "live-message", role: "status", "data-testid": "live-message" });
  const el = h("div", { "data-region": "commentary", class: "commentary live-panel", id: "live-panel", "data-testid": "live-panel" },
    h("label", { class: "field", for: "model-select" }, "Language model ", select), note,
    h("p", { class: "variation-note", "data-testid": "variation-note" },
      "Because a language model is involved, ", h("strong", {}, "runs can differ each time"), ". ", WHY_DIFFERENT, " ", limits),
    h("div", { class: "live-actions" }, start), message);

  let models: ModelChoice[] = [];
  const picked = () => models.find((m) => m.choice === select.value) ?? null;
  const describe = () => { note.textContent = picked()?.note ?? ""; };
  select.addEventListener("change", describe);

  async function load(): Promise<void> {
    const got = await fetchModels();
    if (!got || !got.models.length) {
      models = [];
      select.replaceChildren(h("option", { value: "" }, "Default model"));
      note.textContent = NO_LIST;
      return;
    }
    models = got.models;
    select.replaceChildren(...models.map((m) => h("option", { value: m.choice }, optionText(m))));
    select.value = (models.find((m) => m.default) ?? models[0]).choice;
    limits.textContent = limitsText(got.run);
    describe();
  }
  void load();

  return {
    el,
    chosen: () => ({ url: runUrl(picked()?.choice ?? null), name: picked()?.name ?? "the default model" }),
    onStart: (handler) => start.addEventListener("click", handler),
    setBusy: (busy) => { start.disabled = busy; },
    say: (text, isError = false) => { message.textContent = text; message.classList.toggle("error", isError); },
    reload: load,
  };
}
