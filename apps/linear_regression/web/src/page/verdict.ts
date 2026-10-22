// The verdict (app-specific): how the agent did on the season it never saw. The headline and the agent-against-search sentence are
// the server's words; four bars show each method's average miss; a rule of thumb; a toggle for why the score can be trusted; and
// Commentary with three cards (the check seasons against the final test, how often each method is close, what moves the final
// total). The pick, the method that won on the check seasons, and its goal verdict appear only in the first Commentary card.
import { syncToggles } from "../detail-level/detail-level";
import { h } from "./dom";
import { examView } from "./final/view";
import { renderCloseness } from "./final/closeness";
import { renderDifferCompact } from "./final/differ";
import { renderDriversCard, renderRuleOfThumb } from "./final/takeaways";
import type { CricketExplanation, FinalState } from "./final/types";
import { rows } from "./final/view";
import { examYears, yearsText } from "./exam";
import type { RunInfo } from "./run-source";
import type { Headlines } from "./scoreboard";
import { barCaption, barViews, renderBars } from "./verdict-bars";

export const KICKER = "THE VERDICT";
export const WAITING = "The verdict appears once the agent has a result.";
export const BEST_MODEL_NOTE = "from the best model on the check seasons";
export const TRUST_TOGGLE = "Why you can trust this score";

type VerdictFinal = FinalState & {
  headlines?: Headlines; verdict_sentence?: string; winner_name?: string; winner_reason?: string;
};

/** "Our pick" in words: the method that won on the check seasons (the agent's model, or the brute-force search's). */
export function pickName(final: Pick<FinalState, "winner">): string {
  return final.winner === "llm" ? "the AI agent's model" : "the brute-force search's model";
}

function trustPanel(years: ReturnType<typeof examYears>): HTMLElement {
  const checks = years ? `the check seasons (${yearsText(years)})` : "the check seasons";
  const test = years ? `The test season (${years.test})` : "The test season";
  return h("div", { class: "commentary trust", id: "trust-panel", "data-testid": "trust-panel" },
    h("span", { class: "commentary-label" }, "Commentary"),
    h("ul", {},
      h("li", {}, `The agent chose using ${checks} only.`),
      h("li", {}, `${test} stayed locked and was used once.`),
      h("li", {}, "A plain grid search ran alongside as a yardstick.")));
}

function card(title: string, testid: string, ...content: (Node | null)[]): HTMLElement {
  return h("article", { class: "vcard", "data-testid": testid }, h("h3", {}, title), ...content.filter((c): c is Node => c !== null));
}

function commentary(state: Record<string, unknown>, final: VerdictFinal): HTMLElement {
  const expl = state.explanation as CricketExplanation | undefined;
  const view = examView(state);
  const list = rows(final);
  const testYear = view?.years.test ?? (state.split as { test_year?: number } | undefined)?.test_year;
  const pick = h("div", { class: "pick", "data-testid": "pick" },
    h("p", {}, h("strong", {}, "Our pick: "), `${pickName(final)}, chosen on the check seasons.`),
    ...(final.verdict_sentence ? [h("p", { "data-testid": "pick-verdict" }, final.verdict_sentence)] : []));
  const panel = h("div", { class: "commentary", id: "verdict-commentary", "data-testid": "verdict-commentary" },
    h("span", { class: "commentary-label" }, "Commentary"),
    card("Check seasons vs the final test", "vcard-seasons", pick, ...(view ? renderDifferCompact(view) : [])),
    card("How often is it close?", "vcard-close", ...renderCloseness(list, expl, testYear, false, false)),
    card("What moves the final total", "vcard-drivers",
      h("p", { class: "muted", "data-testid": "drivers-label" }, `Runs each clue adds, ${BEST_MODEL_NOTE}.`),
      expl ? renderDriversCard(expl) : null));
  return panel;
}

/** Fill the verdict section for the run now showing. */
export function renderVerdict(root: HTMLElement, run: RunInfo | null): void {
  const state = run?.state ?? {};
  const final = state.final as VerdictFinal | undefined;
  if (!final?.headlines || !final.accuracy) {
    root.replaceChildren(h("p", { class: "kicker" }, KICKER), h("h2", { id: "verdict-title" }, "The verdict"),
      h("p", { class: "muted", "data-testid": "verdict-waiting" }, WAITING));
    return;
  }
  const expl = state.explanation as CricketExplanation | undefined;
  const years = examYears(state.split as Parameters<typeof examYears>[0]);
  const innings = final.accuracy.broadcaster?.n;
  const rule = expl ? renderRuleOfThumb(expl, false) : null;
  root.replaceChildren(
    h("p", { class: "kicker" }, KICKER),
    h("h2", { id: "verdict-title", "data-testid": "verdict-title" }, final.headlines.verdict_h2),
    ...(final.headlines.vs_search ? [h("p", { class: "lead", "data-testid": "verdict-vs-search" }, final.headlines.vs_search)] : []),
    renderBars(barViews(final.accuracy as Record<string, { average_miss: number }>)),
    h("p", { class: "cap-line", "data-testid": "verdict-caption" }, barCaption(innings, years?.test)),
    ...(rule ? [h("div", { class: "rule-card", "data-testid": "rule-card" }, rule, h("p", { class: "rule-from", "data-testid": "rule-from" }, BEST_MODEL_NOTE))] : []),
    h("button", { type: "button", class: "toggle", "data-testid": "trust-toggle", "data-commentary-toggle": "", "aria-controls": "trust-panel", "aria-expanded": "false" }, `${TRUST_TOGGLE} `),
    trustPanel(years),
    commentary(state, final));
  syncToggles();
}
