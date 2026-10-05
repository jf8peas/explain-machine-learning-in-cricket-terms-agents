// The model picker (app-specific): the owner's list from /api/models, a default, and the run URL for the choice.
// A model that is no longer on the owner's list is refused by the server; the picker then reloads the list and
// goes back to the default.
import { h } from "./dom";

export interface ModelChoice {
  name: string;
  note: string;
  default: boolean;
  choice: string; // an opaque token; the server maps it to the real model id
}

export function runUrl(choice: string | null): string {
  return choice ? `/api/run?model=${encodeURIComponent(choice)}` : "/api/run";
}

export function setupModels(root: HTMLElement, replay: HTMLElement): void {
  const select = root.querySelector("[data-testid=model-select]") as HTMLSelectElement;
  const note = root.querySelector("[data-testid=model-note]") as HTMLElement;
  let models: ModelChoice[] = [];

  const apply = () => {
    const picked = models.find((m) => m.choice === select.value);
    note.textContent = picked?.note ?? "";
    // The URL is read when Play is pressed, so changing the choice never touches a run already in progress.
    replay.setAttribute("run-url", runUrl(picked?.choice ?? null));
  };

  async function load(keepChoice: string | null): Promise<void> {
    try {
      const res = await fetch("/api/models", { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      models = ((await res.json()) as { models: ModelChoice[] }).models;
    } catch {
      note.textContent = "The list of language models could not be loaded; the default model will be used.";
      return;
    }
    select.replaceChildren(...models.map((m) => h("option", { value: m.choice }, m.name)));
    const keep = models.find((m) => m.choice === keepChoice);
    select.value = (keep ?? models.find((m) => m.default) ?? models[0]).choice; // the default when nothing else is chosen
    apply();
  }

  select.addEventListener("change", apply);
  replay.addEventListener("refused", (ev) => {
    if ((ev as CustomEvent<{ reason: string }>).detail.reason === "model_not_allowed") void load(null); // back to the default
  });
  void load(null);
}
