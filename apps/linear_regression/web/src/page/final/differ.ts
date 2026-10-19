// Section 2 of The final test (app-specific): why these scores differ from What the agent found. The same two models in two
// different exams, as two side-by-side cards on one shared scale from zero, then three short reasons. Every number is the run's
// (the validation scores, the test scores and the count of candidate models tried); everything is set as text.
import { fromTenths, examPill, yearsText } from "../exam";
import { h } from "../dom";
import { bothTiny, leadSentence, reasonTwo, scaleMax } from "./copy";
import { TOKEN, type ExamScores, type ExamView } from "./view";

const METHODS: { id: "rival" | "ai"; token: string; name: string }[] = [
  { id: "rival", token: TOKEN.forward, name: "The rival's model" },
  { id: "ai", token: TOKEN.llm, name: "The AI agent's model" },
];

/** A score as a share of the shared scale (in runs). */
export const sharePercent = (tenths: number, max: number): number => Math.max(0, Math.min(100, (tenths / 10 / max) * 100));

function bar(id: "rival" | "ai", token: string, name: string, score: number, max: number): HTMLElement {
  const fill = h("span", { class: `exam-bar exam-bar-${id}`, "data-testid": "exam-bar", "data-method": id === "ai" ? "llm" : "forward" });
  fill.style.width = `${sharePercent(score, max)}%`;
  fill.style.background = token;
  const value = h("span", { class: "exam-value", "data-testid": "exam-value" }, fromTenths(score));
  return h("div", { class: "exam-row" }, h("span", { class: "exam-name", style: `color:${token}` }, name),
    h("span", { class: "exam-track" }, fill), value);
}

function axis(max: number): HTMLElement {
  const ticks = h("span", { class: "exam-scale", "data-testid": "exam-scale", "data-max": String(max) });
  for (let t = 0; t <= max; t += 5) {
    const tick = h("span", { class: "exam-tick" }, String(t));
    tick.style.left = `${(t / max) * 100}%`;
    ticks.append(tick);
  }
  return h("div", { class: "exam-row exam-axis" }, h("span", { class: "exam-name" }), ticks, h("span", { class: "exam-value" }, ""));
}

function card(exam: "validation" | "test", title: string, caption: string, scores: ExamScores, max: number): HTMLElement {
  const rows = METHODS.flatMap((m) => scores[m.id] === null ? [] : [bar(m.id, m.token, m.name, scores[m.id] as number, max)]);
  return h("div", { class: `exam-card exam-card-${exam}`, "data-testid": "exam-card", "data-exam": exam },
    h("div", { class: "exam-card-head" }, examPill(exam), h("strong", {}, title)),
    h("p", { class: "exam-caption" }, caption), ...rows, axis(max), h("p", { class: "visually-hidden" }, "runs off, on average"));
}

function reason(key: string, title: string, ...text: (Node | string)[]): HTMLElement {
  return h("div", { class: "reason", "data-testid": "reason", "data-reason": key }, h("h4", {}, title), h("p", {}, ...text));
}

/** The section's content. */
export function renderDiffer(v: ExamView): HTMLElement[] {
  const max = scaleMax(v);
  const lead = [leadSentence(v), bothTiny(v)].filter(Boolean).join(" ");
  const headLead = h("p", { class: "final-lead", "data-testid": "differ-lead" }, "The same two models, sat in two different exams.", ...(lead ? [` ${lead}`] : []));
  const cards = h("div", { class: "exam-cards", "data-testid": "exam-cards" },
    card("validation", `Check seasons ${yearsText(v.years)}`, "Used to choose. Seen many times while comparing candidate models.", v.validation, max),
    card("test", `Final test ${v.years.test}`, "Used once, to judge. Never seen before.", v.test, max));
  const reasons = h("div", { class: "reasons", "data-testid": "reasons" },
    reason("seasons", "Different seasons", `${v.years.test} is a new season with its own conditions. Any model's miss moves a little from one season to the next.`),
    reason("flatters", "Choosing flatters the pick", h("span", { "data-testid": "reason-count" }, String(v.candidateModels)),
      reasonTwo(v).slice(String(v.candidateModels).length)),
    reason("clean", "The test is the clean one", `${v.years.test} played no part in learning, tuning or choosing, so nothing was fitted to it. When the two disagree, `,
      h("strong", {}, "trust the test"), "."));
  return [headLead, cards, reasons];
}
