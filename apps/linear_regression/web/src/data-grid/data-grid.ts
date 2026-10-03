// <data-grid noun="rows">
// Generic: shows a table (columns, rows, summary) as a read-only spreadsheet-style grid with a summary,
// column guide, search, filters, a count and a CSV download. Knows nothing about what the data is about.
// Properties: `table` (a DataTable). Methods: setLoading(), setError(message). Event: `retry`.
import { csvFileName, downloadCsv, toCsv } from "./csv";
import { createGrid, type GridAdapter } from "./grid-adapter";
import { styles } from "./styles";
import { filterOptions, isFiltered, isViewActive, nextSort, visibleRows } from "./table-view";
import { emptyView, type ColumnDef, type DataTable, type Note, type Value, type ViewState } from "./types";

const STYLE_ID = "data-grid-styles";
const fmt = (n: number) => n.toLocaleString("en");

function el<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Record<string, string> = {}, text?: string) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  if (text !== undefined) node.textContent = text;
  return node;
}

export class DataGrid extends HTMLElement {
  private data: DataTable | null = null;
  private view: ViewState = emptyView();
  private shown: Value[][] = [];
  private adapter: GridAdapter | null = null;
  private savedScroll = { top: 0, left: 0 };
  private root!: HTMLElement;
  private stateBox!: HTMLElement;
  private body!: HTMLElement;
  private tabSet: Element | null = null;

  connectedCallback() {
    if (this.root) return;
    if (!document.getElementById(STYLE_ID)) {
      const style = el("style", { id: STYLE_ID });
      style.textContent = styles;
      document.head.append(style);
    }
    this.root = el("div", { class: "dg-root" });
    this.stateBox = el("div", { class: "dg-state", role: "status", "data-testid": "data-state" });
    this.stateBox.hidden = true;
    this.body = el("div", { class: "dg-body", "data-testid": "data-body" });
    this.body.hidden = true;
    this.root.append(this.stateBox, this.body);
    this.append(this.root);
    this.setLoading();

    // Remember scroll when our tab is hidden; redraw and restore when it is shown again.
    this.tabSet = this.closest("tab-set");
    this.tabSet?.addEventListener("tab-hide", this.onTabHide);
    this.tabSet?.addEventListener("tab-show", this.onTabShow);
  }

  disconnectedCallback() {
    this.tabSet?.removeEventListener("tab-hide", this.onTabHide);
    this.tabSet?.removeEventListener("tab-show", this.onTabShow);
  }

  private ownTab(ev: Event) {
    return (ev as CustomEvent<{ id: string }>).detail?.id === this.closest<HTMLElement>("[data-tab]")?.dataset.tab;
  }
  private onTabHide = (ev: Event) => {
    if (this.adapter && !ev.defaultPrevented && this.closest<HTMLElement>("[data-tab]")?.hidden === false) {
      this.savedScroll = this.adapter.getScroll();
    }
  };
  private onTabShow = (ev: Event) => {
    if (!this.ownTab(ev) || !this.adapter) return;
    requestAnimationFrame(() => {
      this.adapter?.redraw();
      this.adapter?.setScroll(this.savedScroll);
    });
  };

  set table(value: DataTable) {
    this.data = value;
    this.view = emptyView();
    this.build();
    this.render();
  }
  get table(): DataTable | null {
    return this.data;
  }

  setLoading() {
    this.stateBox.className = "dg-state";
    this.stateBox.replaceChildren(el("p", {}, "Loading the data…"));
    this.stateBox.hidden = false;
    this.body.hidden = true;
  }

  setError(message: string) {
    this.stateBox.className = "dg-state error";
    const retry = el("button", { type: "button", "data-testid": "data-retry" }, "Try again");
    retry.addEventListener("click", () => this.dispatchEvent(new CustomEvent("retry", { bubbles: true })));
    this.stateBox.replaceChildren(el("p", {}, `The data could not be loaded. ${message}`), retry);
    this.stateBox.hidden = false;
    this.body.hidden = true;
  }

  private get noun() {
    return this.getAttribute("noun") ?? "rows";
  }

