// Data tab: tabs, spreadsheet grid, sort/search/filter, split visibility, summary, CSV download, failure.
import { readFileSync } from "node:fs";
import { expect, test, type Page } from "./fixtures";
import { countRunRequests, open, playToEnd, timelineItems } from "./helpers";

const TOTAL = 5146; // manifest total_innings; checked against the agent's load_data step below

const count = (page: Page) => page.getByTestId("data-count");
const cell = (page: Page, row: number, field: string) =>
  page.locator(".dg-grid .tabulator-row").nth(row).locator(`.tabulator-cell[tabulator-field="${field}"]`);
const heading = (page: Page, field: string) => page.locator(`.dg-grid .tabulator-col[tabulator-field="${field}"]`);

async function openData(page: Page) {
  await page.goto("/#data");
  await expect(count(page)).toHaveText(`Showing ${TOTAL.toLocaleString("en")} of ${TOTAL.toLocaleString("en")} innings`);
}

/** Step events of the real run, read from the stream the page itself uses. */
async function runSteps(page: Page): Promise<Record<string, any>> {
  const text = await (await page.request.get("/api/run")).text();
  const steps: Record<string, any> = {};
  for (const block of text.split("\n\n")) {
    const m = /^event: step\ndata: (.*)$/m.exec(block);
    if (m) {
      const s = JSON.parse(m[1]);
      steps[s.node] = s.changes;
    }
  }
  return steps;
}

test.describe("tabs", () => {
  test("Working is the default and the Data panel is hidden", async ({ page }) => {
    await open(page);
    await expect(page.getByTestId("tab-working")).toHaveAttribute("aria-selected", "true");
    await expect(page.getByTestId("tab-data")).toHaveAttribute("aria-selected", "false");
    await expect(page.getByTestId("data-panel")).toBeHidden();
    await expect(page.getByTestId("replay")).toBeVisible();
  });

  test("switching tabs mid-run does not restart the run", async ({ page }) => {
    const runs = countRunRequests(page);
    await open(page, 400);
    await page.getByTestId("play").click();
    await expect(timelineItems(page)).not.toHaveCount(0);
    await page.getByTestId("tab-data").click();
    await expect(page.getByTestId("data-panel")).toBeVisible();
    await page.getByTestId("tab-working").click();
    await page.getByTestId("tab-data").click();
    await page.getByTestId("tab-working").click();
    await expect(page.getByTestId("explanation")).toBeVisible({ timeout: 45_000 });
    expect(runs.count()).toBe(1);
  });

  test("a finished run keeps its results, step and try-your-own inputs", async ({ page }) => {
    await open(page);
    await playToEnd(page);
    const form = page.getByTestId("tryit");
    await form.locator("[name=runs_at_10]").fill("84");
    await form.locator("[name=wickets_at_10]").fill("2");
    const steps = await timelineItems(page).count();
    const explanation = (await page.getByTestId("explanation").textContent())!;
    for (let i = 0; i < 3; i++) {
      await page.getByTestId("tab-data").click();
      await page.getByTestId("tab-working").click();
    }
    await expect(page.getByTestId("explanation")).toHaveText(explanation);
    await expect(timelineItems(page)).toHaveCount(steps);
    await expect(form.locator("[name=runs_at_10]")).toHaveValue("84");
    await expect(form.locator("[name=wickets_at_10]")).toHaveValue("2");
  });

  test("opening #data directly shows the grid without a run", async ({ page }) => {
    const runs = countRunRequests(page);
    await openData(page);
    await expect(page.getByTestId("tab-data")).toHaveAttribute("aria-selected", "true");
    await expect(page.getByTestId("data-panel")).toBeVisible();
    await expect(page.getByTestId("tab-working")).toHaveAttribute("aria-selected", "false");
    expect(runs.count()).toBe(0);
  });

  test("Back and Forward move between tabs", async ({ page }) => {
    await open(page);
    await page.getByTestId("tab-data").click();
    await expect(page.getByTestId("data-panel")).toBeVisible();
    await page.goBack();
    await expect(page.getByTestId("tab-working")).toHaveAttribute("aria-selected", "true");
    await page.goForward();
    await expect(page.getByTestId("tab-data")).toHaveAttribute("aria-selected", "true");
  });

  test("an unknown hash shows Working without adding a history step", async ({ page }) => {
    await page.goto("/");
    const plain = await page.evaluate(() => history.length);
    await page.goto("/#nonsense");
    await expect(page.getByTestId("tab-working")).toHaveAttribute("aria-selected", "true");
    await expect(page.getByTestId("data-panel")).toBeHidden();
    expect(await page.evaluate(() => history.length)).toBe(plain + 1); // the navigation itself, nothing more
    expect(new URL(page.url()).hash).toBe("#working");
  });

  test("tabs work by keyboard and expose the tab roles", async ({ page }) => {
    await open(page);
    await expect(page.getByRole("tablist")).toBeVisible();
    await expect(page.getByRole("tab")).toHaveCount(2);
    await page.getByTestId("tab-working").focus();
    await page.keyboard.press("ArrowRight");
    await expect(page.getByTestId("tab-data")).toBeFocused();
    await expect(page.getByTestId("tab-data")).toHaveAttribute("aria-selected", "true");
    await expect(page.getByRole("tabpanel")).toHaveAttribute("aria-labelledby", "tab-data");
    await page.keyboard.press("ArrowRight"); // wraps
    await expect(page.getByTestId("tab-working")).toHaveAttribute("aria-selected", "true");
    await page.keyboard.press("End");
    await expect(page.getByTestId("tab-data")).toHaveAttribute("aria-selected", "true");
    await page.keyboard.press("Home");
    await expect(page.getByTestId("tab-working")).toHaveAttribute("aria-selected", "true");
    await expect(page.getByTestId("tab-working")).toHaveAttribute("aria-controls", "panel-working");
  });
});

