import { describe, expect, it } from "vitest";
import { filterOptions, isViewActive, nextSort, visibleRows, yearOf } from "../../src/data-grid/table-view";
import { emptyView, type DataTable } from "../../src/data-grid/types";

const table: DataTable = {
  columns: [
    { key: "id", label: "ID", description: "", type: "integer" },
    { key: "date", label: "Date", description: "", type: "date", filter: "year" },
    { key: "comp", label: "Competition", description: "", type: "text", filter: "select", labels: { t20i: "T20 International", ipl: "IPL" } },
    { key: "venue", label: "Venue", description: "", type: "text" },
    { key: "runs", label: "Runs", description: "", type: "integer" },
    { key: "used", label: "Used for", description: "", type: "text", filter: "select", labels: { training: "Training", test: "Test" } },
  ],
  rows: [
    [1, "2023-04-01", "ipl", "Wankhede", 80, "training"],
    [2, "2024-05-02", "t20i", "Eden Park", 100, "test"],
    [3, "2024-06-03", "ipl", "Eden Gardens", 9, "test"],
    [4, "2023-07-04", "t20i", 'Ground, "North" End', 100, "training"],
    [5, "2024-08-05", "ipl", "Chepauk", null, "test"],
  ],
  summary: { headline: [], sections: [], attribution: "", file_stem: "x", file_date: "2026-01-01" },
};
const ids = (rows: unknown[][]) => rows.map((r) => r[0]);
const view = (patch: Partial<ReturnType<typeof emptyView>>) => ({ ...emptyView(), ...patch });

describe("search", () => {
  it("matches the displayed text, ignoring case", () => {
    expect(ids(visibleRows(table, view({ search: "t20 international" })))).toEqual([2, 4]);
    expect(ids(visibleRows(table, view({ search: "WANKHEDE" })))).toEqual([1]);
  });
  it("does not match the stored code that is not displayed", () => {
    expect(visibleRows(table, view({ search: "t20i" }))).toHaveLength(0);
  });
  it("trims spaces around the term and matches any column", () => {
    expect(ids(visibleRows(table, view({ search: "  eden  " })))).toEqual([2, 3]);
    expect(ids(visibleRows(table, view({ search: "2024-06" })))).toEqual([3]);
  });
  it("matches a venue containing commas and quotes", () => {
    expect(ids(visibleRows(table, view({ search: '"north" end' })))).toEqual([4]);
  });
});

describe("filters", () => {
  it("filters by select column on the raw value", () => {
    expect(ids(visibleRows(table, view({ filters: { comp: "ipl" } })))).toEqual([1, 3, 5]);
  });
  it("filters by calendar year of a date column", () => {
    expect(ids(visibleRows(table, view({ filters: { date: "2024" } })))).toEqual([2, 3, 5]);
  });
  it("combines search, competition, year and used-for", () => {
    expect(ids(visibleRows(table, view({ search: "eden", filters: { comp: "ipl", date: "2024", used: "test" } })))).toEqual([3]);
  });
  it("returns nothing when no row matches", () => {
    expect(visibleRows(table, view({ filters: { comp: "ipl", used: "training", date: "2024" } }))).toEqual([]);
  });
  it("offers options as display labels, years newest first", () => {
    expect(filterOptions(table, table.columns[2])).toEqual([{ value: "ipl", label: "IPL" }, { value: "t20i", label: "T20 International" }]);
    expect(filterOptions(table, table.columns[1]).map((o) => o.value)).toEqual(["2024", "2023"]);
  });
  it("reads the year from an ISO date", () => {
    expect(yearOf("2026-10-01")).toBe("2026");
    expect(yearOf(null)).toBe("");
  });
});

describe("sort", () => {
  it("cycles ascending, descending, original", () => {
    let s = nextSort(null, "runs");
    expect(s).toEqual({ key: "runs", dir: "asc" });
    s = nextSort(s, "runs");
    expect(s).toEqual({ key: "runs", dir: "desc" });
    expect(nextSort(s, "runs")).toBeNull();
    expect(nextSort(s, "id")).toEqual({ key: "id", dir: "asc" });
  });
  it("sorts numbers by value (not text) with empty values last", () => {
    expect(ids(visibleRows(table, view({ sort: { key: "runs", dir: "asc" } })))).toEqual([3, 1, 2, 4, 5]);
    expect(ids(visibleRows(table, view({ sort: { key: "runs", dir: "desc" } })))).toEqual([2, 4, 1, 3, 5]);
  });
  it("keeps original order for ties", () => {
    expect(ids(visibleRows(table, view({ sort: { key: "runs", dir: "asc" } }))).slice(2, 4)).toEqual([2, 4]);
  });
  it("sorts dates and text by display text", () => {
    expect(ids(visibleRows(table, view({ sort: { key: "date", dir: "asc" } })))).toEqual([1, 4, 2, 3, 5]);
    expect(ids(visibleRows(table, view({ sort: { key: "comp", dir: "asc" } })))).toEqual([1, 3, 5, 2, 4]);
  });
  it("returns the original order when there is no sort", () => {
    expect(ids(visibleRows(table, emptyView()))).toEqual([1, 2, 3, 4, 5]);
  });
  it("sorts the filtered rows", () => {
    expect(ids(visibleRows(table, view({ filters: { used: "test" }, sort: { key: "runs", dir: "desc" } })))).toEqual([2, 3, 5]);
  });
});

describe("isViewActive", () => {
  it("is true for search, filter or sort and false otherwise", () => {
    expect(isViewActive(emptyView())).toBe(false);
    expect(isViewActive(view({ search: " " }))).toBe(false);
    expect(isViewActive(view({ search: "a" }))).toBe(true);
    expect(isViewActive(view({ filters: { comp: "ipl" } }))).toBe(true);
    expect(isViewActive(view({ sort: { key: "id", dir: "asc" } }))).toBe(true);
  });
});
