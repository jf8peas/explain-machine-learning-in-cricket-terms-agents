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
  display: grid; grid-template-columns: minmax(0, 1.4fr) minmax(0, 1fr); grid-template-rows: auto 1fr; gap: 12px;
  grid-template-areas: "rows legend" "rows side";
}
.main > .graph { grid-area: rows; } .main > .legend { grid-area: legend; } .main > .side { grid-area: side; }
@media (max-width: 760px) { .main { grid-template-columns: minmax(0, 1fr); grid-template-rows: auto; grid-template-areas: "rows" "side" "legend"; } }
/* the rows: HTML, so they wrap on a phone and need no measuring */
.graph { display: flex; flex-direction: column; gap: 10px; min-width: 0; }
.rows { display: flex; flex-direction: column; gap: 10px; }
.side { display: flex; flex-direction: column; gap: 10px; min-width: 0; }
.panel { border: 1px solid var(--gr-border); border-radius: 8px; padding: 8px 10px; background: var(--gr-surface); }
.panel h3 { margin: 0 0 6px; font-size: 12px; text-transform: uppercase; letter-spacing: .05em; color: var(--gr-muted); }
.panel .node-name { font-weight: 700; }
.state { max-height: 300px; overflow: auto; }
.raw > summary { cursor: pointer; min-height: 32px; padding: 4px 0; color: var(--gr-text); font-weight: 600; text-decoration: underline; }
.row { padding: 4px 6px; border-radius: 6px; border: 1px solid transparent; margin-bottom: 3px; }
.row.changed { background: var(--gr-changed); border-color: var(--gr-changed-border); }
.row .key { font-weight: 600; font-family: ui-monospace, Consolas, monospace; font-size: 12px; }
.row .badge { font-size: 11px; margin-left: 6px; color: var(--gr-changed-border); font-weight: 700; }
.row pre { margin: 2px 0 0; white-space: pre-wrap; word-break: break-word; font: 12px/1.35 ui-monospace, Consolas, monospace; color: var(--gr-muted); }
.row.changed pre { color: var(--gr-text); }
.path { margin: 10px 0 0; }
.path > summary { cursor: pointer; min-height: 32px; padding: 4px 0; color: var(--gr-text); font-weight: 600; text-decoration: underline; }
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
.stage-line-note-box > summary { cursor: pointer; display: inline; color: var(--gr-text); font-size: 12.5px; text-decoration: underline; }
.stage-line.unassigned { color: var(--gr-muted); font-style: italic; }

/* rows and steps; a step's stage colour comes from --stage-colour, set per element */
.row-card { background: var(--gr-surface); border: 1px solid var(--gr-border); border-radius: 8px; padding: 10px 12px; }
.row-head { display: flex; flex-wrap: wrap; align-items: baseline; gap: 4px 10px; margin-bottom: 8px; }
.row-title { margin: 0; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: .06em; color: var(--gr-text); }
.row-note { margin: 0; font-size: 12.5px; color: var(--gr-muted); }
.row-steps { list-style: none; margin: 0; padding: 0; display: flex; flex-wrap: wrap; align-items: center; gap: 8px 6px; }
.step { display: inline-flex; align-items: center; gap: 6px; }
.arrow { color: var(--gr-muted); font-size: 14px; }
.row-loop { margin: 8px 0 0; font-size: 12.5px; color: var(--gr-muted); }
.loop-pill { padding: 0 8px; border-radius: 999px; font-size: 11px; font-weight: 700; background: var(--gr-accent-soft); border: 1px solid var(--gr-accent); color: var(--gr-text); }
.loop-pill[hidden] { display: none; }
.node { display: inline-flex; align-items: center; gap: 6px; min-height: 32px; padding: 3px 10px 3px 4px; border-radius: 999px;
  background: var(--gr-bg); border: 1.6px solid var(--gr-border); color: var(--gr-text); }
