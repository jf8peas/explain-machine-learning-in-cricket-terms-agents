// The Working tab's hero (app-specific): fetches /api/reference once and fills the "How good is the TV projection?" panel,
// the sentences and the footnote, and draws the worm chart. Every number and every data-dependent sentence comes from
// the server and goes in as text; the only words typed in the page are the README's fixed copy, which has no numbers.
// Without figures nothing numeric is shown, and without an example the chart card is left out.
import { fmt } from "./dom";
import type { Reference } from "./reference-types";
import { mountWorm } from "./worm";

const UNAVAILABLE = "The accuracy figures could not be loaded.";

/** The sentence as text and <strong> pieces: each phrase in `bold` is emphasised wherever it appears. Pure on its input. */
export function emphasised(text: string, bold: string[]): (Node | string)[] {
  const phrases = bold.filter((p) => p && text.includes(p));
  if (!phrases.length) return [text];
  const pattern = new RegExp(`(${phrases.map((p) => p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`);
  return text.split(pattern).filter((part) => part !== "").map((part) => {
    if (!phrases.includes(part)) return part;
    const strong = document.createElement("strong");
    strong.textContent = part;
    return strong;
  });
}

const part = (root: HTMLElement, id: string) => root.querySelector(`[data-testid="${id}"]`) as HTMLElement;

function unavailable(root: HTMLElement, text: string): void {
  part(root, "tv-panel").hidden = true;
  part(root, "worm-card").hidden = true;
  const note = part(root, "hero-unavailable");
  note.textContent = text;
  note.hidden = false;
}

function render(root: HTMLElement, ref: Reference): void {
  const { figures, hero, training } = ref;
  if (!figures || !hero || !training) return unavailable(root, ref.message ?? UNAVAILABLE);
  part(root, "hero-unavailable").hidden = true;

  part(root, "tv-miss").textContent = fmt(figures.broadcaster.average_miss);
  part(root, "nothing-miss").textContent = fmt(figures.know_nothing.average_miss);
  part(root, "tv-sentence").replaceChildren(...emphasised(hero.panel, hero.panel_emphasis));
  part(root, "tv-footnote").textContent = hero.footnote;
  part(root, "tv-panel").hidden = false;

  const card = part(root, "worm-card");
  const { example } = ref;
  if (!example || !hero.caption || !hero.chart_text || ref.average_total === null) {
    card.hidden = true;                 // no example innings to draw: leave the chart out, show no numbers for it
    return;
  }
  part(root, "worm-caption").textContent = hero.caption;
  card.hidden = false;                  // shown first so the chart can measure its width
  mountWorm(card, part(root, "worm-chart"), {
    example, averageMiss: figures.broadcaster.average_miss, averageTotal: ref.average_total, chartText: hero.chart_text,
  });
}

export async function setupHero(root: HTMLElement): Promise<void> {
  try {
    const res = await fetch("/api/reference");
    if (!res.ok) throw new Error(String(res.status));
    render(root, (await res.json()) as Reference);
  } catch {
    unavailable(root, UNAVAILABLE);
  }
}
