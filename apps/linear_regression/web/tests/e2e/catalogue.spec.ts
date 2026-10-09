// The catalogue of candidate features is shown to the visitor, in a collapsible section on the Working tab.
import { expect, test } from "./fixtures";

test("a collapsible section lists all 19 features with their descriptions, closed by default", async ({ page }) => {
  await page.goto("/");
  const section = page.getByTestId("catalogue");
  await expect(section.locator("summary")).toHaveText("What the agent can choose from");
  expect(await section.evaluate((el) => (el as HTMLDetailsElement).open)).toBe(false);

  await section.locator("summary").click();
  const items = section.getByTestId("catalogue-item");
  await expect(items).toHaveCount(19);
  await expect(items.first()).toContainText("runs scored at the halfway mark");
  await expect(section).toContainText("Balls in the first 10 overs that went for no runs at all.");
  await expect(section).toContainText("Wickets still in hand after 10 overs: 10 minus the wickets lost.");
  await expect(section).toContainText("at most 8");
});

test("the section's text matches the API and is plain text", async ({ page }) => {
  const api = await (await page.request.get("/api/catalogue")).json();
  await page.goto("/");
  await page.getByTestId("catalogue").locator("summary").click();
  await expect(page.getByTestId("catalogue-item")).toHaveCount(api.features.length);
  const labels = await page.getByTestId("catalogue-item").locator("strong").allTextContents();
  expect(labels).toEqual(api.features.map((f: { label: string }) => f.label));
});
