// Section 2 of What the agent found: how every setup is scored (app-specific). The years come from the run's split.
import { h } from "../dom";
import type { Split } from "./view";

export function renderSeasons(split: Split | undefined): Node[] {
  const lead = h("p", { class: "found-lead-text" }, "Each setup learns from earlier seasons, then predicts three past seasons it hasn't seen. Its score is its ",
    h("strong", {}, "average miss"), " across the three, in runs. Lower is better. The final test season stays locked until the very end.");
  if (!split || !split.checks.length) return [lead];
  const first = split.checks[0].year;
  const learning = first - 1 > split.first_year ? `${split.first_year}–${first - 1}` : String(split.first_year);
  const years = split.checks.map((c) => c.year);
  const label = `Seasons ${learning} are for learning. ${years.join(", ")} are the check seasons. ${split.test_year} is the final test, locked until the end.`;
  const strip = h("div", { class: "seasons", "data-testid": "seasons", role: "img", "aria-label": label },
    h("div", { class: "season season-learning", "data-testid": "season-learning" }, h("strong", {}, learning), h("span", {}, "learn from")),
    ...split.checks.map((c) => h("div", { class: "season season-check", "data-testid": "season-check", "data-year": String(c.year) },
      h("strong", {}, String(c.year)), h("span", {}, "check"))),
    h("div", { class: "season season-test", "data-testid": "season-test" }, h("strong", {}, String(split.test_year)), h("span", {}, "final test, locked")));
  const out: Node[] = [lead, strip];
  if (split.checks.length > 1) {
    out.push(h("p", { class: "small" }, `Each check only learns from the seasons before it, so ${split.checks[1].year} is checked on a model that learned up to ${first}, and so on.`));
  }
  return out;
}
