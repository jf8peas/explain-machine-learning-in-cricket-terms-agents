import { expect, test } from "./fixtures";
import { open } from "./helpers";

// The writing step of "In cricket terms" (features 012 and 015) as the graph shows it. What the final test tab shows of the
// section (the verdict, the takeaways, the rule of thumb, the wording label and the fallbacks) is tested in final.spec.ts.
// Against the real app with the scripted fake model; no test calls a real model.

test("the graph shows the writing step as a language-model step in stage 8, after the code step", async ({ page }) => {
  await open(page);
  const write = page.locator('[data-node="write_in_cricket_terms"]');
  await expect(write).toHaveClass(/actor-llm/);
  await expect(write.locator(".actor-tag")).toHaveText("LLM");
  await expect(page.locator('[data-node="explain_in_cricket_terms"]')).toHaveClass(/actor-code/);
  await expect(write.getByTestId("stage-badge").locator("text")).toHaveText("8");
  await expect(page.locator('[data-edge="explain_in_cricket_terms->write_in_cricket_terms"]')).toHaveCount(1);
  await expect(page.locator('[data-edge="write_in_cricket_terms->__end__"]')).toHaveCount(1);
});
