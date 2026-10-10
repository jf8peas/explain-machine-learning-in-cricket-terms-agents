// <tab-set default-tab="...">
// Generic: shows one child panel at a time. Children carry data-tab (id) and data-label (tab text).
// Panels are hidden, never moved or re-created, so anything running inside them keeps its state.
// The active tab lives in the URL hash (#id).
//
// Programmatic use (no app knowledge): select(id, { focus }) switches through the same hash mechanism as a click, so Back
// and Forward still work, and with `focus` moves focus to the panel's first [tabindex="-1"] heading once it is shown;
// setMarker(id, on) shows or hides a small marker on a tab (a dot plus visually hidden text, so it never relies on colour),
// and showing a tab clears its marker. A polite live region announces programmatic switches. At narrow widths the tab list
// scrolls sideways inside itself and the selected tab is kept in view. Nothing here animates.

export interface TabEventDetail {
  id: string;
}

const STYLE_ID = "tab-set-styles";
const css = /* css */ `
tab-set { display: block; }
tab-set > [role=tablist] { position: relative; display: flex; flex-wrap: nowrap; gap: 4px; overflow-x: auto; border-bottom: 1px solid var(--ts-border, var(--border, #d5d9e0)); margin: 0 0 16px; }
tab-set > [role=tablist] > button {
  font: inherit; cursor: pointer; padding: 8px 18px; flex: 0 0 auto; white-space: nowrap; position: relative; margin-bottom: -1px; color: var(--ts-muted, var(--muted, #5b6678));
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
tab-set .ts-marker { display: inline-block; width: .5em; height: .5em; margin-left: .45em; border-radius: 50%; background: currentColor; vertical-align: middle; }
tab-set .ts-marker[hidden] { display: none; }
tab-set .ts-sr, tab-set .ts-live { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
`;

export class TabSet extends HTMLElement {
  private panels: HTMLElement[] = [];
  private tabs: HTMLButtonElement[] = [];
  private current = "";
  private list!: HTMLElement;
  private live!: HTMLElement;
  /** Set by select(): the next show() (or this one, if the tab is already showing) announces and, with `focus`, focuses. */
  private pending: { id: string; focus: boolean } | null = null;

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
    this.list = list;
    this.prepend(list);
    this.live = document.createElement("div");
    this.live.className = "ts-live";
    this.live.setAttribute("role", "status");
    this.live.setAttribute("aria-live", "polite");
    this.live.dataset.testid = "tab-live";
    this.append(this.live);

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

  /** Switch to a tab from code, through the hash like a click (so Back and Forward work). With `focus`, focus moves to the
   *  panel's first [tabindex="-1"] heading once the panel is shown. The change is announced to screen readers. */
  select(id: string, opts: { focus?: boolean } = {}) {
    if (!this.panels.some((p) => p.dataset.tab === id)) return;
    this.pending = { id, focus: !!opts.focus };
    if (id === this.current) this.finishSelect(id);
    else this.go(id);
  }

  /** Show or hide the small marker on a tab. Showing the tab clears it. */
  setMarker(id: string, on: boolean) {
    const i = this.panels.findIndex((p) => p.dataset.tab === id);
    if (i < 0) return;
    const tab = this.tabs[i];
    const had = !!tab.querySelector(".ts-marker");
    if (on === had) return;
    if (!on) { tab.querySelectorAll(".ts-marker, .ts-sr").forEach((el) => el.remove()); return; }
    const dot = document.createElement("span");
    dot.className = "ts-marker";
    dot.setAttribute("aria-hidden", "true");
    const text = document.createElement("span");
    text.className = "ts-sr";
    text.textContent = " (new results)";
    tab.append(dot, text);
  }

  hasMarker(id: string): boolean {
    const i = this.panels.findIndex((p) => p.dataset.tab === id);
    return i >= 0 && !!this.tabs[i].querySelector(".ts-marker");
  }

  private finishSelect(id: string) {
    const want = this.pending;
    if (!want || want.id !== id) return;
    this.pending = null;
    const panel = this.panels.find((p) => p.dataset.tab === id)!;
    this.live.textContent = "";                                             // so a repeat is announced again
    this.live.textContent = `Now showing: ${panel.dataset.label ?? id}`;
    if (want.focus) (panel.querySelector('[tabindex="-1"]') as HTMLElement | null)?.focus();
  }

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
    this.setMarker(id, false);
    this.keepInView(this.tabs[this.panels.findIndex((p) => p.dataset.tab === id)]);
    if (previous) this.emit("tab-show", id);
    this.finishSelect(id);
  }

  /** On a narrow screen the tab list scrolls inside itself; keep the selected tab inside its visible part. */
  private keepInView(tab: HTMLElement) {
    const l = this.list;
    if (!l || !tab) return;
    if (tab.offsetLeft < l.scrollLeft) l.scrollLeft = tab.offsetLeft;
    else if (tab.offsetLeft + tab.offsetWidth > l.scrollLeft + l.clientWidth) l.scrollLeft = tab.offsetLeft + tab.offsetWidth - l.clientWidth;
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