test.describe("grid", () => {
  test("shows the innings with friendly headings, full competition names and row numbers", async ({ page }) => {
    await openData(page);
    await expect(heading(page, "runs_at_10")).toContainText("Runs at 10 overs");
    await expect(heading(page, "used_for")).toContainText("Used for");
    await expect(cell(page, 0, "competition")).toHaveText("T20 International");
    await expect(page.locator(".dg-grid .tabulator-row").first().locator(".tabulator-row-header")).toHaveText("1");
  });

  test("a heading's meaning shows on hover text and on focus, and the guide lists every column", async ({ page }) => {
    await openData(page);
    await expect(heading(page, "runs_at_10")).toHaveAttribute("title", /after 10 overs/i);
    await heading(page, "runs_at_10").focus();
    await expect(page.getByTestId("heading-help")).toContainText("Runs at 10 overs");
    await expect(page.getByTestId("heading-help")).toContainText("after 10 overs");
    await page.getByTestId("column-guide").locator("summary").click();
    const columnCount = (await (await page.request.get("/api/data")).json()).columns.length;
    await expect(page.getByTestId("column-guide").locator("dt")).toHaveCount(columnCount);
    await expect(page.getByTestId("column-guide")).toContainText("Used for");
  });

  test("headings sort from the keyboard: ascending, descending, original", async ({ page }) => {
    await openData(page);
    const original = await cell(page, 0, "match_id").innerText();
    await heading(page, "match_id").focus();
    await expect(heading(page, "match_id")).toHaveCSS("outline-style", /solid|auto/);
    await page.keyboard.press("Enter");
    await expect(heading(page, "match_id")).toHaveAttribute("aria-sort", "ascending");
    await page.keyboard.press("Space");
    await expect(heading(page, "match_id")).toHaveAttribute("aria-sort", "descending");
    await page.keyboard.press("Enter");
    await expect(heading(page, "match_id")).toHaveAttribute("aria-sort", "none");
    await expect(cell(page, 0, "match_id")).toHaveText(original);
  });

  test("the row-number column and header stay in place while scrolling", async ({ page }) => {
    await openData(page);
    const holder = page.locator(".dg-grid .tabulator-tableholder");
    await holder.evaluate((h) => { h.scrollTop = 4000; h.scrollLeft = 200; });
    const first = page.locator(".dg-grid .tabulator-row .tabulator-row-header").first();
    await expect(first).not.toHaveText("1");
    const grid = await page.locator(".dg-grid").boundingBox();
    const num = await first.boundingBox();
    expect(Math.abs(num!.x - grid!.x)).toBeLessThan(6); // still at the left edge after scrolling right
    const top = (await heading(page, "match_id").boundingBox())!.y - grid!.y;
    expect(top).toBeGreaterThanOrEqual(-1);
    expect(top).toBeLessThan(60); // the header is still at the top of the grid
  });

  test("the page never scrolls sideways at phone width, and the grid scrolls inside itself", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 700 });
    await openData(page);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
    const inner = await page.locator(".dg-grid .tabulator-tableholder").evaluate((h) => h.scrollWidth > h.clientWidth);
    expect(inner).toBe(true);
  });

  test("columns can be resized", async ({ page }) => {
    await openData(page);
    const col = heading(page, "venue");
    const before = (await col.boundingBox())!.width;
    const box = (await col.boundingBox())!;
    await page.mouse.move(box.x + box.width - 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width + 70, box.y + box.height / 2, { steps: 6 });
    await page.mouse.up();
    expect((await col.boundingBox())!.width).toBeGreaterThan(before + 30);
  });

  test("cells cannot be edited", async ({ page }) => {
    await openData(page);
    await cell(page, 0, "venue").dblclick();
    await expect(page.locator(".dg-grid input, .dg-grid textarea, .dg-grid [contenteditable=true]")).toHaveCount(0);
  });

  test("copying a range of cells gives tab-separated text without the row numbers", async ({ page, context }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await openData(page);
    const fields = ["competition", "is_ipl", "is_bbl", "venue"];
    const expected = [
      await Promise.all(fields.map((f) => cell(page, 0, f).innerText())),
      await Promise.all(fields.map((f) => cell(page, 1, f).innerText())),
    ];
    await cell(page, 0, "competition").click();
    await cell(page, 1, "venue").click({ modifiers: ["Shift"] });
    await page.keyboard.press("Control+c");
    const text = await page.evaluate(() => navigator.clipboard.readText());
    const parsed = text.trim().split(/\r?\n/).map((line) => line.split(String.fromCharCode(9)));
    expect(parsed).toEqual(expected);
    expect(expected[0][0]).toBe("T20 International");
  });
});

