// Draws the rows: one light card per row, a pill for each step in the order a run reaches it, a numbered stage badge in the
// stage colour, a dashed outline and an "AI" tag for a language-model step. Plain HTML (no measuring), so it can be drawn
// while hidden, and every word that comes from the structure is set as text. The component marks the step the replay has
// reached; this module only builds what there is to mark.
import { loopText, type RowGroup } from "./rows";
import { resolveStage, type Resolved, type StageDef, type StructureItem } from "./stages";
import type { StructureNode } from "./structure";

export interface DrawnRows {
  nodeEls: Map<string, HTMLElement>;
  itemEls: Map<string, HTMLElement>;
  /** The pill that shows the round number, in the row that holds the loop's fit stage. */
  loopPills: HTMLElement[];
  stageOf: Map<string, Resolved>;
  actors: Map<string, "llm" | "code">;
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Record<string, string> = {}, text?: string) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  if (text !== undefined) node.textContent = text;
  return node;
}

function badge(resolved: Resolved): HTMLElement | null {
  if (resolved.state === "none") return null;
  const assigned = resolved.state === "assigned";
  const b = el("span", {
    class: `stage-badge${assigned ? "" : " unassigned"}`, "data-testid": "stage-badge",
    style: `--stage-colour: var(${assigned ? resolved.token : "--gr-stage-none"})`,
    title: assigned ? `Stage ${resolved.number}: ${resolved.stage.name}` : "No stage assigned",
  }, assigned ? String(resolved.number) : "–");
  return b;
}

function stepPill(n: StructureNode, resolved: Resolved): HTMLElement {
  const pill = el("div", { class: `node${n.actor ? ` actor-${n.actor}` : ""}`, "data-node": n.id, "data-actor": n.actor ?? "" });
  if (resolved.state === "assigned") {
    pill.setAttribute("data-stage", resolved.stage.id);
    pill.setAttribute("style", `--stage-colour: var(${resolved.token})`);
  }
  if (resolved.state === "unassigned") pill.classList.add("stage-unassigned");
  const b = badge(resolved);
  if (b) pill.append(b);
  pill.append(el("span", { class: "node-name" }, n.id));
  if (n.actor === "llm") pill.append(el("span", { class: "actor-tag", title: "A language model does this step" }, "AI"));
  pill.append(el("span", { class: "tick", hidden: "" }));
  return pill;
}

function itemPill(item: StructureItem, stages: StageDef[] | undefined, onItem: (id: string) => void): HTMLElement {
  const resolved = resolveStage({ kind: "item", stage: item.stage }, stages);
  const button = el("button", {
    type: "button", class: "item-node", "data-item": item.id, "data-testid": "item",
    "aria-label": `${item.label}, done beforehand. Show what was done.`,
  });
  if (resolved.state === "assigned") {
    button.setAttribute("data-stage", resolved.stage.id);
    button.setAttribute("style", `--stage-colour: var(${resolved.token})`);
  }
  const b = badge(resolved);
  if (b) button.append(b);
  button.append(el("span", { class: "node-name" }, item.label), el("span", { class: "item-tag" }, "done beforehand"));
  button.addEventListener("click", () => onItem(item.id));
  return button;
}

/** Fill `host` with the rows. `fitStage` is the stage whose steps start a new round: the row holding it gets the round pill. */
export function drawRows(host: HTMLElement, groups: RowGroup[], stages: StageDef[] | undefined, fitStage: string | undefined,
                         onItem: (id: string) => void): DrawnRows {
  const drawn: DrawnRows = { nodeEls: new Map(), itemEls: new Map(), loopPills: [], stageOf: new Map(), actors: new Map() };
  const cards: HTMLElement[] = [];
  for (const group of groups) {
    const card = el("section", { class: "row-card", "data-row": group.id, "data-testid": "graph-row" });
    if (group.title) {
      const head = el("header", { class: "row-head" });
      head.append(el("h4", { class: "row-title" }, group.title));
      if (group.note) head.append(el("p", { class: "row-note" }, group.note));
      const pill = el("span", { class: "loop-pill", "data-testid": "loop-round", hidden: "" });
      if (fitStage && group.nodes.some((n) => n.stage === fitStage)) { head.append(pill); drawn.loopPills.push(pill); }
      card.append(head);
    }
    const list = el("ol", { class: "row-steps" });
    for (const item of group.items) {
      const li = el("li", { class: "step item-step" });
      const pill = itemPill(item, stages, onItem);
      li.append(pill, el("span", { class: "arrow", "aria-hidden": "true" }, "→"));
      list.append(li);
      drawn.itemEls.set(item.id, pill);
    }
    group.nodes.forEach((n, i) => {
      const resolved = resolveStage(n, stages);
      drawn.stageOf.set(n.id, resolved);
      if (n.actor) drawn.actors.set(n.id, n.actor);
      const li = el("li", { class: "step" });
      const pill = stepPill(n, resolved);
      li.append(pill);
      if (i < group.nodes.length - 1) li.append(el("span", { class: "arrow", "aria-hidden": "true" }, "→"));
      list.append(li);
      drawn.nodeEls.set(n.id, pill);
    });
    card.append(list);
    const back = loopText(group.loops);
    if (back) card.append(el("p", { class: "row-loop", "data-testid": "row-loop" }, back));
    cards.push(card);
  }
  host.replaceChildren(...cards);
  return drawn;
}
