// <graph-replay structure-url="..." run-url="...">
// Generic: knows only a graph structure and a stream of step events. Nothing about the app.
import { ReplayBuffer, realClock, type StepEvent } from "./buffer";
import { drawBands } from "./bands";
import { ItemPanel, Legend } from "./legend";
import { layoutGraph, pathData, type LaidEdge, type LaidNode, type Layout, type Structure } from "./layout";
import { streamRun, type Refusal } from "./sse";
import { loopEdges, resolveStage, roundAt, type Resolved } from "./stages";
import { summarise } from "./state-view";
import { styles } from "./styles";
import { svg } from "./svg";

const START = "__start__";
const END = "__end__";

export interface ReplayChangeDetail {
  cursor: number;
  steps: number;
  finished: boolean;
  atEnd: boolean;
  /** Accumulated state at the step on display. */
  state: Record<string, unknown>;
  /** Accumulated state after the last step, once the stream has finished; otherwise null. */
  finalState: Record<string, unknown> | null;
}

const esc = (s: unknown) =>
  String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] as string));

export class GraphReplay extends HTMLElement {
  static observedAttributes = ["structure-url", "run-url", "interval-ms"];

  private buf = new ReplayBuffer(realClock, () => this.update());
  private layout: Layout | null = null;
  private structure: Structure | null = null;
  private legend: Legend | null = null;
  private itemPanel: ItemPanel | null = null;
  private itemEls = new Map<string, SVGGElement>();
  private loopKeys = new Set<string>();
  private loopPills = new Map<string, SVGGElement>();
  /** The stage picked in the legend: a viewing preference, kept apart from the playback buffer. */
  private selectedStage: string | null = null;
  private abort: AbortController | null = null;
  /** True from pressing Play until the stream ends (or is refused): Play is disabled meanwhile. */
  private running = false;
  private starting = false;
  /** True once the graph has been drawn: Play stays disabled until then. */
  private ready = false;
  private message = "";
  private messageIsError = false;
  private markerCursor = -1;
  private timelineCount = -1;
  private raf = 0;
  private marker!: SVGCircleElement;
  private edgeEls = new Map<string, SVGGElement>();
  private nodeEls = new Map<string, SVGGElement>();
  private actors = new Map<string, "llm" | "code">();
  private stageOf = new Map<string, Resolved>();
  private $ = (sel: string) => this.shadowRoot!.querySelector(sel) as HTMLElement;

  constructor() {
    super();
    this.attachShadow({ mode: "open" });
  }

  connectedCallback() {
    this.shadowRoot!.innerHTML = `
      <style>${styles}</style>
      <div class="wrap" part="wrap" role="group" aria-label="Agent run replay" data-testid="replay">
        <div class="toolbar" role="toolbar" aria-label="Playback controls">
          <button class="primary" data-act="play" data-testid="play" disabled>Play</button>
          <button data-act="pause" data-testid="pause">Pause</button>
          <button data-act="back" data-testid="back" aria-keyshortcuts="ArrowLeft">Back</button>
          <button data-act="step" data-testid="step" aria-keyshortcuts="ArrowRight">Step</button>
          <button data-act="reset" data-testid="reset">Reset</button>
          <label>Speed
            <select data-act="speed" data-testid="speed" aria-label="Playback speed">
              <option value="3000">0.5×</option><option value="1500" selected>1×</option><option value="750">2×</option>
            </select>
          </label>
        </div>
        <div class="status" role="status" aria-live="polite" data-testid="status"></div>
        <div class="main">
          <section class="panel legend" data-testid="legend" aria-labelledby="h-legend" hidden></section>
          <div class="graph"><svg role="img" aria-label="Flowchart of the agent's steps" data-testid="graph"></svg></div>
          <div class="side">
            <section class="panel item-panel" data-testid="item-panel" aria-labelledby="h-item" aria-live="polite" hidden></section>
            <section class="panel" aria-labelledby="h-event"><h3 id="h-event">Event</h3><div id="event" data-testid="event" aria-live="polite"></div></section>
            <section class="panel" aria-labelledby="h-state"><h3 id="h-state">Graph state</h3><div class="state" id="state" data-testid="state"></div></section>
          </div>
        </div>
        <ol class="timeline" aria-label="Path taken" data-testid="timeline"></ol>
      </div>`;
    this.applyInterval();
    this.shadowRoot!.addEventListener("click", this.onClick);
    this.shadowRoot!.addEventListener("change", this.onChange);
    window.addEventListener("keydown", this.onKey);
    void this.loadStructure();
    this.update();
  }