test("arrow keys move the selected cell and copy follows it", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await openData(page);
  await cell(page, 0, "venue").click();
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Control+c");
  expect((await page.evaluate(() => navigator.clipboard.readText())).trim()).toBe(await cell(page, 2, "venue").innerText());
});

test.describe("competition dummy columns", () => {
  const dummyHeadings = ["IPL (0/1)", "BBL (0/1)"];

  test("the two columns follow Competition, with descriptions on focus and in the guide", async ({ page }) => {
    await openData(page);
    const labels = await page.locator(".dg-grid .tabulator-col[tabulator-field]").evaluateAll((els) =>
      els.map((e) => e.getAttribute("tabulator-field")));
    const at = labels.indexOf("competition");
    expect(labels.slice(at, at + 4)).toEqual(["competition", "is_ipl", "is_bbl", "venue"]);
    await expect(heading(page, "is_ipl")).toContainText(dummyHeadings[0]);
    await expect(heading(page, "is_bbl")).toContainText(dummyHeadings[1]);
    await heading(page, "is_ipl").focus();
    await expect(page.getByTestId("heading-help")).toContainText("IPL (0/1)");
    await expect(page.getByTestId("heading-help")).toContainText("1 if the innings was played in the IPL");
    await page.getByTestId("column-guide").locator("summary").click();
    await expect(page.getByTestId("column-guide")).toContainText("BBL (0/1)");
    await expect(page.getByTestId("column-guide")).toContainText("otherwise 0");
  });

  test("each competition shows the right dummy values", async ({ page }) => {
    await openData(page);
    const expected: Record<string, [string, string]> = { ipl: ["1", "0"], bbl: ["0", "1"], t20i: ["0", "0"] };
    for (const [competition, [ipl, bbl]] of Object.entries(expected)) {
      await page.getByTestId("filter-competition").selectOption(competition);
      await expect(count(page)).not.toContainText("Showing 0 of");
      for (const row of [0, 1, 2, 3]) {
        await expect(cell(page, row, "is_ipl")).toHaveText(ipl);
        await expect(cell(page, row, "is_bbl")).toHaveText(bbl);
      }
    }
  });

  test("the dummy filters offer All, 0 and 1 and combine with the Competition filter", async ({ page }) => {
    await openData(page);
    const ipl = page.getByTestId("filter-is_ipl");
    await expect(ipl.locator("option")).toHaveText(["All", "0", "1"]);
    await page.getByTestId("filter-competition").selectOption("ipl");
    const ipls = await count(page).innerText();
    await ipl.selectOption("1");
    await expect(count(page)).toHaveText(ipls); // IPL with IPL (0/1) = 1 is all the IPL rows
    await page.getByTestId("filter-is_bbl").selectOption("0");
    await expect(count(page)).toHaveText(ipls);
    await ipl.selectOption("");
    await page.getByTestId("filter-is_bbl").selectOption("1"); // contradicts Competition = IPL
    await expect(count(page)).toContainText("Showing 0 of");
    await expect(page.getByTestId("data-empty")).toBeVisible();
    await page.getByTestId("empty-clear").click();
    await expect(page.getByTestId("data-empty")).toBeHidden();
    await expect(count(page)).toContainText(`Showing ${TOTAL.toLocaleString("en")} of`);
  });

  test("a dummy filter on its own matches the competition's row count", async ({ page }) => {
    await openData(page);
    await page.getByTestId("filter-is_bbl").selectOption("1");
    const bbl = await count(page).innerText();
    await page.getByTestId("filter-is_bbl").selectOption("");
    await page.getByTestId("filter-competition").selectOption("bbl");
    await expect(count(page)).toHaveText(bbl);
  });

  test("searching IPL returns only IPL rows", async ({ page }) => {
    await openData(page);
    await page.getByTestId("data-search").fill("IPL");
    await expect(count(page)).not.toHaveText(`Showing ${TOTAL.toLocaleString("en")} of ${TOTAL.toLocaleString("en")} innings`);
    for (const row of [0, 1, 2, 3, 4]) await expect(cell(page, row, "competition")).toHaveText("IPL");
    await expect(count(page)).toContainText("Showing 1,210 of");
  });

  test("a dummy column sorts like a number column", async ({ page }) => {
    await openData(page);
    await heading(page, "is_ipl").click();
    await expect(cell(page, 0, "is_ipl")).toHaveText("0");
    await heading(page, "is_ipl").click();
    await expect(cell(page, 0, "is_ipl")).toHaveText("1");
  });
});

