export const styles = /* css */ `
:host {
  --gr-bg: #ffffff; --gr-surface: #f6f7f9; --gr-border: #d5d9e0; --gr-text: #1b2230;
  --gr-muted: #5b6678; --gr-accent: #1d6fe0; --gr-accent-soft: #dbe8fb; --gr-visited: #e4f3ea;
  --gr-visited-border: #3f8f5f; --gr-changed: #fff1bf; --gr-changed-border: #c58f00;
  --gr-error: #b3261e;
  display: block; color: var(--gr-text); font: 14px/1.45 system-ui, -apple-system, "Segoe UI", sans-serif;
}
@media (prefers-color-scheme: dark) {
  :host:not([data-theme="light"]) {
    --gr-bg: #12161d; --gr-surface: #1b212b; --gr-border: #333c4a; --gr-text: #e6eaf0;
    --gr-muted: #98a3b5; --gr-accent: #6ea8ff; --gr-accent-soft: #1f3555; --gr-visited: #1b3326;
    --gr-visited-border: #5fbf86; --gr-changed: #4a3d10; --gr-changed-border: #e0b030; --gr-error: #ff8a80;
  }
}
:host([data-theme="dark"]) {
  --gr-bg: #12161d; --gr-surface: #1b212b; --gr-border: #333c4a; --gr-text: #e6eaf0;
  --gr-muted: #98a3b5; --gr-accent: #6ea8ff; --gr-accent-soft: #1f3555; --gr-visited: #1b3326;
  --gr-visited-border: #5fbf86; --gr-changed: #4a3d10; --gr-changed-border: #e0b030; --gr-error: #ff8a80;
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
.main { display: grid; grid-template-columns: minmax(0, 1.2fr) minmax(0, 1fr); gap: 12px; }
@media (max-width: 760px) { .main { grid-template-columns: 1fr; } }
.graph { background: var(--gr-surface); border: 1px solid var(--gr-border); border-radius: 8px; padding: 6px; overflow: auto; }
svg { display: block; width: 100%; height: auto; max-height: 640px; }
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

/* graph */
.edge path { fill: none; stroke: var(--gr-muted); stroke-width: 1.6; }
.edge.conditional path { stroke-dasharray: 6 4; }
.edge.taken path { stroke: var(--gr-accent); stroke-width: 2.6; }
.edge text { fill: var(--gr-muted); font-size: 11px; text-anchor: middle; paint-order: stroke; stroke: var(--gr-surface); stroke-width: 4px; }
.edge.taken text { fill: var(--gr-accent); font-weight: 700; }
.node rect, .node circle { fill: var(--gr-bg); stroke: var(--gr-border); stroke-width: 1.6; }
.node text { fill: var(--gr-text); font-size: 12.5px; text-anchor: middle; dominant-baseline: central; }
.node.visited rect, .node.visited circle { fill: var(--gr-visited); stroke: var(--gr-visited-border); }
.node.active rect, .node.active circle { fill: var(--gr-accent-soft); stroke: var(--gr-accent); stroke-width: 3.2; }
.node .tick { font-size: 11px; fill: var(--gr-visited-border); text-anchor: end; }
.node .count { font-size: 11px; font-weight: 700; fill: var(--gr-bg); text-anchor: middle; }
.node .count-bg { fill: var(--gr-accent); stroke: none; }
.marker { fill: var(--gr-accent); stroke: var(--gr-bg); stroke-width: 2; }
svg [hidden] { display: none; }
.sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
`;
