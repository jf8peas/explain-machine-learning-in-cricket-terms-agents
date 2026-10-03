// Spreadsheet look for <data-grid>. Light DOM (the grid library needs document-level styles), so every
// rule is scoped under .dg-root. Colours come from --dg-* variables, defaulting to the page's own
// --bg, --surface, --border, --text, --muted and --accent, so light and dark follow the page.
export const styles = /* css */ `
.dg-root {
  --_bg: var(--dg-bg, var(--bg, #ffffff)); --_surface: var(--dg-surface, var(--surface, #f6f7f9));
  --_border: var(--dg-border, var(--border, #d5d9e0)); --_text: var(--dg-text, var(--text, #1b2230));
  --_muted: var(--dg-muted, var(--muted, #5b6678)); --_accent: var(--dg-accent, var(--accent, #1d6fe0));
  --_grid: var(--dg-gridline, var(--_border));
  display: block; max-width: 100%; color: var(--_text); font: 14px/1.45 system-ui, -apple-system, "Segoe UI", sans-serif;
}
.dg-root * { box-sizing: border-box; }
.dg-root :focus-visible { outline: 3px solid var(--_accent); outline-offset: 2px; }
.dg-root [hidden] { display: none !important; }
.dg-root .dg-state { padding: 24px 16px; border: 1px dashed var(--_border); border-radius: 8px; color: var(--_muted); }
.dg-root .dg-state.error { color: var(--dg-error, var(--lose, #b3261e)); border-style: solid; }
.dg-root .dg-state p { margin: 0 0 8px; }
.dg-root button { font: inherit; cursor: pointer; padding: 6px 12px; border-radius: 6px; border: 1px solid var(--_border); background: var(--_surface); color: var(--_text); }
.dg-root button.primary { border-color: var(--_accent); background: var(--_accent); color: #fff; }
.dg-root button:disabled { opacity: .5; cursor: default; }

.dg-root .dg-summary { background: var(--_surface); border: 1px solid var(--_border); border-radius: 10px; padding: 12px 16px; margin-bottom: 12px; }
.dg-root .dg-headline { display: flex; flex-wrap: wrap; gap: 4px 28px; margin: 0 0 8px; }
.dg-root .dg-headline div { display: flex; flex-direction: column; }
.dg-root .dg-headline dt { color: var(--_muted); font-size: .8rem; }
.dg-root .dg-headline dd { margin: 0; font-weight: 600; font-variant-numeric: tabular-nums; }
.dg-root .dg-sections { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 8px 24px; }
.dg-root .dg-sections h3 { margin: 0 0 4px; font-size: .9rem; }
.dg-root .dg-note { margin: 0 0 6px; color: var(--_muted); font-size: .8rem; max-width: 60ch; }
.dg-root .dg-sections ul { list-style: none; margin: 0; padding: 0; font-size: .9rem; }
.dg-root .dg-sections li { display: flex; justify-content: space-between; gap: 12px; border-bottom: 1px solid var(--_border); padding: 2px 0; }
.dg-root .dg-sections li span:last-child { font-variant-numeric: tabular-nums; }

.dg-root .dg-guide { margin-bottom: 12px; font-size: .9rem; }
.dg-root .dg-guide summary { cursor: pointer; color: var(--_accent); }
.dg-root .dg-guide dl { display: grid; grid-template-columns: max-content 1fr; gap: 2px 16px; margin: 8px 0 0; }
.dg-root .dg-guide dt { font-weight: 600; }
.dg-root .dg-guide dd { margin: 0; color: var(--_muted); }
@media (max-width: 600px) { .dg-root .dg-guide dl { grid-template-columns: 1fr; } .dg-root .dg-guide dd { margin-bottom: 6px; } }

.dg-root .dg-toolbar { display: flex; flex-wrap: wrap; gap: 8px 12px; align-items: flex-end; margin-bottom: 8px; }
.dg-root .dg-toolbar label { display: flex; flex-direction: column; gap: 2px; font-size: .8rem; color: var(--_muted); }
.dg-root .dg-toolbar input, .dg-root .dg-toolbar select {
  font: inherit; color: var(--_text); background: var(--_bg); border: 1px solid var(--_border); border-radius: 6px; padding: 5px 8px; max-width: 100%;
}
.dg-root .dg-toolbar input[type=search] { width: 15em; }
.dg-root .dg-count { margin: 0 0 0 auto; align-self: center; font-weight: 600; font-variant-numeric: tabular-nums; }
.dg-root .dg-download { position: relative; display: flex; flex-wrap: wrap; align-items: center; gap: 8px 12px; margin-bottom: 8px; }
.dg-root .dg-menu { position: absolute; top: 100%; left: 0; z-index: 20; margin-top: 4px; min-width: 14em; display: flex; flex-direction: column;
  background: var(--_bg); border: 1px solid var(--_border); border-radius: 8px; padding: 4px; box-shadow: 0 6px 20px rgba(0,0,0,.18); }
.dg-root .dg-menu button { text-align: left; border: 0; background: transparent; }
.dg-root .dg-menu button:hover:not(:disabled), .dg-root .dg-menu button:focus-visible { background: var(--_surface); }
.dg-root .dg-attribution { color: var(--_muted); font-size: .8rem; margin: 0; max-width: 60ch; }
.dg-root a { color: var(--_accent); }

.dg-root .dg-gridwrap { position: relative; max-width: 100%; }
.dg-root .dg-grid { height: clamp(320px, 65vh, 640px); max-width: 100%; }
.dg-root .dg-empty { padding: 28px 16px; text-align: center; border: 1px solid var(--_grid); border-radius: 4px; background: var(--_bg); }
.dg-root .dg-help { min-height: 1.4em; margin: 6px 0 0; font-size: .85rem; color: var(--_muted); }

/* Spreadsheet look on top of the library's structural classes */
.dg-root .tabulator { background: var(--_bg); border: 1px solid var(--_grid); border-radius: 4px; color: var(--_text); font-size: 13px; max-width: 100%; }
.dg-root .tabulator .tabulator-header { background: var(--_surface); border-bottom: 1px solid var(--_grid); color: var(--_text); }
.dg-root .tabulator .tabulator-header .tabulator-col { background: var(--_surface); border-right: 1px solid var(--_grid); }
.dg-root .tabulator .tabulator-header .tabulator-col:focus-visible { outline: 2px solid var(--_accent); outline-offset: -2px; }
.dg-root .tabulator .tabulator-header .tabulator-col .tabulator-col-content { padding: 4px 8px; cursor: pointer; }
.dg-root .tabulator .tabulator-header .tabulator-col .tabulator-col-title { font-weight: 600; white-space: nowrap; }
.dg-root .tabulator .tabulator-header .tabulator-col[aria-sort=ascending] .tabulator-col-title::after { content: " \\25B2"; font-size: 10px; color: var(--_accent); }
.dg-root .tabulator .tabulator-header .tabulator-col[aria-sort=descending] .tabulator-col-title::after { content: " \\25BC"; font-size: 10px; color: var(--_accent); }
.dg-root .tabulator .tabulator-header .tabulator-col.tabulator-row-header { cursor: default; }
.dg-root .tabulator .tabulator-tableholder .tabulator-table { background: var(--_bg); color: var(--_text); }
.dg-root .tabulator .tabulator-row { background: var(--_bg); min-height: 24px; border-bottom: 1px solid var(--_grid); color: var(--_text); }
.dg-root .tabulator .tabulator-row.tabulator-row-even { background: var(--_bg); }
.dg-root .tabulator .tabulator-row .tabulator-cell { padding: 3px 8px; height: 24px; border-right: 1px solid var(--_grid); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; user-select: none; }
.dg-root .tabulator .tabulator-row .tabulator-cell.tabulator-row-header,
.dg-root .tabulator .tabulator-row .tabulator-cell.dg-rownum { background: var(--_surface); color: var(--_muted); font-size: 12px; text-align: center; border-right: 1px solid var(--_grid); }
.dg-root .tabulator .tabulator-row:hover { background: var(--_bg); }
.dg-root .tabulator .tabulator-row .tabulator-cell.tabulator-frozen { background: var(--_surface); }
.dg-root .tabulator .tabulator-range-overlay .tabulator-range { border: 1px solid var(--_accent); background: color-mix(in srgb, var(--_accent) 14%, transparent); }
.dg-root .tabulator .tabulator-range-overlay .tabulator-range.tabulator-range-active::after { background: var(--_accent); }
.dg-root .tabulator .tabulator-cell.tabulator-range-cell-active { box-shadow: inset 0 0 0 2px var(--_accent); }
.dg-root .tabulator .tabulator-col-resize-handle { width: 6px; }
/* The library hard-codes light colours for selected ranges; use the page's colours so both themes stay readable */
.dg-root .tabulator .tabulator-header .tabulator-col.tabulator-range-highlight,
.dg-root .tabulator-row.tabulator-range-highlight .tabulator-cell.tabulator-range-row-header { background-color: color-mix(in srgb, var(--_accent) 18%, var(--_surface)); color: var(--_text); }
.dg-root .tabulator .tabulator-header .tabulator-col.tabulator-range-selected,
.dg-root .tabulator-row.tabulator-range-highlight.tabulator-range-selected .tabulator-cell.tabulator-range-row-header,
.dg-root .tabulator-row.tabulator-range-selected .tabulator-cell.tabulator-range-row-header { background-color: color-mix(in srgb, var(--_accent) 38%, var(--_surface)); color: var(--_text); }
.dg-root .tabulator-row .tabulator-cell.tabulator-range-selected:not(.tabulator-range-only-cell-selected):not(.tabulator-range-row-header) { background-color: color-mix(in srgb, var(--_accent) 24%, var(--_bg)); color: var(--_text); }
`;
