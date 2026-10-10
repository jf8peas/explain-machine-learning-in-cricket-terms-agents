import { expect, test, type Page } from "./fixtures";
import { afterRunOpen, countRunRequests, open, openTab, playToEnd, serveRun, sse, timelineItems } from "./helpers";

// The page's five tabs in the order of the process, the automatic move to What the agent found when the replay reaches
// its end, and the not-ready sentences and markers. Against the real app with the scripted fake model.

const TABS = ["data", "working", "found", "final-test", "try-your-own"] as const;
const LABELS = ["Data", "Working", "What the agent found", "The final test", "Try your own innings"];

const selected = (page: Page, id: string) => expect(page.getByTestId(`tab-${id}`)).toHaveAttribute("aria-selected", "true");
const heading = (page: Page, name: string) => page.getByRole("heading", { name, exact: true, level: 2 });
const panelOf = (page: Page, testid: string) =>
  page.getByTestId(testid).first().evaluate((el) => el.closest("[data-tab]")?.getAttribute("data-tab") ?? null);
/** Press Play and wait until the page has moved to What the agent found (the replay reached its end). */
async function playAndWaitForSwitch(page: Page) {
  await page.getByTestId("play").click();
  await expect(page.getByTestId("tab-found")).toHaveAttribute("aria-selected", "true", { timeout: 45_000 });
}

// ---------------- the tabs and the Working tab ----------------

test("five tabs in the order of the process, Data first, with the right names", async ({ page }) => {
  await open(page);
  const tabs = page.getByRole("tab");
  await expect(tabs).toHaveCount(5);
  await expect(tabs).toHaveText(LABELS);
  for (const [i, id] of TABS.entries()) await expect(tabs.nth(i)).toHaveAttribute("data-testid", `tab-${id}`);
});

test("on first load Working shows with the intro, picker, graph and summary, and none of the results", async ({ page }) => {
  await open(page);
  await selected(page, "working");
  for (const id of ["intro", "model-picker", "replay", "run-summary"]) await expect(page.getByTestId(id)).toBeVisible();
  await expect(page.getByTestId("run-summary")).toContainText("Results will appear here");
  for (const id of ["results", "results-final"]) await expect(page.getByTestId(id)).toBeHidden();
  await expect(page.getByTestId("results")).toBeEmpty();
  for (const id of ["leaderboard", "comparison", "explanation", "tryit"]) await expect(page.getByTestId(id)).not.toBeVisible();
});

test("every result of the old page is in exactly one tab after a run", async ({ page }) => {
  await open(page);
  await playToEnd(page);
  const where: Record<string, string> = {
    leaderboard: "found", model: "found", "model-used": "found", comparison: "final-test", "accuracy-table": "final-test",
    "accuracy-chart": "final-test", explanation: "final-test", verdict: "final-test", winner: "final-test",
    "expectations-note": "final-test", tryit: "try-your-own", "tryit-fields": "try-your-own", intro: "working",
    "model-picker": "working", catalogue: "working",
  };
  for (const [testid, tab] of Object.entries(where)) {
    const loc = page.getByTestId(testid);
    if ((await loc.count()) === 0) continue;                                    // "model" is not an id on this page
    const homes = await loc.evaluateAll((els) => els.map((el) => el.closest("[data-tab]")?.getAttribute("data-tab")));
    expect(new Set(homes), testid).toEqual(new Set([tab]));
  }
  expect(await panelOf(page, "rounds")).toBe("found");                           // the model's reasoning
  expect(await page.locator("graph-replay").evaluate((el) => el.closest("[data-tab]")?.getAttribute("data-tab"))).toBe("working");
});

// ---------------- links, Back and Forward, nothing lost ----------------

test("every tab opens from its own link", async ({ page }) => {
  for (const id of TABS) {
    await page.goto(`/#${id}`);
    await selected(page, id);
    await expect(page.locator(`[data-tab="${id}"]`)).toBeVisible();
  }
});

test("Back and Forward move between the tabs visited", async ({ page }) => {
  await open(page);
  await openTab(page, "found");
  await openTab(page, "final-test");
  await page.goBack();
  await selected(page, "found");
  await page.goBack();
  await selected(page, "working");
  await page.goForward();
  await selected(page, "found");
});

test("opening The final test before any run shows its not-ready sentence and a link to Working", async ({ page }) => {
  await page.goto("/#final-test");
  const sentence = page.locator('[data-tab="final-test"] [data-testid="not-ready"]');
  await expect(sentence).toBeVisible();
  await sentence.getByRole("link").click();
  await selected(page, "working");
});

