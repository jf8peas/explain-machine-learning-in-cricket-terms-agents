// The open/closed state of the "Stage by stage" panels on the Under the hood page. Pure: no DOM, so it is unit-tested.

export const PANEL_COUNT = 7;

export type PanelState = readonly boolean[];

/** Every panel starts closed. */
export function initial(): PanelState {
  return Array.from({ length: PANEL_COUNT }, () => false);
}

/** The state after opening or closing panel `index`; an index outside the panels changes nothing. */
export function toggle(state: PanelState, index: number): PanelState {
  if (!Number.isInteger(index) || index < 0 || index >= state.length) return [...state];
  return state.map((open, i) => (i === index ? !open : open));
}

export function setAll(state: PanelState, open: boolean): PanelState {
  return state.map(() => open);
}

export function allOpen(state: PanelState): boolean {
  return state.length > 0 && state.every(Boolean);
}

/** "Collapse all" only while every panel is open; otherwise "Expand all". */
export function toggleAllLabel(state: PanelState): string {
  return allOpen(state) ? "Collapse all" : "Expand all";
}

/** The state after pressing the Expand all / Collapse all button: everything closes if everything is open, else everything opens. */
export function nextAll(state: PanelState): PanelState {
  return setAll(state, !allOpen(state));
}
