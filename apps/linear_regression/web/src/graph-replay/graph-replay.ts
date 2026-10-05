// <graph-replay structure-url="..." run-url="...">
// Generic: knows only a graph structure and a stream of step events. Nothing about the app.
import { ReplayBuffer, realClock, type StepEvent } from "./buffer";
import { layoutGraph, pathData, type LaidEdge, type Layout } from "./layout";
import { streamRun, type Refusal } from "./sse";
import { styles } from "./styles";

const SVG_NS = "http://www.w3.org/2000/svg";
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

function svg<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number> = {}) {
  const el = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v));
  return el;
}

export class GraphReplay extends HTMLElement {
  static observedAttributes = ["structure-url", "run-url", "interval-ms"];

  private buf = new ReplayBuffer(realClock, () => this.update());
  private layout: Layout | null = null;
  private abort: AbortController | null = null;
  /** True from pressing Play until the stream ends (or is refused): Play is disabled meanwhile. */
  private running = false;
  private starting = false;
  private message = "";
  private messageIsError = false;
  private markerCursor = -1;
  private timelineCount = -1;
  private raf = 0;
  private marker!: SVGCircleElement;
  private edgeEls = new Map<string, SVGGElement>();
  private nodeEls = new Map<string, SVGGElement>();
  private actors = new Map<string, "llm" | "code">();
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
          <button class="primary" data-act="play" data-testid="play">Play</button>
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
          <div class="graph"><svg role="img" aria-label="Flowchart of the agent's steps" data-testid="graph"></svg></div>
          <div class="side">
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
      this.layout = layoutGraph(await res.json());
      this.drawGraph();
      this.update();
    } catch {
      this.setMessage("Could not load the graph structure.", true);
    }
  }

  private drawGraph() {
    const L = this.layout!;
    const root = this.$("svg") as unknown as SVGSVGElement;
    root.innerHTML = "";
    root.setAttribute("viewBox", `0 0 ${Math.ceil(L.width)} ${Math.ceil(L.height)}`);
    const defs = svg("defs");
    root.appendChild(defs);
    const edgesG = svg("g");
    const nodesG = svg("g");
    root.append(edgesG, nodesG);
    this.edgeEls.clear();
    this.nodeEls.clear();
    this.actors.clear();

    for (const e of L.edges) {
      const g = svg("g", { class: `edge${e.conditional ? " conditional" : ""}`, "data-edge": `${e.source}->${e.target}` });
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
    defs.innerHTML = `<marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="currentColor" style="color:var(--gr-muted)"/></marker>`;

    for (const n of L.nodes) {
      const g = svg("g", { class: `node ${n.kind}${n.actor ? ` actor-${n.actor}` : ""}`, "data-node": n.id, "data-actor": n.actor ?? "", transform: `translate(${n.x},${n.y})` });
      if (n.actor) this.actors.set(n.id, n.actor);
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
    if (this.running) return; // one run at a time: Play is disabled while a run is in progress
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
    (this.$('[data-act="play"]') as HTMLButtonElement).disabled = this.running; // no second run while one is going
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

    const taken = new Set<string>();
    for (let i = 0; i <= b.cursor; i++) taken.add(`${i === 0 ? START : b.events[i - 1].node}->${b.events[i].node}`);
    if (reachedEnd && active) taken.add(`${active}->${END}`);
    for (const [key, el] of this.edgeEls) el.classList.toggle("taken", taken.has(key));

    if (b.cursor !== this.markerCursor) {
      this.moveMarker(active);
      this.markerCursor = b.cursor;
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
    ev.innerHTML = `<p><span class="node-name" data-testid="event-node">${esc(e.node)}</span> ${this.actors.get(e.node) === "llm" ? '<span class="actor-pill" data-testid="event-actor">language model step</span>' : this.actors.get(e.node) === "code" ? '<span class="actor-pill code" data-testid="event-actor">code step</span>' : ""} <span>· step ${e.step} of ${b.finished ? b.events.length : "…"}</span></p><p data-testid="event-summary">${esc(e.summary)}</p>`;
    const state = b.stateAt();
    const changed = new Set(b.changedKeysAt());
    this.$("#state").innerHTML = Object.entries(state).map(([k, v]) => {
      const c = changed.has(k);
      return `<div class="row${c ? " changed" : ""}" data-key="${esc(k)}" data-changed="${c}"><span class="key">${esc(k)}</span>${c ? '<span class="badge">changed in this step</span>' : ""}<pre>${esc(JSON.stringify(v, null, 2))}</pre></div>`;
    }).join("");
  }

  private updateTimeline() {
    const b = this.buf;
    const ol = this.$(".timeline");
    const reached = b.reached;
    if (this.timelineCount !== reached.length) {
      this.timelineCount = reached.length;
      ol.innerHTML = reached.map((e, i) =>
        `<li><button data-index="${i}" data-testid="timeline-item" aria-label="Step ${e.step}: ${esc(e.node)}">${e.step}. ${esc(e.node)}</button></li>`).join("");
    }
    ol.querySelectorAll("button").forEach((btn, i) => {
      if (i === b.cursor) btn.setAttribute("aria-current", "step"); else btn.removeAttribute("aria-current");
      btn.classList.toggle("future", i > b.cursor);
    });
  }
}

if (!customElements.get("graph-replay")) customElements.define("graph-replay", GraphReplay);