test("each result tab shows one not-ready sentence with a link back to Working before a run, and can be opened", async ({ page }) => {
  await open(page);
  for (const id of ["found", "final-test"] as const) {
    await openTab(page, id);
    const sentence = page.locator(`[data-tab="${id}"] [data-testid="not-ready"]`);
    await expect(sentence).toBeVisible();
    await expect(sentence.getByRole("link")).toHaveAttribute("href", "#working");
  }
  await openTab(page, "try-your-own");
  await expect(page.getByTestId("tryit-hint")).toBeVisible();
  await expect(page.getByTestId("tryit-hint").getByRole("link")).toHaveAttribute("href", "#working");
});

test("switching tabs mid-run never restarts or pauses it, and playback advances while Working is hidden", async ({ page }) => {
  const runs = countRunRequests(page);
  await open(page, 200);
  await page.getByTestId("play").click();
  await expect(timelineItems(page)).not.toHaveCount(0);
  await openTab(page, "data");
  const atSwitch = await timelineItems(page).count();
  await expect.poll(() => timelineItems(page).count(), { timeout: 15_000 }).toBeGreaterThan(atSwitch);   // it carried on while hidden
  await openTab(page, "final-test");
  await openTab(page, "try-your-own");
  await expect(page.getByTestId("tab-found")).toHaveAttribute("aria-selected", "true", { timeout: 45_000 });    // and reached its end
  expect(runs.count()).toBe(1);
  await expect(page.locator("graph-replay")).toHaveAttribute("data-running", "false");
});

// ---------------- the automatic move to What the agent found ----------------

test("a full run moves to What the agent found at the end, with focus on its heading and an announcement", async ({ page }) => {
  await open(page);
  await playAndWaitForSwitch(page);
  await expect(page.locator('[data-tab="found"]')).toBeVisible();
  await expect(heading(page, "What the agent found")).toBeFocused();
  await expect(page.getByTestId("tab-live")).toHaveText("Now showing: What the agent found");
  await expect(page.getByTestId("leaderboard")).toBeVisible();
  await expect(page.getByTestId("to-final").getByRole("link")).toHaveAttribute("href", "#final-test");   // the way on to The final test
});

test("the switch waits for playback to reach the end, however long the visitor pauses", async ({ page }) => {
  const step = (n: number, node: string) => sse("step", { step: n, node, summary: `did ${node}`, changes: { k: n } });
  await serveRun(page, step(1, "load_data") + step(2, "split") + step(3, "explore") + sse("done", { steps: 3 }));
  await open(page, 60_000);
  await page.getByTestId("play").click();
  await expect(timelineItems(page)).toHaveCount(1);                              // the stream is complete; the display is paced
  await page.getByTestId("pause").click();
  await page.waitForTimeout(500);
  await selected(page, "working");
  await page.getByTestId("step").click();
  await expect(timelineItems(page)).toHaveCount(2);
  await selected(page, "working");                                               // one step before the end
  await page.getByTestId("step").click();
  await selected(page, "found");
  await expect(heading(page, "What the agent found")).toBeFocused();
});

test("stepping back and forward after the switch does not switch again", async ({ page }) => {
  await open(page);
  await playAndWaitForSwitch(page);
  await openTab(page, "working");
  await page.getByTestId("back").click();
  await page.getByTestId("step").click();
  await timelineItems(page).nth(3).click();
  await timelineItems(page).last().click();
  await page.waitForTimeout(500);
  await selected(page, "working");
});

test("being on the Data tab when the replay reaches its end still switches", async ({ page }) => {
  await open(page, 200);
  await page.getByTestId("play").click();
  await expect(timelineItems(page)).not.toHaveCount(0);
  await openTab(page, "data");
  await expect(page.getByTestId("tab-found")).toHaveAttribute("aria-selected", "true", { timeout: 45_000 });
});

test("a run whose data could not be loaded does not switch, and shows the error on Working", async ({ page }) => {
  await serveRun(page, sse("step", { step: 1, node: "load_data", summary: "no data",
    changes: { data_error: "The innings data could not be loaded." } }) + sse("done", { steps: 1 }));
  await open(page, 60);
  await page.getByTestId("play").click();
  await expect(page.getByTestId("data-error")).toHaveText("The innings data could not be loaded.");
  await page.waitForTimeout(700);
  await selected(page, "working");
  await expect(page.getByTestId("run-summary").getByTestId("data-error")).toBeVisible();
});