test.describe("dummy variables explanation", () => {
  const note = (page: Page) => page.getByTestId("note-0");

  test("the section sits beside the column guide, closed by default, without pushing the grid down", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await openData(page);
    await expect(note(page)).toBeVisible();
    await expect(note(page).locator("summary")).toHaveText("What are dummy variables?");
    expect(await note(page).evaluate((el) => (el as HTMLDetailsElement).open)).toBe(false);
    const guide = (await page.getByTestId("column-guide").boundingBox())!;
    const box = (await note(page).boundingBox())!;
    expect(Math.abs(guide.y - box.y)).toBeLessThan(4); // same row as the column guide
    expect(box.height).toBeLessThan(40); // closed: just a heading line
    await expect(note(page).getByText("yes/no question")).toBeHidden(); // but its text is not shown
    await expect(page.getByTestId("data-grid-area")).toBeVisible();
  });

  test("opening it shows the explanation, the three-row example and the not-used-yet statement", async ({ page }) => {
    await openData(page);
    await note(page).locator("summary").click();
    expect(await note(page).evaluate((el) => (el as HTMLDetailsElement).open)).toBe(true);
    await expect(note(page)).toContainText("yes/no question about an innings");
    await expect(note(page)).toContainText("not with the word");
    await expect(note(page)).toContainText("Why two columns for three competitions?");
    await expect(note(page)).toContainText("how many more or fewer runs than a T20 International innings from the same position");
    await expect(note(page)).toContainText("does not use these columns yet");
    const rows = note(page).locator("table tbody tr");
    await expect(rows).toHaveCount(3);
    await expect(note(page).locator("table thead th")).toHaveText(["Competition", "IPL (0/1)", "BBL (0/1)"]);
    const text = await rows.evaluateAll((trs) => trs.map((tr) => [...tr.querySelectorAll("td")].map((td) => td.textContent)));
    expect(text).toEqual([["T20 International", "0", "0"], ["IPL", "1", "0"], ["BBL", "0", "1"]]);
    // the example agrees with the grid: filtering to each competition shows the same values
    await page.getByTestId("filter-competition").selectOption("ipl");
    await expect(cell(page, 0, "is_ipl")).toHaveText("1");
    await expect(cell(page, 0, "is_bbl")).toHaveText("0");
  });

  test("it can be opened and closed from the keyboard", async ({ page }) => {
    await openData(page);
    await note(page).locator("summary").focus();
    await page.keyboard.press("Enter");
    await expect(note(page)).toContainText("does not use these columns yet");
    await page.keyboard.press("Enter");
    await expect(note(page).getByText("does not use these columns yet")).toBeHidden();
  });
});

