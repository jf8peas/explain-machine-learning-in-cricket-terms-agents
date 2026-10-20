// Example innings for the hero chart tests (feature 017): the innings the hero draws, and variants that stress the zoom.
import type { WormInput } from "../../src/page/worm";

export const RUNS = [9, 14, 16, 28, 45, 51, 59, 68, 73, 82, 87, 101, 114, 124, 139, 145, 157, 168, 175, 186];
export const WICKETS = [0, 1, 1, 1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 2, 2, 2, 2, 2, 3, 5];

/** A straight-line innings reaching `total` after 20 overs, with `at10` runs after 10, for innings other than the current one. */
export function runsFor(at10: number, total: number): number[] {
  return Array.from({ length: 20 }, (_, i) => {
    const over = i + 1;
    return over <= 10 ? Math.round((at10 * over) / 10) : Math.round(at10 + ((total - at10) * (over - 10)) / 10);
  });
}

export function input(over: Partial<WormInput["example"]> = {}, rest: Partial<Omit<WormInput, "example">> = {}): WormInput {
  return {
    example: {
      match_id: "1", batting_team: "A", bowling_team: "B", venue: "V", date: "2020-12-08", date_label: "December 2020",
      runs: RUNS, wickets: WICKETS, runs_at_10: 82, wickets_at_10: 2, final_total: 186, tv_projection: 164, tv_miss: 22,
      wicket_overs: [2, 10, 19, 20], ...over,
    },
    averageMiss: 22.5, averageTotal: 162, chartText: "text", ...rest,
  };
}

/** Australia v India: 82/2 at 10 overs, 186, TV 164, know-nothing 162, TV's average miss 22.5. */
export const current = (): WormInput => input();
/** The TV and the know-nothing guess within 2 runs of each other (164 and 163). */
export const close = (): WormInput => input({}, { averageTotal: 163 });
/** The TV above the actual total (171 against 150). */
export const tvOver = (): WormInput => input({ runs: runsFor(75, 150), runs_at_10: 75, final_total: 150, tv_projection: 171, tv_miss: 21, wicket_overs: [4, 12, 20] });
/** The TV equal to the actual total. */
export const spotOn = (): WormInput => input({ tv_projection: 186, tv_miss: 0 });
/** Low totals, so the TV's miss band (TV ± 22.5) goes past the plotted values and below zero's neighbourhood. */
export const lowTotals = (): WormInput => input({ runs: runsFor(30, 60), runs_at_10: 30, final_total: 60, tv_projection: 60, tv_miss: 0, wicket_overs: [3, 20] }, { averageTotal: 58, averageMiss: 22.5 });
/** A high-total innings whose zoom range reaches past the 0 to 200 axis. */
export const highTotals = (): WormInput => input({ runs: runsFor(110, 199), runs_at_10: 110, final_total: 199, tv_projection: 198, tv_miss: 1 }, { averageTotal: 196, averageMiss: 5 });