test("a run that ends with an error from the server does not switch", async ({ page }) => {
  await serveRun(page, sse("step", { step: 1, node: "load_data", summary: "ok", changes: {} })
    + sse("error", { message: "The run stopped because something failed." }));
  await open(page, 60);
  await page.getByTestId("play").click();
  await expect(page.getByTestId("status")).toContainText("something failed");
  await page.waitForTimeout(700);
  await selected(page, "working");
});

test("a run whose connection is lost does not switch, and the message stays on Working", async ({ page }) => {
  await serveRun(page, sse("step", { step: 1, node: "load_data", summary: "ok", changes: {} }));      // no `done`
  await open(page, 60);
  await page.getByTestId("play").click();
  await expect(page.getByTestId("status")).toContainText("connection was lost");
  await page.waitForTimeout(700);
  await selected(page, "working");
  await expect(page.getByTestId("status")).toBeVisible();
});

test("a language model that did not take part: What the agent found says so and the switch still happens", async ({ page }) => {
  await open(page);
  await page.getByTestId("model-select").selectOption({ label: "Unreliable" });
  await playAndWaitForSwitch(page);
  await expect(page.getByTestId("llm-notice")).toContainText("did not take part");
  await expect(page.getByTestId("attempt-row").first()).toBeVisible();            // the rival's results
});

// ---------------- markers, readiness and a new run ----------------

test("markers appear when tabs become ready, with a non-colour cue, and clear when the tab is opened", async ({ page }) => {
  await open(page, 200);
  await page.getByTestId("play").click();
  const found = page.getByTestId("tab-found");
  await expect(found.locator(".ts-marker")).toHaveCount(1, { timeout: 30_000 });   // ready mid-run, and the visitor is on Working
  await expect(found).toContainText("new results");                                // hidden text, so it is not colour alone
  await expect(page.getByTestId("tab-working")).not.toContainText("new results");
  await expect(page.getByTestId("tab-found")).toHaveAttribute("aria-selected", "true", { timeout: 45_000 });
  await expect(found.locator(".ts-marker")).toHaveCount(0);                        // taken there: no marker left on it
  for (const id of ["final-test", "try-your-own"]) await expect(page.getByTestId(`tab-${id}`).locator(".ts-marker")).toHaveCount(1);
  await openTab(page, "final-test");
  await expect(page.getByTestId("tab-final-test").locator(".ts-marker")).toHaveCount(0);
  await expect(page.getByTestId("tab-try-your-own").locator(".ts-marker")).toHaveCount(1);
});

test("What the agent found fills in as steps are shown, and The final test only when its step is shown", async ({ page }) => {
  await open(page, 300);
  await page.getByTestId("play").click();
  await openTab(page, "found");
  await expect(page.getByTestId("attempt-row").first()).toBeVisible({ timeout: 30_000 });
  await expect(page.locator('[data-tab="found"] [data-testid="not-ready"]')).toBeHidden();
  await expect(page.getByTestId("comparison")).toHaveCount(0);                     // not shown yet
  await expect(page.locator('[data-tab="final-test"] [data-testid="not-ready"]')).toBeAttached();
});

test("stepping back before The final test's step shows its sentence again; its marker stays until opened", async ({ page }) => {
  await open(page);
  await playToEnd(page);
  await expect(page.getByTestId("tab-final-test").locator(".ts-marker")).toHaveCount(1);
  const names = (await timelineItems(page).allTextContents()).map((t) => t.replace(/^\d+\.\s*/, ""));
  await timelineItems(page).nth(names.indexOf("baseline")).click();
  await expect(page.locator('[data-tab="final-test"] [data-testid="not-ready"]')).toBeAttached();
  await expect(page.getByTestId("tab-final-test").locator(".ts-marker")).toHaveCount(1);
  await openTab(page, "final-test");
  await expect(page.locator('[data-tab="final-test"] [data-testid="not-ready"]')).toBeVisible();
});

test("opening a result tab mid-run shows what is ready so far", async ({ page }) => {
  await open(page, 400);
  await page.getByTestId("play").click();
  await openTab(page, "final-test");
  await expect(page.locator('[data-tab="final-test"] [data-testid="not-ready"]')).toBeVisible();
  await openTab(page, "found");
  await expect(page.getByTestId("attempt-row").first()).toBeVisible({ timeout: 30_000 });
});

