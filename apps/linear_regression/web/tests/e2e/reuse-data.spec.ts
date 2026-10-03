// <tab-set> and <data-grid> given an unrelated table, in a page with no app code: they work unchanged.
import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";

const firstName = (page: import("@playwright/test").Page) =>
  page.locator(".dg-grid .tabulator-row").first().locator('.tabulator-cell[tabulator-field="name"]');

test("tabs and grid work for an unrelated table", async ({ page }) => {
  await page.goto("/tests/fixtures/reuse-data.html");
  await expect(page.getByTestId("fixture-intro")).toBeVisible();
  await page.getByTestId("tab-table").click();
  await expect(page.getByTestId("data-count")).toHaveText("Showing 5 of 5 people");
  await expect(page.getByTestId("data-summary")).toContainText("By country");

  // sort: ascending, descending, original
  const score = page.locator('.dg-grid .tabulator-col[tabulator-field="score"]');
  await score.click();
  await expect(firstName(page)).toHaveText("Chloé");
  await score.click();
  await expect(firstName(page)).toHaveText("Ben");
  await score.click();
  await expect(firstName(page)).toHaveText("Asha");

  // search and filters
  await page.getByTestId("data-search").fill("new zealand");
  await expect(page.getByTestId("data-count")).toHaveText("Showing 3 of 5 people");
  await page.getByTestId("filter-joined").selectOption("2024");
  await expect(page.getByTestId("data-count")).toHaveText("Showing 2 of 5 people");

  // download of the rows shown, with a quoted field
  await page.getByTestId("download-csv").click();
  const [shown] = await Promise.all([page.waitForEvent("download"), page.getByTestId("download-shown").click()]);
  expect(shown.suggestedFilename()).toBe("people-2025-01-31.csv");
  const csv = readFileSync((await shown.path())!, "utf8").replace(/^﻿/, "").split("\r\n").filter(Boolean);
  expect(csv).toEqual(["Name,Country,Joined,Score,Note", 'Ben,New Zealand,2024-03-02,95,"says ""hello"""', "Chloé,New Zealand,2024-04-03,12,plain"]);

  // a generic note: closed by default, opens to show its text and example table
  const note = page.getByTestId("note-0");
  expect(await note.evaluate((el) => (el as HTMLDetailsElement).open)).toBe(false);
  await expect(note.getByText("They were made up for a test.")).toBeHidden();
  await note.locator("summary").click();
  await expect(note.getByText("They were made up for a test.")).toBeVisible();
  await expect(note.locator("table tbody tr")).toHaveCount(1);

  // nothing in the page is about cricket or regression
  const text = (await page.locator("body").innerText()).toLowerCase();
  expect(text).not.toMatch(/cricket|regression|innings|runs at/);
});
