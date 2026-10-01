import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 60_000,
  fullyParallel: true,
  retries: 0,
  use: { baseURL: "http://127.0.0.1:5173", trace: "retain-on-failure" },
  webServer: [
    {
      // The API: the real agent on the committed data.
      command: "uv run uvicorn api.index:app --port 8000",
      cwd: "..",
      url: "http://127.0.0.1:8000/api/structure",
      reuseExistingServer: true,
      timeout: 120_000,
    },
    {
      // The page (Vite proxies /api to the API above).
      command: "npm run dev -- --host 127.0.0.1",
      url: "http://127.0.0.1:5173",
      reuseExistingServer: true,
      timeout: 60_000,
    },
  ],
});
