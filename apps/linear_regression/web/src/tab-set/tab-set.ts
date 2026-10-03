// <tab-set default-tab="...">
// Generic: shows one child panel at a time. Children carry data-tab (id) and data-label (tab text).
// Panels are hidden, never moved or re-created, so anything running inside them keeps its state.
// The active tab lives in the URL hash (#id).

export interface TabEventDetail {
  id: string;
}

const STYLE_ID = "tab-set-styles";
const css = /* css */ `
tab-set { display: block; }
tab-set > [role=tablist] { display: flex; gap: 4px; border-bottom: 1px solid var(--ts-border, var(--border, #d5d9e0)); margin: 0 0 16px; }
tab-set > [role=tablist] > button {
  font: inherit; cursor: pointer; padding: 8px 18px; margin-bottom: -1px; color: var(--ts-muted, var(--muted, #5b6678));
  background: transparent; border: 1px solid transparent; border-radius: 8px 8px 0 0;
}
tab-set > [role=tablist] > button:hover { color: var(--ts-text, var(--text, #1b2230)); }
tab-set > [role=tablist] > button[aria-selected=true] {
  color: var(--ts-text, var(--text, #1b2230)); font-weight: 600; background: var(--ts-bg, var(--bg, #fff));
  border-color: var(--ts-border, var(--border, #d5d9e0)); border-bottom-color: var(--ts-bg, var(--bg, #fff));
  box-shadow: inset 0 3px 0 var(--ts-accent, var(--accent, #1d6fe0));
}
tab-set > [role=tablist] > button:focus-visible { outline: 3px solid var(--ts-accent, var(--accent, #1d6fe0)); outline-offset: 2px; }
tab-set > [role=tabpanel][hidden] { display: none; }
`;

export class TabSet extends HTMLElement {
  private panels: HTMLElement[] = [];
  private tabs: HTMLButtonElement[] = [];
  private current = "";

  /** Id of the tab on display. */
  get active(): string {
    return this.current;
  }

  connectedCallback() {
    if (this.tabs.length) return; // already built (moved in the DOM)
    if (!document.getElementById(STYLE_ID)) {
      const style = document.createElement("style");
      style.id = STYLE_ID;
      style.textContent = css;
      document.head.append(style);
    }
    this.panels = [...this.children].filter((el): el is HTMLElement => el instanceof HTMLElement && el.hasAttribute("data-tab"));
    if (!this.panels.length) return;

    const list = document.createElement("div");
    list.setAttribute("role", "tablist");
    list.setAttribute("aria-label", this.getAttribute("aria-label") ?? "Sections");
    for (const panel of this.panels) {
      const id = panel.dataset.tab!;
      panel.id ||= `panel-${id}`;
      panel.setAttribute("role", "tabpanel");
      panel.setAttribute("aria-labelledby", `tab-${id}`);
      const tab = document.createElement("button");
      tab.type = "button";
      tab.id = `tab-${id}`;
      tab.setAttribute("role", "tab");
      tab.setAttribute("aria-controls", panel.id);
      tab.dataset.testid = `tab-${id}`;
      tab.textContent = panel.dataset.label ?? id;
      tab.addEventListener("click", () => this.go(id));
      this.tabs.push(tab);
      list.append(tab);
    }
    list.addEventListener("keydown", (ev) => this.onKey(ev));
    this.prepend(list);

    window.addEventListener("hashchange", this.onHash);
    const wanted = this.fromHash();
    this.show(wanted ?? this.defaultId());
    // An unknown hash shows the default tab without adding a history step.
    if (wanted === null && location.hash.length > 1) history.replaceState(null, "", `#${this.defaultId()}`);
  }

  disconnectedCallback() {
    window.removeEventListener("hashchange", this.onHash);
  }

  private defaultId() {
    const wanted = this.getAttribute("default-tab");
    return this.panels.some((p) => p.dataset.tab === wanted) ? wanted! : this.panels[0].dataset.tab!;
  }

  private fromHash(): string | null {
    const id = decodeURIComponent(location.hash.slice(1));
    return this.panels.some((p) => p.dataset.tab === id) ? id : null;
  }

  private onHash = () => {
    const id = this.fromHash();
    if (id !== null) this.show(id);
    else {
      this.show(this.defaultId());
      if (location.hash.length > 1) history.replaceState(null, "", `#${this.defaultId()}`);
    }
  };

  /** One history step per real change; re-selecting the active tab does nothing. */
  private go(id: string) {
    if (id === this.current) return;
    if (location.hash.slice(1) === id) this.show(id);
    else location.hash = id; // hashchange then shows it
  }

  private show(id: string) {
    if (id === this.current) return;
    const previous = this.current;
    if (previous) this.emit("tab-hide", previous);
    for (const panel of this.panels) panel.hidden = panel.dataset.tab !== id;
    this.tabs.forEach((tab, i) => {
      const on = this.panels[i].dataset.tab === id;
      tab.setAttribute("aria-selected", String(on));
      tab.tabIndex = on ? 0 : -1;
    });
    this.current = id;
    if (previous) this.emit("tab-show", id);
  }

  private emit(type: "tab-hide" | "tab-show", id: string) {
    this.dispatchEvent(new CustomEvent<TabEventDetail>(type, { detail: { id }, bubbles: true }));
  }

  private onKey(ev: KeyboardEvent) {
    const at = this.tabs.indexOf(ev.target as HTMLButtonElement);
    if (at < 0) return;
    const last = this.tabs.length - 1;
    const to = ev.key === "ArrowRight" ? (at === last ? 0 : at + 1)
      : ev.key === "ArrowLeft" ? (at === 0 ? last : at - 1)
      : ev.key === "Home" ? 0 : ev.key === "End" ? last : -1;
    if (to < 0) return;
    ev.preventDefault();
    this.tabs[to].focus();
    this.go(this.panels[to].dataset.tab!);
  }
}

if (!customElements.get("tab-set")) customElements.define("tab-set", TabSet);