  private build() {
    const data = this.data!;
    this.adapter?.destroy();
    this.adapter = null;
    this.body.replaceChildren();
    this.stateBox.hidden = true;
    this.body.hidden = false;

    // Summary
    const summary = el("section", { class: "dg-summary", "data-testid": "data-summary", "aria-label": "Data summary" });
    const headline = el("dl", { class: "dg-headline" });
    for (const item of data.summary.headline) {
      const box = el("div");
      box.append(el("dt", {}, item.label), el("dd", {}, item.value));
      headline.append(box);
    }
    const sections = el("div", { class: "dg-sections" });
    for (const s of data.summary.sections) {
      const box = el("div");
      const list = el("ul");
      for (const r of s.rows) {
        const li = el("li");
        li.append(el("span", {}, r.label), el("span", {}, r.value));
        list.append(li);
      }
      box.append(el("h3", {}, s.title));
      if (s.note) box.append(el("p", { class: "dg-note", "data-testid": "section-note" }, s.note));
      box.append(list);
      sections.append(box);
    }
    summary.append(headline, sections);

    // Column guide
    const guide = el("details", { class: "dg-guide", "data-testid": "column-guide" });
    guide.append(el("summary", {}, "Column guide"));
    const dl = el("dl");
    for (const c of data.columns) dl.append(el("dt", {}, c.label), el("dd", {}, c.description));
    guide.append(dl);
    const helpRow = el("div", { class: "dg-help-row" });
    helpRow.append(guide, ...(data.notes ?? []).map((n, i) => this.noteSection(n, i)));

    // Toolbar
    const toolbar = el("div", { class: "dg-toolbar", role: "search" });
    const searchLabel = el("label");
    const search = el("input", { type: "search", "data-testid": "data-search", placeholder: "Search any column", "aria-label": "Search any column" });
    searchLabel.append("Search", search);
    search.addEventListener("input", () => {
      this.view = { ...this.view, search: search.value };
      this.render();
    });
    toolbar.append(searchLabel);
    for (const col of data.columns.filter((c) => c.filter)) toolbar.append(this.filterControl(col));
    const clear = el("button", { type: "button", "data-testid": "clear-filters" }, "Clear filters");
    clear.addEventListener("click", () => this.clearFilters());
    const count = el("p", { class: "dg-count", "data-testid": "data-count", "aria-live": "polite" });
    toolbar.append(clear, count);

    // Download
    const download = el("div", { class: "dg-download" });
    const button = el("button", { type: "button", class: "primary", "data-testid": "download-csv", "aria-haspopup": "menu", "aria-expanded": "false" }, "Download CSV");
    const menu = el("div", { class: "dg-menu", role: "menu", "data-testid": "download-menu" });
    menu.hidden = true;
    const all = el("button", { type: "button", role: "menuitem", "data-testid": "download-all" });
    const rowsShown = el("button", { type: "button", role: "menuitem", "data-testid": "download-shown" });
    menu.append(all, rowsShown);
    download.append(button, menu, this.attribution("dg-attribution", "attribution-download"));
    button.addEventListener("click", () => {
      if (!isViewActive(this.view)) this.download(data.rows);
      else this.toggleMenu(true);
    });
    all.addEventListener("click", () => { this.toggleMenu(false); this.download(data.rows); });
    rowsShown.addEventListener("click", () => { this.toggleMenu(false); this.download(this.shown); });
    menu.addEventListener("keydown", (ev) => this.onMenuKey(ev));
    this.root.addEventListener("keydown", (ev) => { if (ev.key === "Escape") this.toggleMenu(false, true); });
    document.addEventListener("click", (ev) => { if (!download.contains(ev.target as Node)) this.toggleMenu(false); });

    // Grid
    const wrap = el("div", { class: "dg-gridwrap" });
    const gridBox = el("div", { class: "dg-grid", "data-testid": "data-grid-area" });
    const empty = el("div", { class: "dg-empty", "data-testid": "data-empty", role: "status" });
    empty.hidden = true;
    const emptyText = el("p", {}, `No ${this.noun} match your search and filters.`);
    const emptyClear = el("button", { type: "button", "data-testid": "empty-clear" }, "Clear filters");
    emptyClear.addEventListener("click", () => this.clearFilters());
    empty.append(emptyText, emptyClear);
    wrap.append(gridBox, empty);
    const help = el("p", { class: "dg-help", "aria-live": "polite", "data-testid": "heading-help" });

    this.body.append(summary, helpRow, toolbar, download, wrap, help, this.attribution("dg-attribution", "attribution-foot"));
    this.adapter = createGrid(gridBox, data.columns, {
      onHeaderActivate: (key) => {
        this.view = { ...this.view, sort: nextSort(this.view.sort, key) };
        this.render();
      },
      onHeaderFocus: (key) => {
        const col = data.columns.find((c) => c.key === key);
        help.textContent = col ? `${col.label}: ${col.description}` : "";
      },
    });
  }