test("a new run on a result tab returns the results tabs to not ready, leaves the visitor there, and switches again at its end", async ({ page }) => {
  await open(page);
  await playAndWaitForSwitch(page);
  await openTab(page, "working");
  await page.getByTestId("play").click();                                         // a second run
  await openTab(page, "final-test");
  await expect(page.locator('[data-tab="final-test"] [data-testid="not-ready"]')).toBeVisible();   // reset by the new run
  await page.waitForTimeout(400);
  await selected(page, "final-test");                                              // the visitor was not moved
  await expect(page.getByTestId("tab-found")).toHaveAttribute("aria-selected", "true", { timeout: 45_000 });   // and the new end moves them
});

test("what the visitor typed in Try your own innings survives switching tabs and a new run", async ({ page }) => {
  await open(page);
  await playToEnd(page);
  await openTab(page, "try-your-own");
  await page.locator('input[name="runs_at_10"]').fill("84");
  await openTab(page, "data");
  await openTab(page, "try-your-own");
  await expect(page.locator('input[name="runs_at_10"]')).toHaveValue("84");
  await openTab(page, "working");
  await page.getByTestId("play").click();
  await expect(page.getByTestId("tab-found")).toHaveAttribute("aria-selected", "true", { timeout: 45_000 });
  await openTab(page, "try-your-own");
  await expect(page.locator('input[name="runs_at_10"]')).toHaveValue("84");
});

// ---------------- keyboard, screen readers, phone, motion ----------------

test("the tabs are reachable by keyboard alone, and each opens its panel with its heading", async ({ page }) => {
  await open(page);
  await page.getByTestId("tab-working").focus();
  for (const [key, id, title] of [["ArrowRight", "found", "What the agent found"], ["ArrowRight", "final-test", "The final test"],
                                  ["ArrowRight", "try-your-own", "Try your own innings"], ["Home", "data", ""], ["End", "try-your-own", "Try your own innings"]]) {
    await page.keyboard.press(key);
    await selected(page, id);
    await expect(page.locator(`[data-tab="${id}"]`)).toBeVisible();
    if (title) await expect(heading(page, title)).toBeVisible();
  }
  await expect(page.getByRole("tablist")).toHaveAttribute("aria-label", "Page sections");
});

test("at phone width all five tabs are reachable inside the tab bar and the page never scrolls sideways", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await open(page);
  const noSideScroll = () => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
  expect(await noSideScroll()).toBe(true);
  const bar = page.getByRole("tablist");
  expect(await bar.evaluate((el) => getComputedStyle(el).overflowX)).toBe("auto");
  for (const id of TABS) {
    await page.getByTestId(`tab-${id}`).scrollIntoViewIfNeeded();
    await openTab(page, id);
    expect(await noSideScroll(), id).toBe(true);
    const inView = await page.getByTestId(`tab-${id}`).evaluate((tab) => {
      const bar = tab.parentElement!;
      return (tab as HTMLElement).offsetLeft >= bar.scrollLeft - 1 && (tab as HTMLElement).offsetLeft + (tab as HTMLElement).offsetWidth <= bar.scrollLeft + bar.clientWidth + 1;
    });
    expect(inView, `${id} in view`).toBe(true);
  }
});

test("nothing about switching tabs or the markers is animated", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await open(page);
  await playAndWaitForSwitch(page);
  const motion = await page.evaluate(() => {
    const els = [document.querySelector("tab-set")!, ...document.querySelectorAll('[role="tab"], .ts-marker, [role="tablist"]')];
    return els.map((el) => { const cs = getComputedStyle(el); return [cs.animationName, cs.transitionDuration]; });
  });
  for (const [animation, transition] of motion) {
    expect(animation).toBe("none");
    expect(["0s", ""]).toContain(transition);
  }
  expect(await page.getByTestId("tab-found").evaluate((el) => (el as HTMLElement).getAnimations({ subtree: true }).length)).toBe(0);
});

test("after a run, a result tab can be opened from What the agent found, and the Working tab still holds the finished run", async ({ page }) => {
  await open(page);
  await playAndWaitForSwitch(page);
  await page.getByTestId("to-final").getByRole("link").click();
  await selected(page, "final-test");
  await expect(page.getByTestId("comparison")).toBeVisible();
  await afterRunOpen(page, "working").catch(() => openTab(page, "working"));
  await expect(page.getByTestId("run-summary")).toContainText("Best setup so far");
  await expect(page.getByTestId("run-summary").getByRole("link")).toHaveAttribute("href", "#found");
});
