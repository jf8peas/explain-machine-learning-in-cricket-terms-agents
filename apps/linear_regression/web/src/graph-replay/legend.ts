// The legend: the stages in order, each a real button, with an "All" button, the app's notes, and a polite live region.
// It builds only from what the structure supplied, and sets every piece of server text with textContent. It reports
// the selected stage through `onSelect` and knows nothing about the replay: the selection is a viewing preference.
import { colourToken, type Notes, type StageDef, type StructureItem } from "./stages";

export interface LegendOptions {
  stages: StageDef[];
  notes?: Notes;
  /** Ids of the stages that have at least one node in the graph. */
  withNodes: Set<string>;
  /** Ids of steps with no stage, or a stage that is not in the set: flagged below the list. */
  unassigned?: string[];
  onSelect: (stageId: string | null) => void;
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Record<string, string> = {}, text?: string) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  if (text !== undefined) node.textContent = text;
  return node;
}

export class Legend {
  private selectedId: string | null = null;
  private buttons = new Map<string, HTMLButtonElement>();
  private all!: HTMLButtonElement;
  private detail!: HTMLElement;
  private live!: HTMLElement;

  constructor(private root: HTMLElement, private opts: LegendOptions) {
    this.render();
  }

  get selected(): string | null { return this.selectedId; }

  private render() {
    const { stages, notes, withNodes } = this.opts;
    const list = el("ul", { class: "legend-list", role: "group", "aria-label": "Stages" });
    for (const [i, stage] of stages.entries()) {
      const number = i + 1;
      const button = el("button", {
        type: "button", class: "legend-stage", "data-testid": "legend-stage", "data-stage": stage.id,
        "aria-pressed": "false", style: `--stage-colour: var(${colourToken(number)})`,
      });
      button.append(el("span", { class: "badge", "aria-hidden": "true" }, String(number)),
        el("span", { class: "name" }, stage.name), el("span", { class: "question" }, stage.question));
      const note = notes?.stages?.[stage.id];
      if (!withNodes.has(stage.id)) button.append(el("span", { class: "no-node" }, "Not a step in this agent"));
      if (note) button.append(el("span", { class: "stage-note" }, note));
      button.addEventListener("click", () => this.select(this.selectedId === stage.id ? null : stage.id));
      this.buttons.set(stage.id, button);
      const item = el("li");
      item.append(button);
      list.append(item);
    }
    this.all = el("button", { type: "button", class: "legend-all", "data-testid": "legend-all" }, "All");
    this.all.addEventListener("click", () => this.select(null));
    this.detail = el("p", { class: "legend-detail", "data-testid": "legend-detail" });
    this.live = el("div", { class: "sr-only", role: "status", "aria-live": "polite", "data-testid": "legend-live" });
    const general = this.opts.notes?.general;
    const parts: HTMLElement[] = [el("h3", { id: "h-legend" }, "Stages"), list];
    const loose = this.opts.unassigned ?? [];
    if (loose.length) {
      parts.push(el("p", { class: "legend-unassigned", "data-testid": "legend-unassigned" },
        `No stage assigned: ${loose.join(", ")}`));
    }
    parts.push(this.all, this.detail);
    if (general) parts.push(el("p", { class: "legend-note", "data-testid": "legend-note" }, general));
    parts.push(this.live);
    this.root.replaceChildren(...parts);
    this.root.hidden = false;
    this.showDetail();
  }

  /** Select a stage, or clear with null; announces the change. */
  select(id: string | null) {
    this.selectedId = id;
    for (const [sid, b] of this.buttons) b.setAttribute("aria-pressed", String(sid === id));
    this.showDetail();
    const stages = this.opts.stages;
    const i = id === null ? -1 : stages.findIndex((s) => s.id === id);
    this.live.textContent = i < 0 ? "Highlight cleared." : `Highlighting stage ${i + 1}, ${stages[i].name}. Other steps are dimmed.`;
    this.opts.onSelect(id);
  }

  /** The line shown instead of the entries' own text on narrow screens, where each stage is a numbered chip. */
  private showDetail() {
    const stages = this.opts.stages;
    const i = this.selectedId === null ? -1 : stages.findIndex((s) => s.id === this.selectedId);
    if (i < 0) { this.detail.textContent = "Select a stage to highlight its steps."; return; }
    const note = this.opts.notes?.stages?.[stages[i].id];
    this.detail.textContent = `${i + 1}. ${stages[i].name}: ${stages[i].question}${note ? ` ${note}` : ""}`;
  }
}

/** The panel that shows a done-beforehand item's summary. It sits apart from the Event panel, which a running replay
 *  rewrites at every step. All text is set with textContent, and a link is only made for a same-page target (#...). */
export class ItemPanel {
  private shownId: string | null = null;

  constructor(private root: HTMLElement, private onClose: () => void) {}

  get open(): string | null { return this.shownId; }

  show(item: StructureItem) {
    this.shownId = item.id;
    const parts: HTMLElement[] = [];
    const heading = el("h3", { id: "h-item" }, item.label);
    heading.append(" ", el("span", { class: "item-tag-inline" }, "done beforehand"));
    parts.push(heading);
    if (item.summary.text) parts.push(el("p", { class: "item-text", "data-testid": "item-text" }, item.summary.text));
    if (item.summary.rows?.length) {
      const dl = el("dl", { class: "item-rows" });
      for (const row of item.summary.rows) dl.append(el("dt", {}, row.label), el("dd", {}, row.value));
      parts.push(dl);
    }
    const link = item.summary.link;
    if (link) {
      parts.push(link.href.startsWith("#")
        ? el("a", { href: link.href, "data-testid": "item-link" }, link.label)
        : el("span", { class: "item-link-text", "data-testid": "item-link-text" }, `${link.label} (${link.href})`));
    }
    const close = el("button", { type: "button", "data-testid": "item-close" }, "Close");
    close.addEventListener("click", () => this.onClose());
    parts.push(close);
    this.root.replaceChildren(...parts);
    this.root.hidden = false;
  }

  hide() {
    this.shownId = null;
    this.root.hidden = true;
    this.root.replaceChildren();
  }
}
