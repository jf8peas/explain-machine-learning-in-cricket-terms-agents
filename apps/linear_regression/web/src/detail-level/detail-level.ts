// The detail level (feature 020), shared by both pages: "simple" shows the Scoreboard only; "everything" also opens every
// Commentary panel. The choice is remembered in localStorage (best effort: the page works without it), carried to the other
// page the same way, and can be set by a link with ?view=everything. The level is mirrored on <body data-view="..."> and
// announced with a "viewchange" event; Commentary panels are shown by CSS from that attribute, so none needs to follow it in code.
export type Level = "simple" | "everything";

export const STORAGE_KEY = "linreg:view";
export const PARAM = "view";

const isLevel = (v: unknown): v is Level => v === "simple" || v === "everything";

export interface StorageLike { getItem(key: string): string | null; setItem(key: string, value: string): void }

/** The remembered level, kept in storage when storage works and in memory otherwise. `getStorage` is called on every use
 *  and may throw (a private window, blocked site data): the store then falls back to memory for the life of the page. */
export function createStore(getStorage: () => StorageLike) {
  let memory: Level | null = null;
  const read = (): Level | null => {
    try {
      const v = getStorage().getItem(STORAGE_KEY);
      return isLevel(v) ? v : null;
    } catch {
      return null;
    }
  };
  const write = (level: Level): void => {
    memory = level;
    try {
      getStorage().setItem(STORAGE_KEY, level);
    } catch {
      /* storage blocked: the level lasts for this page only */
    }
  };
  return {
    remember: write,
    /** ?view=everything wins (and is remembered), then this page's own choice, then the stored one, then simple. */
    initial(search: string): Level {
      if (new URLSearchParams(search).get(PARAM) === "everything") {
        write("everything");
        return "everything";
      }
      return memory ?? read() ?? "simple";
    },
  };
}

const store = createStore(() => window.localStorage);

/** The level a page starts at. */
export function initialLevel(search: string = window.location.search): Level {
  return store.initial(search);
}

export function currentLevel(): Level {
  const v = document.body?.dataset.view;
  return isLevel(v) ? v : "simple";
}

/** Set the level now: remember it, mirror it on <body>, tell the page. */
export function setLevel(level: Level): void {
  store.remember(level);
  document.body.dataset.view = level;
  document.dispatchEvent(new CustomEvent<Level>("viewchange", { detail: level }));
}

/** Apply the starting level to <body> as early as possible, so the page never flashes the other view. */
export function applyInitialLevel(): Level {
  const level = initialLevel();
  document.body.dataset.view = level;
  return level;
}

let toggleRoot: ParentNode | null = null;

/** Bring every toggle button that controls a Commentary panel into step with the level: while "everything" is on its panel is
 *  open, so it reads expanded; otherwise it reads whatever the visitor last chose (kept on the button as data-open). Call it
 *  after drawing a section that holds a toggle. */
export function syncToggles(): void {
  const root = toggleRoot ?? document;
  const all = currentLevel() === "everything";
  root.querySelectorAll<HTMLElement>("[data-commentary-toggle]").forEach((button) => {
    const panel = document.getElementById(button.getAttribute("aria-controls") ?? "");
    const own = button.dataset.open === "true";
    button.setAttribute("aria-expanded", String(all || own));
    if (panel) panel.toggleAttribute("data-open", own);
  });
}

/** Wire the toggles: a click opens or closes its own panel, and the switch is followed. */
export function bindToggles(root: ParentNode = document): void {
  toggleRoot = root;
  root.addEventListener("click", (ev) => {
    const button = (ev.target as Element | null)?.closest<HTMLElement>("[data-commentary-toggle]");
    if (!button) return;
    button.dataset.open = String(button.dataset.open !== "true");
    syncToggles();
  });
  document.addEventListener("viewchange", syncToggles);
  syncToggles();
}
