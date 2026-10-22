// The header's "Show me everything" switch, shared by both pages: a pill button with aria-pressed whose label becomes "Simple view"
// while it is on. The level itself lives in detail-level.ts; this only draws the button and passes the press on. The header's
// other items are plain links in each page's HTML.
import { applyInitialLevel, bindToggles, currentLevel, setLevel } from "./detail-level";

export const SWITCH_ON = "Simple view";
export const SWITCH_OFF = "Show me everything";

/** Start both pages at the remembered level and wire the switch and every Commentary toggle. */
export function setupHeader(): void {
  applyInitialLevel();
  const button = document.querySelector<HTMLButtonElement>("[data-testid=view-switch]");
  if (button) {
    const label = button.querySelector(".label");
    const paint = () => {
      const on = currentLevel() === "everything";
      const text = on ? SWITCH_ON : SWITCH_OFF;
      button.setAttribute("aria-pressed", String(on));
      button.setAttribute("aria-label", text);
      if (label) label.textContent = text;
    };
    button.addEventListener("click", () => setLevel(currentLevel() === "everything" ? "simple" : "everything"));
    document.addEventListener("viewchange", paint);
    paint();
  }
  bindToggles();
}
