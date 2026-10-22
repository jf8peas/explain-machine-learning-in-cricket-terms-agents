// The link preview (feature 020): LinkedIn's crawler does not run scripts, so the tags are in the page's own HTML, worded for the winning
// case, whatever the run says. They are read here from the raw HTML the server sends.
import { expect, test } from "./fixtures";

const tag = (html: string, attr: string, name: string) => new RegExp(`<meta ${attr}="${name}" content="([^"]*)"`).exec(html)?.[1];

test("the tags are in the raw HTML with no script run, and match the hero's winning wording", async ({ request }) => {
  const html = await (await request.get("/")).text();
  expect(tag(html, "property", "og:title")).toBe("An AI agent built its own prediction model. Then it beat the TV.");
  expect(tag(html, "property", "og:description")).toMatch(/^Halfway through a T20 innings, where will it finish\?/);
  expect(tag(html, "property", "og:type")).toBe("website");
  expect(tag(html, "name", "twitter:card")).toBe("summary");
  expect(tag(html, "property", "og:url")).toMatch(/^https:\/\/[^/\s]+\/\S*$/);          // absolute, from the one setting
  expect(html).not.toContain("%VITE_APP_URL%");                                          // filled in at build, never left as a placeholder
  expect(html).not.toMatch(/og:image|twitter:image/);                                    // artwork comes later
  expect(html).toMatch(/<title>[^<]+<\/title>/);
});

test("the tags do not change with the run: a recording where the TV held on leaves them as they are", async ({ page }) => {
  await page.route("**/recorded-run.json", async (route) => {
    const res = await route.fetch();
    const run = await res.json();
    const step = run.events.find((e: { node: string }) => e.node === "final_test");
    step.changes.final.headlines = { ...step.changes.final.headlines, case: "held", hero_h1: "An AI agent built its own prediction model. The TV held on this time." };
    await route.fulfill({ json: run });
  });
  await page.goto("/");
  await expect(page.getByTestId("hero-title")).toHaveText(/The TV held on this time/);
  expect(await page.locator('meta[property="og:title"]').getAttribute("content")).toBe("An AI agent built its own prediction model. Then it beat the TV.");
});
