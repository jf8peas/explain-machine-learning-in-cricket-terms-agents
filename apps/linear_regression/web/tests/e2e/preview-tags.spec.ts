// The link preview (features 020 and 022): LinkedIn's crawler does not run scripts, so the tags are in the page's own HTML, worded as
// the question the page asks, whatever the run says. They are read here from the raw HTML the server sends.
import { expect, test } from "./fixtures";
import { finishRun } from "./helpers";

const tag = (html: string, attr: string, name: string) => new RegExp(`<meta ${attr}="${name}" content="([^"]*)"`).exec(html)?.[1];

test("the tags are in the raw HTML with no script run, and are the question", async ({ request }) => {
  const html = await (await request.get("/")).text();
  expect(tag(html, "property", "og:title")).toBe("Can an AI agent beat the broadcaster's projected score?");
  expect(tag(html, "property", "og:description")).toMatch(/^Halfway through a T20 innings, where will it finish\?/);
  expect(tag(html, "property", "og:description")).toContain("Choose an AI, press play and watch it try");
  expect(tag(html, "property", "og:type")).toBe("website");
  expect(tag(html, "name", "twitter:card")).toBe("summary");
  expect(tag(html, "property", "og:url")).toMatch(/^https:\/\/[^/\s]+\/\S*$/);          // absolute, from the one setting
  expect(html).not.toContain("%VITE_APP_URL%");                                          // filled in at build, never left as a placeholder
  expect(html).not.toMatch(/og:image|twitter:image/);                                    // artwork comes later
  expect(html).toMatch(/<title>[^<]+<\/title>/);
});

test("the tags do not change with the run: after a run the title is still the question", async ({ page }) => {
  await page.goto("/?interval=40");
  await finishRun(page);
  expect(await page.locator('meta[property="og:title"]').getAttribute("content")).toBe("Can an AI agent beat the broadcaster's projected score?");
});
