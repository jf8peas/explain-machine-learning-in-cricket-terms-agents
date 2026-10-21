// Puts the live figures into the Under the hood page and wires the "Stage by stage" panels to their state.
// Everything the page says is already in its HTML; this only fills the [data-figure] spans, builds the two lists and
// makes the stage headers work. Text is only ever set with textContent.
import { GROUP_PLACEHOLDER, PLACEHOLDER, TEXT_KEYS, type LiveFigures, type TextKey } from "./figures";
import { initial, nextAll, toggle, toggleAllLabel, type PanelState } from "./panels";

const isTextKey = (key: string | undefined): key is TextKey => TEXT_KEYS.includes(key as TextKey);

function el<K extends keyof HTMLElementTagNameMap>(tag: K, text?: string, className?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  return node;
}

export function fillFigures(root: ParentNode, figures: LiveFigures): void {
  const has = (key: string | undefined): boolean => isTextKey(key) && figures[key] !== undefined;

  for (const span of root.querySelectorAll<HTMLElement>("[data-figure]")) {
    const key = span.dataset.figure;
    span.textContent = isTextKey(key) && figures[key] !== undefined ? (figures[key] as string) : PLACEHOLDER;
  }

  // a sentence holding live figures is shown whole or replaced whole, never half-filled
  for (const group of root.querySelectorAll<HTMLElement>("[data-figure-group]")) {
    const keys = [...group.querySelectorAll<HTMLElement>("[data-figure]")].map((s) => s.dataset.figure);
    if (!keys.every(has)) group.textContent = GROUP_PLACEHOLDER;
  }

  const competitions = root.querySelector<HTMLElement>('[data-figure-list="competitions"]');
  if (competitions && figures.competitions && figures.competitions.length > 0) {
    competitions.replaceChildren(
      ...figures.competitions.map((c) => {
        const row = el("tr");
        row.append(el("th", c.name), el("td", c.innings, "num"));
        row.firstElementChild?.setAttribute("scope", "row");
        return row;
      }),
    );
  }

  const exclusions = root.querySelector<HTMLElement>('[data-figure-list="exclusions"]');
  if (exclusions && figures.exclusions) {
    if (figures.exclusions.length === 0) {
      exclusions.replaceChildren(el("p", "No matches were left out.", "muted"));
    } else {
      const list = el("dl", undefined, "reasons");
      for (const reason of figures.exclusions) {
        list.append(el("dt", `${reason.label}, ${reason.count}${reason.explanation ? ":" : ""}`));
        if (reason.explanation) list.append(el("dd", reason.explanation));
      }
      exclusions.replaceChildren(list);
    }
  }
}

/** Opens and closes the stage panels from the state in panels.ts; the headers and regions are already in the HTML. */
export function mountPanels(root: ParentNode): void {
  const heads = [...root.querySelectorAll<HTMLButtonElement>(".stage-head")];
  const toggleAll = root.querySelector<HTMLButtonElement>('[data-testid="toggle-all"]');
  let state: PanelState = initial();

  const render = (): void => {
    heads.forEach((head, i) => {
      head.setAttribute("aria-expanded", String(state[i] === true));
      const region = document.getElementById(head.getAttribute("aria-controls") ?? "");
      if (region) region.hidden = state[i] !== true;
    });
    if (toggleAll) toggleAll.textContent = toggleAllLabel(state);
  };

  heads.forEach((head, i) =>
    head.addEventListener("click", () => {
      state = toggle(state, i);
      render();
    }),
  );
  toggleAll?.addEventListener("click", () => {
    state = nextAll(state);
    render();
  });
  render();
}
