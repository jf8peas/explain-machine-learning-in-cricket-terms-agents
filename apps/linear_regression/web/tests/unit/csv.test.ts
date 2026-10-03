import { describe, expect, it } from "vitest";
import { csvFileName, toCsv } from "../../src/data-grid/csv";
import type { ColumnDef } from "../../src/data-grid/types";

const columns: ColumnDef[] = [
  { key: "id", label: "Match ID", description: "", type: "integer" },
  { key: "date", label: "Match date", description: "", type: "date" },
  { key: "comp", label: "Competition", description: "", type: "text", labels: { t20i: "T20 International" } },
  { key: "venue", label: "Venue", description: "", type: "text" },
  { key: "runs", label: "Runs, at 10", description: "", type: "integer" },
];

describe("toCsv", () => {
  it("starts with a byte-order mark, then friendly headings, using CRLF", () => {
    const csv = toCsv(columns, []);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv).toBe('﻿Match ID,Match date,Competition,Venue,"Runs, at 10"\r\n');
  });
  it("applies display labels and keeps ISO dates and plain numbers", () => {
    const csv = toCsv(columns, [[211048, "2005-02-17", "t20i", "Eden Park", 89]]);
    expect(csv.split("\r\n")[1]).toBe("211048,2005-02-17,T20 International,Eden Park,89");
  });
  it("quotes a venue containing a comma", () => {
    const csv = toCsv(columns, [[1, "2024-01-01", "ipl", "Ground, North End", 70]]);
    expect(csv.split("\r\n")[1]).toBe('1,2024-01-01,ipl,"Ground, North End",70');
  });
  it("doubles quotes and quotes fields with quotes or line breaks", () => {
    const csv = toCsv(columns, [[1, "2024-01-01", "ipl", 'The "Gabba"', 70], [2, "2024-01-02", "ipl", "Line one\nLine two", 71]]);
    const lines = csv.split("\r\n");
    expect(lines[1]).toBe('1,2024-01-01,ipl,"The ""Gabba""",70');
    expect(csv).toContain('"Line one\nLine two"');
  });
  it("passes non-ASCII text through unchanged and writes empty values as nothing", () => {
    const csv = toCsv(columns, [[3, "2024-01-03", "ipl", "Köln Ground ñ", null]]);
    expect(csv.split("\r\n")[1]).toBe("3,2024-01-03,ipl,Köln Ground ñ,");
  });
  it("keeps the order of the rows it is given (the order shown)", () => {
    const rows = [[3, "2024-01-03", "ipl", "C", 1], [1, "2024-01-01", "ipl", "A", 2], [2, "2024-01-02", "ipl", "B", 3]];
    const body = toCsv(columns, rows).split("\r\n").slice(1, 4).map((l) => l.split(",")[0]);
    expect(body).toEqual(["3", "1", "2"]);
  });
});

describe("dummy columns", () => {
  const withDummies: ColumnDef[] = [
    { key: "comp", label: "Competition", description: "", type: "text", labels: { t20i: "T20 International", ipl: "IPL", bbl: "BBL" } },
    { key: "is_ipl", label: "IPL (0/1)", description: "", type: "integer", filter: "select" },
    { key: "is_bbl", label: "BBL (0/1)", description: "", type: "integer", filter: "select" },
    { key: "venue", label: "Venue", description: "", type: "text" },
  ];
  it("come out in the grid's position with the grid's headings", () => {
    const csv = toCsv(withDummies, [["t20i", 0, 0, "Eden Park"], ["ipl", 1, 0, "Wankhede"], ["bbl", 0, 1, "Gabba"]]).split("\r\n");
    expect(csv[0].replace("\uFEFF", "")).toBe("Competition,IPL (0/1),BBL (0/1),Venue");
    expect(csv.slice(1, 4)).toEqual(["T20 International,0,0,Eden Park", "IPL,1,0,Wankhede", "BBL,0,1,Gabba"]);
  });
});

describe("csvFileName", () => {
  it("joins the stem and the data's download date", () => {
    expect(csvFileName({ file_stem: "t20-first-innings", file_date: "2026-10-01" })).toBe("t20-first-innings-2026-10-01.csv");
  });
});