  attributeChangedCallback(name: string) {
    if (name === "interval-ms") this.applyInterval();
  }

  /** Optional starting pace (ms per step); shown as an extra choice in the speed control. */
  private applyInterval() {
    const iv = Number(this.getAttribute("interval-ms"));
    const sel = this.shadowRoot?.querySelector('[data-act="speed"]') as HTMLSelectElement | null;
    if (!(iv > 0) || !sel) return;
    this.buf.setSpeed(iv);
    if (!Array.from(sel.options).some((o) => Number(o.value) === iv)) {
      sel.insertAdjacentHTML("beforeend", `<option value="${iv}">${iv} ms</option>`);
    }
    sel.value = String(iv);
  }

  disconnectedCallback() {
    window.removeEventListener("keydown", this.onKey);
    this.abort?.abort();
    this.buf.reset();
    cancelAnimationFrame(this.raf);
  }

  // ---------------- structure ----------------
  private async loadStructure() {
    const url = this.getAttribute("structure-url");
    if (!url) return;
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(String(res.status));
      this.structure = (await res.json()) as Structure;
      this.layout = layoutGraph(this.structure);
      this.drawGraph();
      this.setupLegend();
      this.ready = true;
      requestAnimationFrame(() => this.measureStartHeight());
      this.update();
    } catch {
      this.setMessage("Could not load the graph structure.", true);
    }
  }

  /** On wide screens the graph is never shorter than the right-hand column was when the page loaded: legend and panels
   *  at their natural heights, measured once before anything runs. (On a phone there is one column, so no minimum.) */
  private measureStartHeight() {
    const main = this.$(".main");
    if (!main || window.matchMedia("(max-width: 760px)").matches) return;
    const legend = this.$(".legend");
    const panels = (Array.from(this.$(".side").children) as HTMLElement[]).filter((el) => !el.hidden);
    const sideHeight = panels.reduce((sum, el) => sum + el.offsetHeight, 0) + 10 * Math.max(0, panels.length - 1);
    const total = legend.hidden ? sideHeight : legend.offsetHeight + (panels.length ? 12 + sideHeight : 0);
    main.style.setProperty("--graph-min", `${total}px`);
  }

  /** Open an item's summary, or close it if it is already open. Never touches playback. */
  private toggleItem(id: string) {
    if (!this.itemPanel) return;
    const item = this.structure?.items?.find((it) => it.id === id);
    if (!item || this.itemPanel.open === id) { this.itemPanel.hide(); return; }
    this.itemPanel.show(item);
  }

  /** A done-beforehand item: dashed and muted, tagged, with its stage badge. A button, but never a step. */
  private drawItem(n: LaidNode, stages: NonNullable<Structure["stages"]>): SVGGElement {
    const id = n.id.replace(/^item:/, "");
    const resolved = resolveStage(n, stages);
    const g = svg("g", {
      class: "item-node", "data-item": id, "data-testid": "item", role: "button", tabindex: 0,
      "aria-label": `${n.label ?? id}, done beforehand. Show what was done.`, transform: `translate(${n.x},${n.y})`,
    });
    if (resolved.state === "assigned") {
      g.setAttribute("data-stage", resolved.stage.id);
      g.setAttribute("style", `--stage-colour: var(${resolved.token})`);
      g.appendChild(svg("rect", { class: "stage-halo", x: -n.w / 2 - 4, y: -n.h / 2 - 4, width: n.w + 8, height: n.h + 8, rx: 11 }));
    }
    g.appendChild(svg("rect", { class: "body", x: -n.w / 2, y: -n.h / 2, width: n.w, height: n.h, rx: 8 }));
    const t = svg("text", { x: 0, y: 2 });
    t.textContent = n.label ?? id;
    g.appendChild(t);
    g.appendChild(svg("rect", { class: "item-tag-bg", x: n.w / 2 - 82, y: -n.h / 2 - 8, width: 86, height: 15, rx: 7 }));
    const tag = svg("text", { class: "item-tag", x: n.w / 2 - 39, y: -n.h / 2 - 0.5 });
    tag.textContent = "done beforehand";
    g.appendChild(tag);
    if (resolved.state !== "none") {
      const assigned = resolved.state === "assigned";
      const badge = svg("g", {
        class: `stage-badge${assigned ? "" : " unassigned"}`, "data-testid": "stage-badge",
        transform: `translate(${-n.w / 2 + 2},${n.h / 2 - 2})`,
        style: `--stage-colour: var(${assigned ? resolved.token : "--gr-stage-none"})`,
      });
      badge.appendChild(svg("circle", { r: 9 }));
      const num = svg("text", {});
      num.textContent = assigned ? String(resolved.number) : "–";
      badge.appendChild(num);
      g.appendChild(badge);
    }
    g.addEventListener("click", () => this.toggleItem(id));
    g.addEventListener("keydown", (ev) => {
      if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); ev.stopPropagation(); this.toggleItem(id); }
    });
    return g;
  }

  private setupLegend() {
    const stages = this.structure?.stages ?? [];
    const panel = this.$(".legend");
    if (!stages.length || !this.layout) { panel.hidden = true; return; }
    const withNodes = new Set(this.layout.nodes.filter((n) => n.kind === "node" && n.stage).map((n) => n.stage as string));
    const unassigned = this.layout.nodes.filter((n) => resolveStage(n, stages).state === "unassigned").map((n) => n.id);
    this.legend = new Legend(panel, {
      stages, notes: this.structure?.notes, withNodes, unassigned,
      onSelect: (id) => { this.selectedStage = id; this.applyFilter(); },
    });
    if (this.selectedStage) this.legend.select(this.selectedStage);
  }

  /** Dim every node and band outside the selected stage, except the active node. A class only: no animation. */
  private applyFilter() {
    const picked = this.selectedStage;
    const graph = this.$(".graph");
    if (picked) graph.setAttribute("data-filter", picked); else graph.removeAttribute("data-filter");
    const mark = (el: Element, stage: string | null, active: boolean) => {
      el.classList.toggle("stage-selected", !!picked && stage === picked);
      el.classList.toggle("dim", !!picked && stage !== picked && !active);
    };
    for (const el of this.nodeEls.values()) mark(el, el.getAttribute("data-stage"), el.classList.contains("active"));
    for (const el of this.itemEls.values()) mark(el, el.getAttribute("data-stage"), false);
    graph.querySelectorAll(".band").forEach((el) => mark(el, el.getAttribute("data-stage"), false));
  }

  private drawGraph() {
    const L = this.layout!;
    const root = this.$("svg") as unknown as SVGSVGElement;
    root.innerHTML = "";
    root.setAttribute("viewBox", `0 0 ${Math.ceil(L.width)} ${Math.ceil(L.height)}`);
    root.style.maxWidth = `${Math.ceil(L.width)}px`;   // never drawn larger than its natural size
    const defs = svg("defs");
    root.appendChild(defs);
    const bandsG = svg("g", { class: "bands" });   // the bottom layer: bands never hide an edge or a node
    const edgesG = svg("g");
    const nodesG = svg("g");
    root.append(bandsG, edgesG, nodesG);
    const stages = this.structure?.stages ?? [];
    drawBands(bandsG, L.bands, stages);
    this.edgeEls.clear();
    this.nodeEls.clear();
    this.actors.clear();
    this.stageOf.clear();
    this.itemEls.clear();
    this.loopKeys.clear();
    this.loopPills.clear();
    this.itemPanel = new ItemPanel(this.$(".item-panel"), () => this.itemPanel?.hide());

    for (const e of L.edges) {
      const g = svg("g", { class: `edge${e.conditional ? " conditional" : ""}${e.item ? " item-edge" : ""}`, "data-edge": `${e.source}->${e.target}` });
      const p = svg("path", { d: pathData(e.points), "marker-end": "url(#arrow)" });
      g.appendChild(p);
      if (e.label && e.branch) {
        const t = svg("text", { x: e.label.x, y: e.label.y + 4, "data-branch": e.branch });
        t.textContent = e.branch;
        g.appendChild(t);
      }
      edgesG.appendChild(g);
      this.edgeEls.set(`${e.source}->${e.target}`, g);
    }
    // The loop between the fit stage and the choose stage: a pill on each of its edges, shown from the second round.
    for (const le of this.structure ? loopEdges(this.structure) : []) {
      const key = `${le.source}->${le.target}`;
      const e = L.edges.find((x) => x.source === le.source && x.target === le.target);
      if (!e) continue;
      const mid = e.label ?? e.points[Math.floor(e.points.length / 2)];
      const at = { x: mid.x + 52, y: mid.y };           // beside the edge, clear of its line, its label and the nodes
      const pill = svg("g", { class: "loop-pill", "data-testid": "loop-round", "data-loop-edge": key, transform: `translate(${at.x},${at.y})`, hidden: "" });
      pill.appendChild(svg("rect", { x: -33, y: -8, width: 66, height: 16, rx: 8 }));
      pill.appendChild(svg("text", {}));
      edgesG.appendChild(pill);
      this.loopKeys.add(key);
      this.loopPills.set(key, pill);
    }
    defs.innerHTML = `<marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="currentColor" style="color:var(--gr-muted)"/></marker>`;

    for (const n of L.nodes) {
      if (n.kind === "item") {
        const ig = this.drawItem(n, stages);
        nodesG.appendChild(ig);
        this.itemEls.set(n.id, ig);
        continue;
      }
      const g = svg("g", { class: `node ${n.kind}${n.actor ? ` actor-${n.actor}` : ""}`, "data-node": n.id, "data-actor": n.actor ?? "", transform: `translate(${n.x},${n.y})` });
      if (n.actor) this.actors.set(n.id, n.actor);
      const resolved = resolveStage(n, stages);
      this.stageOf.set(n.id, resolved);
      if (resolved.state === "assigned") {
        g.setAttribute("data-stage", resolved.stage.id);
        g.setAttribute("style", `--stage-colour: var(${resolved.token})`);
        // drawn only when the node's stage is picked in the legend, so a pick never changes the fill or the border
        g.appendChild(svg("rect", { class: "stage-halo", x: -n.w / 2 - 4, y: -n.h / 2 - 4, width: n.w + 8, height: n.h + 8, rx: 11 }));
      }
      if (resolved.state === "unassigned") g.classList.add("stage-unassigned");
      if (n.kind === "node") {
        g.appendChild(svg("rect", { x: -n.w / 2, y: -n.h / 2, width: n.w, height: n.h, rx: 8 }));
        const t = svg("text", { x: 0, y: 0 });
        t.textContent = n.id;
        g.appendChild(t);
        const tick = svg("text", { class: "tick", x: n.w / 2 - 6, y: -n.h / 2 + 12, hidden: "" });
        tick.textContent = "✓";
        g.appendChild(tick);
        g.appendChild(svg("circle", { class: "count-bg", cx: -n.w / 2 + 2, cy: -n.h / 2 + 2, r: 10, hidden: "" }));
        const c = svg("text", { class: "count", x: -n.w / 2 + 2, y: -n.h / 2 + 3, hidden: "" });
        g.appendChild(c);
        if (resolved.state !== "none") { // the stage's number badge, at the bottom-left corner (the others are taken)
          const assigned = resolved.state === "assigned";
          const badge = svg("g", {
            class: `stage-badge${assigned ? "" : " unassigned"}`, "data-testid": "stage-badge",
            transform: `translate(${-n.w / 2 + 2},${n.h / 2 - 2})`,
            style: `--stage-colour: var(${assigned ? resolved.token : "--gr-stage-none"})`,
          });
          badge.appendChild(svg("circle", { r: 9 }));
          const num = svg("text", {});
          num.textContent = assigned ? String(resolved.number) : "–";
          badge.appendChild(num);
          const tip = svg("title");
          tip.textContent = assigned ? `Stage ${resolved.number}: ${resolved.stage.name}` : "No stage assigned";
          badge.appendChild(tip);
          g.appendChild(badge);
        }
        if (n.actor === "llm") { // a small tag so a language-model step is plain to see, whatever the colours
          g.appendChild(svg("rect", { class: "actor-tag-bg", x: n.w / 2 - 30, y: -n.h / 2 - 8, width: 34, height: 15, rx: 7 }));
          const tag = svg("text", { class: "actor-tag", x: n.w / 2 - 13, y: -n.h / 2 - 0.5 });
          tag.textContent = "LLM";
          g.appendChild(tag);
          const tip = svg("title");
          tip.textContent = "A language model does this step";
          g.appendChild(tip);
        }
      } else {
        g.appendChild(svg("circle", { r: n.w / 2 }));
        const t = svg("title");
        t.textContent = n.kind === "start" ? "Start" : "End";
        g.appendChild(t);
      }
      nodesG.appendChild(g);
      this.nodeEls.set(n.id, g);
    }
    this.marker = svg("circle", { class: "marker", r: 6, hidden: "", "data-testid": "marker" });
    root.appendChild(this.marker);
    this.markerCursor = -2; // force the marker to be placed on the next update
  }

  // ---------------- run control ----------------
  private startRun() {
    const url = this.getAttribute("run-url");
    if (!url) return;
    if (this.running || !this.ready) return; // one run at a time: Play is disabled while a run is in progress
    this.abort = new AbortController();
    const signal = this.abort.signal;
    this.running = true;
    this.starting = true;
    // Whatever is on screen stays until the server accepts the start; a refused start must not disturb it.
    void streamRun(url, signal, {
      onOpen: () => {
        if (signal.aborted) return;
        this.starting = false;
        this.message = "";
        this.messageIsError = false;
        this.markerCursor = -1;
        this.buf.reset();
        this.buf.play();
      },
      onRefused: (info: Refusal) => {
        if (signal.aborted) return;
        this.running = false;
        this.starting = false;
        this.setMessage(info.message, true);
        this.dispatchEvent(new CustomEvent<Refusal>("refused", { detail: info, bubbles: true, composed: true }));
      },
      onStep: (e: StepEvent) => { if (!signal.aborted) this.buf.push(e); },
      onDone: () => { if (signal.aborted) return; this.running = false; this.buf.finish(); },
      onError: (m) => { if (signal.aborted) return; this.running = false; this.setMessage(m, true); this.buf.finish(); },
      onDisconnect: () => {
        if (signal.aborted) return;
        this.running = false;
        this.starting = false;
        this.setMessage("The connection was lost before the run finished. The steps already received are still here to explore.", true);
        this.buf.finish();
      },
    });
    this.update();
  }

  private resetAll() {
    this.abort?.abort();
    this.abort = null;
    this.running = false;
    this.starting = false;
    this.message = "";
    this.messageIsError = false;
    this.markerCursor = -1;
    this.buf.reset();
  }

  private setMessage(m: string, isError = false) {
    this.message = m;
    this.messageIsError = isError;
    this.update();
  }

  // ---------------- events ----------------
  private onClick = (ev: Event) => {
    const target = (ev.target as HTMLElement).closest("button") as HTMLButtonElement | null;
    if (!target || target.disabled) return;
    const idx = target.dataset.index;
    if (idx !== undefined) return this.buf.jump(Number(idx));
    switch (target.dataset.act) {
      case "play": return this.startRun();
      case "pause": return this.buf.playing ? this.buf.pause() : this.buf.play();
      case "back": return this.buf.prev();
      case "step": return this.buf.next();
      case "reset": return this.resetAll();
    }
  };

  private onChange = (ev: Event) => {
    const el = ev.target as HTMLSelectElement;
    if (el.dataset.act === "speed") this.buf.setSpeed(Number(el.value));
  };

  private onKey = (ev: KeyboardEvent) => {
    if (ev.altKey || ev.ctrlKey || ev.metaKey || ev.shiftKey) return;
    if (ev.key !== "ArrowLeft" && ev.key !== "ArrowRight") return;
    const t = ev.target as HTMLElement | null;
    if (t && (t.closest("input, textarea, select") || t.isContentEditable)) return;
    ev.preventDefault();
    if (ev.key === "ArrowRight") this.buf.next(); else this.buf.prev();
  };

  // ---------------- rendering ----------------
  private reducedMotion() {
    return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
  }

  private edgeFor(from: string, to: string): LaidEdge | undefined {
    return this.layout?.edges.find((e) => e.source === from && e.target === to);
  }

  private update() {
    if (!this.shadowRoot?.querySelector(".wrap")) return;
    const b = this.buf;
    const wrap = this.$(".wrap");
    wrap.dataset.reducedMotion = String(this.reducedMotion());

    // buttons
    const hasEvents = b.events.length > 0;
    (this.$('[data-act="play"]') as HTMLButtonElement).disabled = this.running || !this.ready; // no second run while one is going; none before the graph is drawn
    this.setAttribute("data-running", String(this.running));
    (this.$('[data-act="pause"]') as HTMLButtonElement).textContent = b.playing ? "Pause" : "Resume";
    (this.$('[data-act="pause"]') as HTMLButtonElement).disabled = !hasEvents && !b.playing || b.atEnd;
    (this.$('[data-act="back"]') as HTMLButtonElement).disabled = b.cursor < 0;
    (this.$('[data-act="step"]') as HTMLButtonElement).disabled = !hasEvents || b.cursor >= b.events.length - 1;
    // Reset would abandon a run the server is still working on, so it waits for the run to end like Play does
    (this.$('[data-act="reset"]') as HTMLButtonElement).disabled = this.running || (!hasEvents && !b.playing && !this.message);
    const speed = this.$('[data-act="speed"]') as HTMLSelectElement;
    if (Number(speed.value) !== b.intervalMs) speed.value = String(b.intervalMs);

    // status
    const status = this.$(".status");
    status.textContent = this.message ||
      ((b.playing || this.starting) && !hasEvents ? "Starting the run…" :
        !hasEvents ? "Press Play to watch the agent work through the problem." : "");
    status.classList.toggle("error", this.messageIsError);

    this.updateGraph();
    this.updatePanels();
    this.updateTimeline();

    this.dispatchEvent(new CustomEvent<ReplayChangeDetail>("replaychange", {
      detail: {
        cursor: b.cursor, steps: b.events.length, finished: b.finished, atEnd: b.atEnd, state: b.stateAt(),
        finalState: b.finished && b.events.length ? b.stateAt(b.events.length - 1) : null,
      },
      bubbles: true, composed: true,
    }));
  }

  private updateGraph() {
    if (!this.layout) return;
    const b = this.buf;
    const counts = b.visitCounts();
    const active = b.cursor >= 0 ? b.events[b.cursor].node : null;
    const reachedEnd = b.atEnd && !!active && !!this.edgeFor(active, END);

    for (const [id, el] of this.nodeEls) {
      const n = counts.get(id) ?? 0;
      el.classList.toggle("active", id === active);
      el.classList.toggle("visited", n > 0 || (id === START && b.cursor >= 0) || (id === END && reachedEnd));
      const tick = el.querySelector(".tick");
      const bg = el.querySelector(".count-bg");
      const ct = el.querySelector(".count");
      if (tick) (tick as SVGElement).toggleAttribute("hidden", n === 0);
      if (bg && ct) {
        (bg as SVGElement).toggleAttribute("hidden", n < 2);
        (ct as SVGElement).toggleAttribute("hidden", n < 2);
        ct.textContent = n >= 2 ? String(n) : "";
      }
      if (n >= 2) el.setAttribute("data-visits", String(n)); else el.removeAttribute("data-visits");
      if (id === active) el.setAttribute("aria-current", "step"); else el.removeAttribute("aria-current");
    }

    this.applyFilter();
    this.updateLoop();

    const taken = new Set<string>();
    for (let i = 0; i <= b.cursor; i++) taken.add(`${i === 0 ? START : b.events[i - 1].node}->${b.events[i].node}`);
    if (reachedEnd && active) taken.add(`${active}->${END}`);
    for (const [key, el] of this.edgeEls) el.classList.toggle("taken", taken.has(key));

    if (b.cursor !== this.markerCursor) {
      this.moveMarker(active);
      this.markerCursor = b.cursor;
    }
  }

  /** Emphasise the loop edges, with the round number, from the second visit to the fit stage. Recomputed from the replay
   *  position on every update, so Back lowers it and Reset clears it. Static styling: no animation. */
  private updateLoop() {
    const loop = this.structure?.loop;
    const b = this.buf;
    const round = loop ? roundAt(b.events, b.cursor, (node) => {
      const r = this.stageOf.get(node);
      return r?.state === "assigned" ? r.stage.id : null;
    }, loop.fit) : 0;
    const on = round >= 2;
    for (const [key, el] of this.edgeEls) el.classList.toggle("loop", on && this.loopKeys.has(key));
    for (const pill of this.loopPills.values()) {
      pill.toggleAttribute("hidden", !on);
      const text = pill.querySelector("text");
      if (text) text.textContent = on ? `↻ round ${round}` : "";
    }
  }

  private moveMarker(active: string | null) {
    cancelAnimationFrame(this.raf);
    const b = this.buf;
    const m = this.marker;
    if (!m) return;
    if (!active) { m.setAttribute("hidden", ""); return; }
    m.removeAttribute("hidden");
    const node = this.layout!.nodes.find((n) => n.id === active)!;
    const place = (x: number, y: number) => { m.setAttribute("cx", x.toFixed(1)); m.setAttribute("cy", y.toFixed(1)); };

    const from = b.cursor === 0 ? START : b.events[b.cursor - 1]?.node;
    const edge = from ? this.edgeFor(from, active) : undefined;
    const forwardOne = b.cursor === this.markerCursor + 1;
    if (!edge || !forwardOne || this.reducedMotion()) {
      place(node.x, node.y);
      this.$(".wrap").dataset.animating = "false";
      return;
    }
    const path = this.edgeEls.get(`${edge.source}->${edge.target}`)!.querySelector("path")!;
    const total = path.getTotalLength();
    const duration = Math.min(700, b.intervalMs * 0.6);
    const startT = performance.now();
    this.$(".wrap").dataset.animating = "true";
    const frame = (now: number) => {
      const t = Math.min(1, (now - startT) / duration);
      const pt = path.getPointAtLength(total * t);
      place(pt.x, pt.y);
      if (t < 1) this.raf = requestAnimationFrame(frame);
      else { place(node.x, node.y); this.$(".wrap").dataset.animating = "false"; }
    };
    this.raf = requestAnimationFrame(frame);
  }

  private updatePanels() {
    const b = this.buf;
    const ev = this.$("#event");
    if (b.cursor < 0) {
      ev.innerHTML = `<p>Nothing has run yet.</p>`;
      this.$("#state").innerHTML = `<p>The graph's state fills in as each step finishes.</p>`;
      return;
    }
    const e = b.events[b.cursor];
    ev.innerHTML = `<p><span class="node-name" data-testid="event-node">${esc(e.node)}</span> ${this.actors.get(e.node) === "llm" ? '<span class="actor-pill" data-testid="event-actor">language model step</span>' : this.actors.get(e.node) === "code" ? '<span class="actor-pill code" data-testid="event-actor">code step</span>' : ""} <span>· step ${e.step} of ${b.finished ? b.events.length : "…"}</span></p>${this.stageLine(e.node)}<p data-testid="event-summary">${esc(e.summary)}</p>`;
    const state = b.stateAt();
    const changed = new Set(b.changedKeysAt());
    this.$("#state").innerHTML = Object.entries(state).map(([k, v]) => {
      const c = changed.has(k);
      return `<div class="row${c ? " changed" : ""}" data-key="${esc(k)}" data-changed="${c}"><span class="key">${esc(k)}</span>${c ? '<span class="badge">changed in this step</span>' : ""}<pre>${esc(JSON.stringify(summarise(v), null, 2))}</pre></div>`;
    }).join("");
  }

  /** The stage line of the Event panel: badge, name and question, and the app's note for the stage if it gave one. */
  private stageLine(node: string): string {
    const r = this.stageOf.get(node);
    if (!r || r.state === "none") return "";
    if (r.state === "unassigned") return `<p class="stage-line unassigned" data-testid="event-stage">No stage assigned to this step.</p>`;
    const note = this.structure?.notes?.stages?.[r.stage.id];
    return `<p class="stage-line" data-testid="event-stage" data-stage="${esc(r.stage.id)}" style="--stage-colour: var(${r.token})">` +
      `<span class="badge">${r.number}</span> <strong>${esc(r.stage.name)}</strong> <span class="stage-question">${esc(r.stage.question)}</span>` +
      `${note ? ` <span class="stage-line-note">${esc(note)}</span>` : ""}</p>`;
  }

  private updateTimeline() {
    const b = this.buf;
    const ol = this.$(".timeline");
    const reached = b.reached;
    if (this.timelineCount !== reached.length) {
      this.timelineCount = reached.length;
      ol.innerHTML = reached.map((e, i) => {
        const r = this.stageOf.get(e.node);
        // the stage cue is a number drawn by CSS from data-stage-number (so the button's text stays "3. explore")
        const cue = r?.state === "assigned"
          ? ` data-stage="${esc(r.stage.id)}" data-stage-number="${r.number}" style="--stage-colour: var(${r.token})"`
          : r?.state === "unassigned" ? ` data-stage-number="–" style="--stage-colour: var(--gr-stage-none)"` : "";
        const spoken = r?.state === "assigned" ? `, stage ${r.number} ${esc(r.stage.name)}` : r?.state === "unassigned" ? ", no stage assigned" : "";
        return `<li><button data-index="${i}" data-testid="timeline-item"${cue} aria-label="Step ${e.step}: ${esc(e.node)}${spoken}">${e.step}. ${esc(e.node)}</button></li>`;
      }).join("");
    }
    ol.querySelectorAll("button").forEach((btn, i) => {
      if (i === b.cursor) btn.setAttribute("aria-current", "step"); else btn.removeAttribute("aria-current");
      btn.classList.toggle("future", i > b.cursor);
    });
  }
}

if (!customElements.get("graph-replay")) customElements.define("graph-replay", GraphReplay);
