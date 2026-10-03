// App glue for the Data tab: fetch the table once, hand it to <data-grid>, handle failure and retry.
// This is the only place that knows the data endpoint. Loaded lazily the first time the tab is shown.
import "../data-grid/data-grid";
import type { DataGrid } from "../data-grid/data-grid";
import type { DataTable } from "../data-grid/types";

async function fetchTable(url: string): Promise<DataTable> {
  let res: Response;
  try {
    res = await fetch(url);
  } catch {
    throw new Error("Check your connection and try again.");
  }
  if (!res.ok) {
    let detail = "";
    try {
      detail = ((await res.json()) as { detail?: string }).detail ?? "";
    } catch { /* body was not JSON */ }
    throw new Error(detail || `The server answered ${res.status}.`);
  }
  return (await res.json()) as DataTable;
}

export function init(grid: DataGrid, url = "/api/data"): void {
  let loading = false;
  async function load() {
    if (loading) return;
    loading = true;
    grid.setLoading();
    try {
      grid.table = await fetchTable(url); // kept in memory by the grid; never fetched again
    } catch (err) {
      grid.setError(err instanceof Error ? err.message : "Please try again.");
    } finally {
      loading = false;
    }
  }
  grid.addEventListener("retry", load);
  void load();
}
