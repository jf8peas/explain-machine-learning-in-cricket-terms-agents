export const styles = /* css */ `
:host {
  --gr-bg: #ffffff; --gr-surface: #f6f7f9; --gr-border: #d5d9e0; --gr-text: #1b2230;
  --gr-muted: #5b6678; --gr-accent: #1d6fe0; --gr-accent-soft: #dbe8fb; --gr-visited: #e4f3ea;
  --gr-visited-border: #3f8f5f; --gr-changed: #fff1bf; --gr-changed-border: #c58f00;
  --gr-error: #b3261e; --gr-llm: #7a3fc0; --gr-llm-bg: #f1e8fb;
  /* the eight stage colours, keyed by stage number; values and checks: specs/005-ml-stages/research.md */
  --gr-stage-1: #8a5a00;   --gr-stage-2: #5f7a00;   --gr-stage-3: #00798a;   --gr-stage-4: #8a4f7d;
  --gr-stage-5: #bb5400;   --gr-stage-6: #a3246b;   --gr-stage-7: #00695c;   --gr-stage-8: #7a5c46;
  --gr-stage-text: #ffffff; --gr-stage-none: #5b6678;
  display: block; color: var(--gr-text); font: 14px/1.45 system-ui, -apple-system, "Segoe UI", sans-serif;
}
@media (prefers-color-scheme: dark) {
  :host(:not([data-theme="light"])) {
    --gr-bg: #12161d; --gr-surface: #1b212b; --gr-border: #333c4a; --gr-text: #e6eaf0;
    --gr-muted: #98a3b5; --gr-accent: #6ea8ff; --gr-accent-soft: #1f3555; --gr-visited: #1b3326;
    --gr-visited-border: #5fbf86; --gr-changed: #4a3d10; --gr-changed-border: #e0b030; --gr-error: #ff8a80;
    --gr-llm: #b794f4; --gr-llm-bg: #2a1f3d;
    --gr-stage-1: #b8863f;     --gr-stage-2: #b5cf4a;     --gr-stage-3: #4fd0e0;     --gr-stage-4: #cf9bc2;
    --gr-stage-5: #ff9a3c;     --gr-stage-6: #f06ab0;     --gr-stage-7: #3fd0c8;     --gr-stage-8: #d8b59a;
    --gr-stage-text: #12161d; --gr-stage-none: #98a3b5;
  }
}
:host([data-theme="dark"]) {
  --gr-bg: #12161d; --gr-surface: #1b212b; --gr-border: #333c4a; --gr-text: #e6eaf0;
  --gr-muted: #98a3b5; --gr-accent: #6ea8ff; --gr-accent-soft: #1f3555; --gr-visited: #1b3326;
  --gr-visited-border: #5fbf86; --gr-changed: #4a3d10; --gr-changed-border: #e0b030; --gr-error: #ff8a80; --gr-llm: #b794f4; --gr-llm-bg: #2a1f3d;
  --gr-stage-1: #b8863f;   --gr-stage-2: #b5cf4a;   --gr-stage-3: #4fd0e0;   --gr-stage-4: #cf9bc2;
  --gr-stage-5: #ff9a3c;   --gr-stage-6: #f06ab0;   --gr-stage-7: #3fd0c8;   --gr-stage-8: #d8b59a;
  --gr-stage-text: #12161d; --gr-stage-none: #98a3b5;
}
* { box-sizing: border-box; }
.wrap { background: var(--gr-bg); border: 1px solid var(--gr-border); border-radius: 10px; padding: 12px; }
.wrap:focus-visible, button:focus-visible, select:focus-visible, .timeline button:focus-visible {
  outline: 3px solid var(--gr-accent); outline-offset: 2px;
}
.toolbar { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; margin-bottom: 8px; }
button, select {
  font: inherit; color: var(--gr-text); background: var(--gr-surface); border: 1px solid var(--gr-border);
  border-radius: 6px; padding: 6px 12px; cursor: pointer;
}
button.primary { background: var(--gr-accent); color: #fff; border-color: var(--gr-accent); }
button:disabled { opacity: 0.5; cursor: default; }
label { color: var(--gr-muted); display: inline-flex; gap: 6px; align-items: center; }
.status { min-height: 1.4em; color: var(--gr-muted); margin-bottom: 6px; }
.status.error { color: var(--gr-error); font-weight: 600; }
.main {
  display: grid; grid-template-columns: minmax(0, 1.2fr) minmax(0, 1fr); grid-template-rows: auto 1fr; gap: 12px;
  grid-template-areas: "graph legend" "graph side";
}
.main > .graph { grid-area: graph; } .main > .legend { grid-area: legend; } .main > .side { grid-area: side; }
@media (max-width: 760px) { .main { grid-template-columns: minmax(0, 1fr); grid-template-rows: auto; grid-template-areas: "legend" "graph" "side"; } }
/* The graph is shown at its natural size at most (the SVG's max-width is set from the layout), so its text stays
   readable, and the card is never shorter than the right-hand column was when the page loaded (--graph-min). */
.graph { background: var(--gr-surface); border: 1px solid var(--gr-border); border-radius: 8px; padding: 6px; overflow: auto; min-height: var(--graph-min, 0); }
svg { display: block; width: 100%; height: auto; margin: 0 auto; }
.side { display: flex; flex-direction: column; gap: 10px; min-width: 0; }
.panel { border: 1px solid var(--gr-border); border-radius: 8px; padding: 8px 10px; background: var(--gr-surface); }
.panel h3 { margin: 0 0 6px; font-size: 12px; text-transform: uppercase; letter-spacing: .05em; color: var(--gr-muted); }
.panel .node-name { font-weight: 700; }
.state { max-height: 300px; overflow: auto; }
.row { padding: 4px 6px; border-radius: 6px; border: 1px solid transparent; margin-bottom: 3px; }
.row.changed { background: var(--gr-changed); border-color: var(--gr-changed-border); }
.row .key { font-weight: 600; font-family: ui-monospace, Consolas, monospace; font-size: 12px; }
.row .badge { font-size: 11px; margin-left: 6px; color: var(--gr-changed-border); font-weight: 700; }
.row pre { margin: 2px 0 0; white-space: pre-wrap; word-break: break-word; font: 12px/1.35 ui-monospace, Consolas, monospace; color: var(--gr-muted); }
.row.changed pre { color: var(--gr-text); }
.timeline { list-style: none; display: flex; flex-wrap: wrap; gap: 6px; padding: 0; margin: 10px 0 0; }
.timeline button { padding: 3px 9px; font-size: 12px; border-radius: 999px; }
.timeline button[aria-current="step"] { background: var(--gr-accent); color: #fff; border-color: var(--gr-accent); font-weight: 700; }
.timeline button.future { opacity: .55; }
.timeline button[data-stage-number]::before {
  content: attr(data-stage-number); display: inline-flex; align-items: center; justify-content: center; width: 16px; height: 16px;
  margin-right: 6px; border-radius: 50%; background: var(--stage-colour); color: var(--gr-stage-text); font-size: 10px; font-weight: 700;
}
.stage-line { margin: 4px 0 8px; }
.stage-line .badge { display: inline-flex; align-items: center; justify-content: center; width: 18px; height: 18px; border-radius: 50%;
  background: var(--stage-colour); color: var(--gr-stage-text); font-size: 11px; font-weight: 700; vertical-align: middle; }
.stage-line .stage-question { color: var(--gr-muted); }
.stage-line .stage-line-note { display: block; margin-top: 2px; font-size: 12.5px; }
.stage-line.unassigned { color: var(--gr-muted); font-style: italic; }

/* graph */
.edge path { fill: none; stroke: var(--gr-muted); stroke-width: 1.6; }
.edge.conditional path { stroke-dasharray: 6 4; }
.edge.taken path { stroke: var(--gr-accent); stroke-width: 2.6; }
.edge text { fill: var(--gr-muted); font-size: 11px; text-anchor: middle; paint-order: stroke; stroke: var(--gr-surface); stroke-width: 4px; }
.edge.taken text { fill: var(--gr-accent); font-weight: 700; }
/* the fit and choose loop, from the second round: heavier edges and a round pill (static, no animation) */
.edge.loop path { stroke-width: 4.4; }
.loop-pill rect { fill: var(--gr-accent-soft); stroke: var(--gr-accent); stroke-width: 1.5; }
.loop-pill text { fill: var(--gr-text); font-size: 11px; font-weight: 700; text-anchor: middle; dominant-baseline: central; }
.node rect, .node circle { fill: var(--gr-bg); stroke: var(--gr-border); stroke-width: 1.6; }
.node text { fill: var(--gr-text); font-size: 12.5px; text-anchor: middle; dominant-baseline: central; }
.node.visited rect, .node.visited circle { fill: var(--gr-visited); stroke: var(--gr-visited-border); }
.node.active rect, .node.active circle { fill: var(--gr-accent-soft); stroke: var(--gr-accent); stroke-width: 3.2; }
.node.actor-llm rect { fill: var(--gr-llm-bg); stroke: var(--gr-llm); stroke-width: 2.2; stroke-dasharray: 5 3; }
.node.actor-llm.visited rect { fill: var(--gr-llm-bg); stroke: var(--gr-llm); }
.node.actor-llm.active rect { stroke-dasharray: none; stroke-width: 3.4; }
.node .actor-tag-bg { fill: var(--gr-llm); stroke: none; }
.node .actor-tag { fill: #fff; font-size: 9.5px; font-weight: 700; text-anchor: middle; dominant-baseline: central; letter-spacing: .04em; }
.actor-pill { display: inline-block; padding: 0 8px; border-radius: 999px; font-size: .75rem; font-weight: 600; background: var(--gr-llm); color: #fff; }
.actor-pill.code { background: var(--gr-surface); color: var(--gr-muted); border: 1px solid var(--gr-border); }
.node .tick { font-size: 11px; fill: var(--gr-visited-border); text-anchor: end; }
.node .count { font-size: 11px; font-weight: 700; fill: var(--gr-bg); text-anchor: middle; }
/* more specific than the visited and active rules, which also match every circle in a node */
.node .count-bg, .node.visited .count-bg, .node.active .count-bg { fill: var(--gr-accent); stroke: none; }
/* stage badge (on each node) and band (behind the graph); the colour comes from --stage-colour set per element */
/* more specific than the node's run-state rules (visited, active), so a badge keeps its stage colour whatever the run state */
.node .stage-badge circle, .item-node .stage-badge circle,
.node.visited .stage-badge circle, .node.active .stage-badge circle { fill: var(--stage-colour); stroke: var(--gr-bg); stroke-width: 1.5; stroke-dasharray: none; }
.node .stage-badge text, .item-node .stage-badge text { fill: var(--gr-stage-text); font-size: 10.5px; font-weight: 700; text-anchor: middle; dominant-baseline: central; pointer-events: none; }
.node .stage-badge.unassigned circle, .node.visited .stage-badge.unassigned circle, .node.active .stage-badge.unassigned circle { stroke: var(--gr-muted); stroke-dasharray: 2 2; }
.band rect { fill: var(--stage-colour); fill-opacity: .09; stroke: var(--stage-colour); stroke-width: 1.5; }
.band-badge { fill: var(--stage-colour); }
.band-number { fill: var(--gr-stage-text); font-size: 10px; font-weight: 700; text-anchor: middle; dominant-baseline: central; }
.band-name { fill: var(--gr-text); font-size: 11.5px; font-weight: 600; dominant-baseline: central;
  paint-order: stroke; stroke: var(--gr-surface); stroke-width: 4px; stroke-linejoin: round; }
/* legend */
.legend[hidden] { display: none; }
.legend h3 { margin: 0 0 6px; font-size: 12px; text-transform: uppercase; letter-spacing: .05em; color: var(--gr-muted); }
.legend-list { list-style: none; margin: 0 0 8px; padding: 0; display: flex; flex-direction: column; gap: 4px; }
.legend-stage { display: grid; grid-template-columns: 22px 1fr; column-gap: 8px; width: 100%; text-align: left; padding: 5px 8px; }
.legend-stage .badge { grid-row: 1 / span 4; align-self: start; display: inline-flex; align-items: center; justify-content: center; width: 20px; height: 20px;
  border-radius: 50%; background: var(--stage-colour); color: var(--gr-stage-text); font-size: 11px; font-weight: 700; }
.legend-stage .name { font-weight: 600; }
.legend-stage .question { color: var(--gr-muted); font-size: 12.5px; }
.legend-stage .no-node { font-size: 12px; font-weight: 600; color: var(--gr-muted); }
.legend-stage .stage-note { font-size: 12px; color: var(--gr-text); margin-top: 2px; }
.legend-stage[aria-pressed="true"] { background: var(--gr-accent-soft); border-color: var(--stage-colour); box-shadow: inset 0 0 0 2px var(--stage-colour); }
.legend-all { margin-bottom: 6px; }
.legend-unassigned { margin: 0 0 8px; padding: 4px 8px; border: 1px dashed var(--gr-muted); border-radius: 6px; font-size: 12.5px; color: var(--gr-muted); }
.legend-detail { display: none; margin: 6px 0; }
.legend-note { margin: 8px 0 0; font-size: 13px; color: var(--gr-muted); }
@media (max-width: 760px) {
  .legend-list { flex-direction: row; flex-wrap: wrap; gap: 6px; }
  .legend-stage { display: inline-flex; width: auto; padding: 4px 8px; }
  .legend-stage .name, .legend-stage .question, .legend-stage .no-node, .legend-stage .stage-note { display: none; }
  .legend-stage .badge { grid-row: auto; }
  .legend-detail { display: block; }
}
/* dimming and highlight, chosen in the legend: classes only, no animation */
.node.dim, .item-node.dim { opacity: .35; }
.band.dim { opacity: .3; }
.node .stage-halo, .item-node .stage-halo { fill: none; stroke: var(--stage-colour); stroke-width: 3.5; visibility: hidden; }
.node.stage-selected .stage-halo, .item-node.stage-selected .stage-halo { visibility: visible; }
/* the done-beforehand item: dashed and muted, never a step */
.item-node { cursor: pointer; }
.item-node:focus-visible { outline: 3px solid var(--gr-accent); outline-offset: 3px; }
.item-node .body { fill: var(--gr-surface); stroke: var(--gr-muted); stroke-width: 1.6; stroke-dasharray: 3 4; }
.item-node text { fill: var(--gr-muted); font-size: 12px; font-style: italic; text-anchor: middle; dominant-baseline: central; }
.item-node .item-tag-bg { fill: var(--gr-muted); stroke: none; }
.item-node .item-tag { fill: var(--gr-bg); font-size: 9px; font-style: normal; font-weight: 700; letter-spacing: .03em; }
.edge.item-edge path { stroke-dasharray: 2 5; stroke: var(--gr-muted); }
.item-panel[hidden] { display: none; }
.item-panel h3 { text-transform: none; letter-spacing: 0; font-size: 14px; color: var(--gr-text); }
.item-tag-inline { font-size: 11px; font-weight: 600; padding: 0 6px; border-radius: 999px; background: var(--gr-muted); color: var(--gr-bg); }
.item-rows { display: grid; grid-template-columns: 1fr auto; gap: 2px 12px; margin: 6px 0; }
.item-rows dt { color: var(--gr-muted); } .item-rows dd { margin: 0; font-weight: 600; text-align: right; }
.item-panel a { color: var(--gr-accent); margin-right: 12px; }
.band.stage-selected rect { fill-opacity: .2; stroke-width: 2.6; }
.marker { fill: var(--gr-accent); stroke: var(--gr-bg); stroke-width: 2; }
svg [hidden] { display: none; }
.sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
`;
