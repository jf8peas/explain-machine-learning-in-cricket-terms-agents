// CSV generation. Our own code (not the grid library's export) so the output never depends on the library.
import { displayText } from "./table-view";
import type { ColumnDef, DataSummary, Value } from "./types";

const BOM = "﻿"; // lets Excel read the file as UTF-8

function field(text: string): string {
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** Header row of friendly labels, then one line per row, using display labels. CRLF line endings. */
export function toCsv(columns: ColumnDef[], rows: Value[][]): string {
  const lines = [columns.map((c) => field(c.label)).join(",")];
  for (const row of rows) lines.push(columns.map((c, i) => field(displayText(c, row[i]))).join(","));
  return BOM + lines.join("\r\n") + "\r\n";
}

export function csvFileName(summary: Pick<DataSummary, "file_stem" | "file_date">): string {
  return `${summary.file_stem}-${summary.file_date}.csv`;
}

export function downloadCsv(fileName: string, csv: string): void {
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