.node-name { font-family: ui-monospace, Consolas, monospace; font-size: 12.5px; }
.node.visited { background: var(--gr-visited); border-color: var(--gr-visited-border); }
.node.active { background: var(--gr-accent-soft); border-color: var(--gr-accent); box-shadow: 0 0 0 3px var(--gr-accent); }
.node.actor-llm { background: var(--gr-llm-bg); border: 2.2px dashed var(--gr-llm); }
.node.actor-llm.active { border-style: solid; }
.actor-tag { padding: 0 6px; border-radius: 999px; font-size: 9.5px; font-weight: 700; letter-spacing: .04em; background: var(--gr-llm); color: var(--gr-stage-text); }
.actor-pill { display: inline-block; padding: 0 8px; border-radius: 999px; font-size: .75rem; font-weight: 600; background: var(--gr-llm); color: var(--gr-stage-text); }
.actor-pill.code { background: var(--gr-surface); color: var(--gr-muted); border: 1px solid var(--gr-border); }
.tick { font-size: 10px; font-weight: 700; color: var(--gr-visited-border); }
.tick[hidden] { display: none; }
.stage-badge { display: inline-flex; align-items: center; justify-content: center; width: 22px; height: 22px; border-radius: 50%;
  background: var(--stage-colour); color: var(--gr-stage-text); font-size: 11px; font-weight: 700; flex: none; }
.stage-badge.unassigned { border: 1.5px dashed var(--gr-muted); background: var(--gr-bg); color: var(--gr-muted); }
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
/* a stage's note is closed until its Details button (or Open all) opens it */
.legend-list li { position: relative; }
.legend-list li[data-notes="closed"] .stage-note { display: none; }
.legend-stage.has-note { padding-right: 86px; }
.note-toggle { position: absolute; top: 5px; right: 6px; font-size: 11px; padding: 1px 8px; }
.legend-notes-all { margin: 0 0 6px; font-size: 12px; padding: 3px 10px; }
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
  .legend-stage.has-note { padding-right: 8px; }
  .note-toggle, .legend-notes-all { display: none; }
  .legend-detail { display: block; }
}
/* dimming and highlight, chosen in the legend: classes only, no animation */
.node.dim, .item-node.dim { opacity: .35; }
.node.stage-selected, .item-node.stage-selected { outline: 3px solid var(--stage-colour); outline-offset: 2px; }
/* the done-beforehand item: dashed and muted, never a step */
.item-node { display: inline-flex; align-items: center; gap: 6px; min-height: 32px; padding: 3px 10px 3px 4px; border-radius: 999px; cursor: pointer;
  font: inherit; background: var(--gr-surface); border: 1.6px dashed var(--gr-muted); color: var(--gr-muted); }
.item-node .node-name { font-family: inherit; font-style: italic; }
.item-node:focus-visible { outline: 3px solid var(--gr-accent); outline-offset: 3px; }
.item-tag { padding: 0 6px; border-radius: 999px; font-size: 9px; font-weight: 700; letter-spacing: .03em; background: var(--gr-muted); color: var(--gr-bg); }
.item-panel[hidden] { display: none; }
.item-panel h3 { text-transform: none; letter-spacing: 0; font-size: 14px; color: var(--gr-text); }
.item-tag-inline { font-size: 11px; font-weight: 600; padding: 0 6px; border-radius: 999px; background: var(--gr-muted); color: var(--gr-bg); }
.item-rows { display: grid; grid-template-columns: 1fr auto; gap: 2px 12px; margin: 6px 0; }
.item-rows dt { color: var(--gr-muted); } .item-rows dd { margin: 0; font-weight: 600; text-align: right; }
.item-panel a { color: var(--gr-accent); margin-right: 12px; }
/* a page can show just the rows and the legend (no run controls) */
:host([view="structure"]) .toolbar, :host([view="structure"]) .status, :host([view="structure"]) .path,
:host([view="structure"]) .side { display: none; }
:host([view="structure"]) .wrap { border: 0; padding: 0; background: none; }
:host([view="structure"]) .legend-note { display: none; }
/* on a phone every control is at least 44 px tall (last, so it wins against the sizes above) */
@media (max-width: 760px) {
  button, select, .timeline button, .legend-stage, .item-node, .raw > summary, .path > summary, .stage-line-note-box > summary { min-height: 44px; }
  .legend-stage { align-items: center; }
  summary { display: flex; align-items: center; }
  .stage-line-note-box > summary { display: inline-flex; }
}
.sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
`;
