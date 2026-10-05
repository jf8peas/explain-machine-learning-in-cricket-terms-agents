// Every test gets its own "visitor": a unique X-Forwarded-For address, so the per-visitor run limits never refuse
// tests that start several runs. Specs import `test` and `expect` from here instead of from @playwright/test.
import { createHash } from "node:crypto";
import { test as base, expect } from "@playwright/test";

export { expect };
export type { Page } from "@playwright/test";

/** A stable, unique private IPv4 address for a test. */
export function visitorFor(testId: string, salt = ""): string {
  const h = createHash("sha256").update(testId + salt).digest();
  return `10.${h[0]}.${h[1]}.${h[2] || 1}`;
}

export const test = base.extend({
  context: async ({ context }, use, testInfo) => {
    await context.setExtraHTTPHeaders({ "X-Forwarded-For": visitorFor(testInfo.testId) });
    await use(context);
  },
});