test.describe("sort, search and filter", () => {
  test("clicking a heading three times goes ascending, descending, original", async ({ page }) => {
    await openData(page);
    const original = await cell(page, 0, "runs_at_10").innerText();
    await heading(page, "runs_at_10").click();
    await expect(heading(page, "runs_at_10")).toHaveAttribute("aria-sort", "ascending");
    const lowest = Number(await cell(page, 0, "runs_at_10").innerText());
    await heading(page, "runs_at_10").click();
    await expect(heading(page, "runs_at_10")).toHaveAttribute("aria-sort", "descending");
    const highest = Number(await cell(page, 0, "runs_at_10").innerText());
    expect(highest).toBeGreaterThan(lowest);
    await heading(page, "runs_at_10").click();
    await expect(cell(page, 0, "runs_at_10")).toHaveText(original);
  });

  test("search, competition and year narrow the rows and the count; row numbers restart at 1", async ({ page }) => {
    await openData(page);
    await page.getByTestId("data-search").fill("t20 international");
    const afterSearch = Number((await count(page).innerText()).match(/Showing ([\d,]+)/)![1].replace(/,/g, ""));
    expect(afterSearch).toBeGreaterThan(0);
    expect(afterSearch).toBeLessThan(TOTAL);
    await page.getByTestId("filter-match_date").selectOption("2024");
    const afterYear = Number((await count(page).innerText()).match(/Showing ([\d,]+)/)![1].replace(/,/g, ""));
    expect(afterYear).toBeLessThan(afterSearch);
    await expect(count(page)).toHaveText(new RegExp(`Showing ${afterYear.toLocaleString("en")} of ${TOTAL.toLocaleString("en")} innings`));
    await expect(cell(page, 0, "match_date")).toContainText("2024");
    await expect(cell(page, 0, "competition")).toHaveText("T20 International");
    await expect(page.locator(".dg-grid .tabulator-row .tabulator-row-header").first()).toHaveText("1");
    await page.getByTestId("filter-competition").selectOption("ipl");
    await expect(count(page)).toContainText("Showing 0 of");
  });

  test("no matches shows an empty state with a way to clear, and Download rows shown is unavailable", async ({ page }) => {
    await openData(page);
    await page.getByTestId("data-search").fill("zzzz-no-such-venue");
    await expect(page.getByTestId("data-empty")).toBeVisible();
    await page.getByTestId("download-csv").click();
    await expect(page.getByTestId("download-shown")).toBeDisabled();
    await page.getByTestId("empty-clear").click();
    await expect(page.getByTestId("data-empty")).toBeHidden();
    await expect(count(page)).toContainText(`Showing ${TOTAL.toLocaleString("en")} of`);
  });

  test("sort, filters and scroll position survive a tab switch", async ({ page }) => {
    await openData(page);
    await page.getByTestId("data-search").fill("t20 international");
    await heading(page, "final_total").click();
    await heading(page, "final_total").click();
    const holder = page.locator(".dg-grid .tabulator-tableholder");
    await holder.evaluate((h) => { h.scrollTop = 600; });
    const shown = await count(page).innerText();
    await page.getByTestId("tab-working").click();
    await page.getByTestId("tab-data").click();
    await expect(count(page)).toHaveText(shown);
    await expect(page.getByTestId("data-search")).toHaveValue("t20 international");
    await expect(heading(page, "final_total")).toHaveAttribute("aria-sort", "descending");
    await expect.poll(() => holder.evaluate((h) => h.scrollTop)).toBeGreaterThan(400);
  });
});

