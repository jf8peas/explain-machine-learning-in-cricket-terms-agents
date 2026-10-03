// Generic table types for <data-grid>. Nothing here knows what the data is about.

export type Value = string | number | null;

export interface ColumnDef {
  key: string;
  label: string;
  description: string;
  type: "text" | "integer" | "number" | "date";
  /** Display text for raw values (for example a code to a full name). */
  labels?: Record<string, string>;
  /** "select": dropdown of the column's display values. "year": dropdown of years from a date column. */
  filter?: "select" | "year";
}

export interface SummaryItem {
  label: string;
  value: string;
}

export interface DataSummary {
  headline: SummaryItem[];
  sections: { title: string; rows: SummaryItem[] }[];
  attribution: string;
  attribution_url?: string;
  file_stem: string;
  /** YYYY-MM-DD, used in the downloaded file's name. */
  file_date: string;
}

export interface DataTable {
  columns: ColumnDef[];
  /** One value per column, in column order, in the original order. */
  rows: Value[][];
  summary: DataSummary;
}

export type SortState = { key: string; dir: "asc" | "desc" } | null;

export interface ViewState {
  search: string;
  /** Column key to chosen value (a raw value for "select", a year for "year"). Empty means no filter. */
  filters: Record<string, string>;
  sort: SortState;
}

export const emptyView = (): ViewState => ({ search: "", filters: {}, sort: null });
