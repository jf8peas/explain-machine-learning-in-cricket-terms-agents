// The player's controls (feature 022, app-specific): the labelled "Choose the AI" select filled from /api/models (names and notes only,
// the default first and marked, the chosen note linked with aria-describedby), the Play / Running… / Run again button, "Watch it again",
// the fixed run-length line, the shown status line, a hidden polite region that speaks only changes of phase and between an AI step
// and a code step, and the alert for a refusal or a failure. The player never starts a run itself: the page does, when it is told.
import { h } from "./dom";
import { loadModels, optionText, runUrl, type ModelChoice, type ModelsResponse } from "./models";
import { announcement, buttons, statusText, WATCH_AGAIN, type RunState } from "./run-state";

export const SELECT_LABEL = "Choose the AI";
export const RUN_LINE = "A live run · usually under a minute · runs can differ each time";
export const NO_LIST = "The list of AIs could not be loaded; the default will be used.";
export const DEFAULT_OPTION = "Default model";

export interface Player {
  el: HTMLElement;
  /** The run URL for the AI now chosen (no model when the list could not be loaded) and its display name. */
  chosen(): { url: string; name: string };
  onPlay(handler: () => void): void;
  onWatchAgain(handler: () => void): void;
  focusSelect(): void;
  /** Redraw from the run state; `doing` is the plain-words line for the node working, `kind` whether it is the AI or code. */
  render(state: RunState, doing: string | null, kind: "ai" | "code" | null): void;
  /** Fetch the list again and go back to the default (a model that was taken off the owner's list). */
  reload(): Promise<void>;
  /** A refusal or failure under the button, as an alert; empty clears it. */
  alert(text: string): void;
}

export function buildPlayer(fetchModels: () => Promise<ModelsResponse | null> = loadModels): Player {
  const select = h("select", { id: "model-select", "data-testid": "model-select", "aria-describedby": "model-note" });
  const note = h("p", { class: "muted model-note", id: "model-note", "data-testid": "model-note" });
  const play = h("button", { type: "button", class: "btn filled play", "data-testid": "play-button" }, "▶ Play");
  const again = h("button", { type: "button", class: "btn outlined", "data-testid": "watch-again", hidden: "" }, WATCH_AGAIN);
  const line = h("p", { class: "run-line", "data-testid": "run-line" }, RUN_LINE);
  const status = h("p", { class: "player-status", "data-testid": "player-status" });
  const announce = h("p", { class: "visually-hidden", role: "status", "aria-live": "polite", "aria-atomic": "true", "data-testid": "player-announce" });
  const message = h("p", { class: "run-message", role: "alert", "data-testid": "run-message" });
  const el = h("div", { class: "player-controls", "data-testid": "player-controls" },
    h("label", { class: "field", for: "model-select" }, SELECT_LABEL, select), note,
    h("div", { class: "player-actions" }, play, again), line, status, announce, message);

  let models: ModelChoice[] = [];
  const picked = () => models.find((m) => m.choice === select.value) ?? null;
  const describe = () => { note.textContent = picked()?.note ?? ""; };
  select.addEventListener("change", describe);

  async function load(): Promise<void> {
    const got = await fetchModels();
    if (!got || !got.models.length) {
      models = [];
      select.replaceChildren(h("option", { value: "" }, DEFAULT_OPTION));
      note.textContent = NO_LIST;
      return;
    }
    models = got.models;
    select.replaceChildren(...models.map((m) => h("option", { value: m.choice }, optionText(m))));
    select.value = (models.find((m) => m.default) ?? models[0]).choice;
    describe();
  }
  void load();

  let lastSpoken = "";
  let lastKind: "ai" | "code" | null = null;       // the kind of the last node seen: the instant between two nodes has none, and is not a change
  return {
    el,
    chosen: () => ({ url: runUrl(picked()?.choice ?? null), name: picked()?.name ?? "the default model" }),
    onPlay: (handler) => play.addEventListener("click", handler),
    onWatchAgain: (handler) => again.addEventListener("click", handler),
    focusSelect: () => select.focus({ preventScroll: true }),   // the page has already been scrolled to the section; focusing must not scroll it again
    render(state, doing, kind) {
      const b = buttons(state);
      play.textContent = b.play.label;
      play.disabled = b.play.disabled;
      again.hidden = !b.watchAgain;
      select.disabled = b.selectDisabled;
      status.textContent = statusText(state, doing);
      message.textContent = state.message ?? "";
      if (state.phase !== "running") lastKind = null;
      else if (kind) lastKind = kind;
      const signature = `${state.phase}|${lastKind ?? ""}`;
      if (signature !== lastSpoken) {
        lastSpoken = signature;
        const said = announcement(state, lastKind);
        if (said) announce.textContent = said;
      }
    },
    reload: load,
    alert: (text) => { message.textContent = text; },
  };
}