test.describe("training, validation and test", () => {
  const slice = async (page: Page, value: string) => {
    await page.getByTestId("filter-used_for").selectOption(value);
    return Number(((await count(page).innerText()).match(/Showing ([\d,]+)/) as RegExpMatchArray)[1].replace(/,/g, ""));
  };

  test("the Used for filter offers Training, Validation and Test", async ({ page }) => {
    await openData(page);
    await expect(page.getByTestId("filter-used_for").locator("option")).toHaveText(["All", "Test", "Training", "Validation"]);
  });

  test("each slice shows rows from the right years and its count matches the summary", async ({ page }) => {
    await openData(page);
    const summary = await (await page.request.get("/api/data")).json();
    const section = summary.summary.sections.find((x: { title: string }) => x.title.startsWith("Slices"));
    const shown = Object.fromEntries(section.rows.map((r: { label: string; value: string }) =>
      [r.label.split(" ")[0], Number(r.value.replace(/,/g, ""))]));
    const years = [...new Set(summary.rows.map((r: string[]) => Number(r[1].slice(0, 4))))].sort() as number[];
    const [testYear, validationYear] = [years[years.length - 1], years[years.length - 2]];

    expect(await slice(page, "test")).toBe(shown.Test);
    await expect(cell(page, 0, "used_for")).toHaveText("Test");
    await expect(cell(page, 0, "match_date")).toContainText(String(testYear));
    expect(await slice(page, "validation")).toBe(shown.Validation);
    await expect(cell(page, 0, "used_for")).toHaveText("Validation");
    await expect(cell(page, 0, "match_date")).toContainText(String(validationYear));
    expect(await slice(page, "training")).toBe(shown.Training);
    await expect(cell(page, 0, "used_for")).toHaveText("Training");
    expect(shown.Training + shown.Validation + shown.Test).toBe(TOTAL);
  });

  test("the agent's own split step agrees on the test year's count", async ({ page }) => {
    await openData(page);
    const steps = await runSteps(page);
    expect(await slice(page, "test")).toBe(steps.split.split.test_n);
    await expect(cell(page, 0, "match_date")).toContainText(String(steps.split.split.test_year));
  });

  test("the new candidate columns have headings and descriptions on focus", async ({ page }) => {
    await openData(page);
    for (const [field, heading_, words] of [
      ["powerplay_wickets", "Powerplay wickets (overs 1-6)", "powerplay"],
      ["dot_balls_at_10", "Dot balls at 10 overs", "no runs"],
      ["partnership_runs", "Partnership runs at 10 overs", "since the last wicket"],
      ["wickets_in_hand", "Wickets in hand", "10 minus"],
    ] as const) {
      await expect(heading(page, field)).toContainText(heading_);
      await heading(page, field).focus();
      await expect(page.getByTestId("heading-help")).toContainText(heading_);
      await expect(page.getByTestId("heading-help")).toContainText(words);
    }
  });
});

test.describe("summary", () => {
  test("summary total, grid total and the agent's load_data step agree; attribution is shown", async ({ page }) => {
    await openData(page);
    const steps = await runSteps(page);
    expect(steps.load_data.data_summary.innings).toBe(TOTAL);
    const summary = page.getByTestId("data-summary");
    await expect(summary).toContainText(`${TOTAL.toLocaleString("en")}`);
    await expect(summary).toContainText("Downloaded from Cricsheet");
    await expect(summary).toContainText("Excluded, and why");
    await expect(summary).toContainText("No result");
    const exclusionNote = summary.getByTestId("section-note").filter({ hasText: "prepare_data.py" });
    await expect(exclusionNote).toContainText("before the agent runs");
    await expect(summary).toContainText("Innings per competition");
    await expect(page.getByTestId("attribution-foot")).toContainText("Open Data Commons Attribution License");
    await expect(page.getByTestId("attribution-download")).toContainText("Cricsheet");
  });
});

