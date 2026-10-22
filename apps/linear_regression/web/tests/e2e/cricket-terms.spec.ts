import { expect, test } from "./fixtures";
import { open } from "./helpers";

// The writing step of "In cricket terms" (features 012 and 015) as the graph shows it. What the verdict shows of the section (the
// rule of thumb and the takeaways) is tested in verdict.spec.ts. Against the real app with the scripted fake model; no test
// calls a real model.

test("the graph shows the writing step as a language-model step in stage 8, after the code step", async ({ page }) => {
  await open(page);
  const write = page.locator('[data-node="write_in_cricket_terms"]');
  await expect(write).toHaveClass(/actor-llm/);
  await expect(write.locator(".actor-tag")).toHaveText("AI");
  await expect(page.locator('[data-node="explain_in_cricket_terms"]')).toHaveClass(/actor-code/);
  await expect(write.getByTestId("stage-badge")).toHaveText("8");
  const end = page.locator('graph-replay [data-row="end"] [data-node]');
  expect(await end.evaluateAll((els) => els.map((e) => e.getAttribute("data-node")))).toEqual(["final_test", "explain_in_cricket_terms", "write_in_cricket_terms"]);
});