  /** A note as a closed collapsible section; text is set with textContent, never as HTML. */
  private noteSection(note: Note, index: number): HTMLElement {
    const box = el("details", { class: "dg-guide dg-note-section", "data-testid": `note-${index}` });
    box.append(el("summary", {}, note.title));
    for (const text of note.paragraphs) box.append(el("p", {}, text));
    if (note.example) {
      const { caption, columns, rows } = note.example;
      if (caption) box.append(el("p", { class: "dg-caption" }, caption));
      const table = el("table", { class: "dg-example" });
      const head = el("tr");
      for (const c of columns) head.append(el("th", { scope: "col" }, c));
      const thead = el("thead");
      thead.append(head);
      table.append(thead);
      const body = el("tbody");
      for (const r of rows) {
        const tr = el("tr");
        for (const v of r) tr.append(el("td", {}, v));
        body.append(tr);
      }
      table.append(body);
      box.append(table);
    }
    return box;
  }

  private attribution(cls: string, testid: string) {
    const p = el("p", { class: cls, "data-testid": testid });
    const { attribution, attribution_url } = this.data!.summary;
    if (attribution_url && attribution.includes("Cricsheet")) {
      const [before, ...rest] = attribution.split("Cricsheet");
      const link = el("a", { href: attribution_url, rel: "noopener" }, "Cricsheet");
      p.append(before, link, rest.join("Cricsheet"));
    } else p.textContent = attribution;
    return p;
  }

  private filterControl(col: ColumnDef): HTMLElement {
    const label = el("label");
    const select = el("select", { "data-testid": `filter-${col.key}`, "aria-label": col.filter === "year" ? `${col.label} (year)` : col.label });
    select.append(el("option", { value: "" }, "All"));
    for (const o of filterOptions(this.data!, col)) select.append(el("option", { value: o.value }, o.label));
    select.addEventListener("change", () => {
      this.view = { ...this.view, filters: { ...this.view.filters, [col.key]: select.value } };
      this.render();
    });
    label.append(col.filter === "year" ? `${col.label.replace(/ date$/i, "")} year` : col.label, select);
    return label;
  }

  private clearFilters() {
    this.view = { ...this.view, search: "", filters: {} };
    this.body.querySelectorAll<HTMLSelectElement>("select").forEach((s) => (s.value = ""));
    const search = this.body.querySelector<HTMLInputElement>("input[type=search]");
    if (search) search.value = "";
    this.render();
  }

  private render() {
    const data = this.data;
    if (!data) return;
    this.shown = visibleRows(data, this.view);
    this.adapter?.setSort(this.view.sort);
    this.adapter?.setRows(this.shown);

    const q = <T extends HTMLElement>(sel: string) => this.body.querySelector<T>(sel)!;
    q("[data-testid=data-count]").textContent = `Showing ${fmt(this.shown.length)} of ${fmt(data.rows.length)} ${this.noun}`;
    const none = this.shown.length === 0;
    q("[data-testid=data-grid-area]").hidden = none;
    q("[data-testid=data-empty]").hidden = !none;
    q("[data-testid=clear-filters]").hidden = !isFiltered(this.view);
    q<HTMLButtonElement>("[data-testid=download-all]").textContent = `All rows (${fmt(data.rows.length)})`;
    const shownBtn = q<HTMLButtonElement>("[data-testid=download-shown]");
    shownBtn.textContent = `Rows shown (${fmt(this.shown.length)})`;
    shownBtn.disabled = none;
    if (!isViewActive(this.view)) this.toggleMenu(false);
  }

  private toggleMenu(open: boolean, returnFocus = false) {
    const menu = this.body.querySelector<HTMLElement>("[data-testid=download-menu]");
    const button = this.body.querySelector<HTMLElement>("[data-testid=download-csv]");
    if (!menu || !button) return;
    const was = !menu.hidden;
    menu.hidden = !open;
    button.setAttribute("aria-expanded", String(open));
    if (open) menu.querySelector<HTMLElement>("button:not(:disabled)")?.focus();
    else if (was && returnFocus) button.focus();
  }

  private onMenuKey(ev: KeyboardEvent) {
    if (ev.key !== "ArrowDown" && ev.key !== "ArrowUp") return;
    const items = [...(ev.currentTarget as HTMLElement).querySelectorAll<HTMLButtonElement>("button:not(:disabled)")];
    const at = items.indexOf(document.activeElement as HTMLButtonElement);
    if (!items.length) return;
    ev.preventDefault();
    items[(at + (ev.key === "ArrowDown" ? 1 : -1) + items.length) % items.length].focus();
  }

  private download(rows: Value[][]) {
    const data = this.data!;
    downloadCsv(csvFileName(data.summary), toCsv(data.columns, rows));
  }
}

if (!customElements.get("data-grid")) customElements.define("data-grid", DataGrid);