test.describe("download", () => {
  const lines = (csv: string) => csv.replace(/^﻿/, "").split("\r\n").filter(Boolean);

  test("from Working, Data then Download CSV gives the whole table in two clicks", async ({ page }) => {
    await page.goto("/");
    await page.getByTestId("tab-data").click(); // click 1
    await expect(count(page)).toContainText(`${TOTAL.toLocaleString("en")} of`);
    const [download] = await Promise.all([page.waitForEvent("download"), page.getByTestId("download-csv").click()]); // click 2
    const downloaded = JSON.parse(readFileSync("../data/manifest.json", "utf8")).download_date; // the data's own download date
    expect(download.suggestedFilename()).toBe(`t20-first-innings-${downloaded}.csv`);
    const raw = readFileSync((await download.path())!);
    expect([...raw.subarray(0, 3)]).toEqual([0xef, 0xbb, 0xbf]); // UTF-8 byte-order mark
    const rows = lines(raw.toString("utf8"));
    expect(rows).toHaveLength(TOTAL + 1);
    expect(rows[0]).toContain("Runs at 10 overs");
    expect(rows[0].endsWith("Used for")).toBe(true);
    expect(rows[1]).toContain("T20 International");
    expect(rows[1].endsWith("Training")).toBe(true);
  });

  test("with a filter and sort active the choice offers all rows or rows shown, in the order shown", async ({ page }) => {
    await openData(page);
    await page.getByTestId("filter-competition").selectOption("ipl");
    await heading(page, "final_total").click();
    await heading(page, "final_total").click();
    const shownText = await count(page).innerText();
    const shownCount = Number(shownText.match(/Showing ([\d,]+)/)![1].replace(/,/g, ""));
    await page.getByTestId("download-csv").click();
    await expect(page.getByTestId("download-menu")).toBeVisible();
    const [shown] = await Promise.all([page.waitForEvent("download"), page.getByTestId("download-shown").click()]);
    const rows = lines(readFileSync((await shown.path())!, "utf8"));
    expect(rows).toHaveLength(shownCount + 1);
    expect(rows.slice(1).every((r) => r.includes(",IPL,"))).toBe(true);
    const totals = rows.slice(1).map((r) => Number(r.split(",").slice(-2)[0]));
    expect(totals).toEqual([...totals].sort((a, b) => b - a)); // descending, as shown
    await page.getByTestId("download-csv").click();
    const [all] = await Promise.all([page.waitForEvent("download"), page.getByTestId("download-all").click()]);
    expect(lines(readFileSync((await all.path())!, "utf8"))).toHaveLength(TOTAL + 1);
  });

  test("the menu closes with Escape and downloads nothing", async ({ page }) => {
    await openData(page);
    await page.getByTestId("data-search").fill("ipl");
    let downloads = 0;
    page.on("download", () => downloads++);
    await page.getByTestId("download-csv").click();
    await expect(page.getByTestId("download-menu")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("download-menu")).toBeHidden();
    expect(downloads).toBe(0);
  });
});

test.describe("load failure", () => {
  test("shows a message and Retry on the Data tab only; Working is unaffected", async ({ page }) => {
    let fail = true;
    await page.route("**/api/data", (route) =>
      fail ? route.fulfill({ status: 500, json: { detail: "The innings data file was not found." } }) : route.continue());
    await open(page);
    await page.getByTestId("tab-data").click();
    await expect(page.getByTestId("data-state")).toContainText("could not be loaded");
    await expect(page.getByTestId("data-state")).toContainText("not found");
    await page.getByTestId("tab-working").click();
    await playToEnd(page); // the agent still runs
    await page.getByTestId("tab-data").click();
    fail = false;
    await page.getByTestId("data-retry").click();
    await expect(count(page)).toContainText(`${TOTAL.toLocaleString("en")} of`);
  });

  test("a network failure is also recoverable", async ({ page }) => {
    let fail = true;
    await page.route("**/api/data", (route) => (fail ? route.abort() : route.continue()));
    await page.goto("/#data");
    await expect(page.getByTestId("data-retry")).toBeVisible();
    fail = false;
    await page.getByTestId("data-retry").click();
    await expect(count(page)).toContainText(`${TOTAL.toLocaleString("en")} of`);
  });
});

test.describe("download includes the dummy columns", () => {
  const csvLines = (text: string) => text.replace(/^﻿/, "").split("\r\n").filter(Boolean);

  test("the all-rows file has IPL (0/1) and BBL (0/1) after Competition, agreeing with each competition", async ({ page }) => {
    await openData(page);
    const [download] = await Promise.all([page.waitForEvent("download"), page.getByTestId("download-csv").click()]);
    const rows = csvLines(readFileSync((await download.path())!, "utf8"));
    expect(rows[0]).toContain("Competition,IPL (0/1),BBL (0/1),Venue");
    expect(rows).toHaveLength(TOTAL + 1);
    const agree = /,(T20 International,0,0|IPL,1,0|BBL,0,1),/;
    expect(rows.slice(1).every((r) => agree.test(r))).toBe(true);
  });

  test("the rows-shown file with Competition = IPL has only IPL rows with 1 and 0", async ({ page }) => {
    await openData(page);
    await page.getByTestId("filter-competition").selectOption("ipl");
    await page.getByTestId("download-csv").click();
    const [shown] = await Promise.all([page.waitForEvent("download"), page.getByTestId("download-shown").click()]);
    const rows = csvLines(readFileSync((await shown.path())!, "utf8"));
    expect(rows).toHaveLength(1210 + 1);
    expect(rows.slice(1).every((r) => r.includes(",IPL,1,0,"))).toBe(true);
  });
});
