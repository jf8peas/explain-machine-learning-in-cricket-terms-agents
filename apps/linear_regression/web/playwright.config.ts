import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 60_000,
  fullyParallel: true,
  // One API process serves every test and each full run is CPU work, so too many workers made the heaviest tests
  // (six runs each) time out. Eight keeps the suite quick without that.
  workers: 8,
  retries: 0,
  use: { baseURL: "http://127.0.0.1:5173", trace: "retain-on-failure" },
  webServer: [
    {
      // The API: the real agent on the committed data, with the SCRIPTED FAKE language model (no network, no key) and
      // an in-process limit store. A fresh server every run (reuseExistingServer is false) so the in-memory counters
      // start empty; stop any API you left running on port 8000 first. The fake knows these model ids (see
      // linreg/llm_fake.py): fake/steady (the default), fake/quick, fake/slow, fake/markup, fake/broken, fake/timeout.
      command: "uv run uvicorn api.index:app --port 8000",
      cwd: "..",
      url: "http://127.0.0.1:8000/api/structure",
      reuseExistingServer: false,
      timeout: 120_000,
      env: {
        ...(process.env as Record<string, string>),
        LLM_PROVIDER: "fake",
        RATE_LIMIT_STORE: "memory",
        RUN_LIMIT_PER_HOUR: "5",
        RUN_LIMIT_PER_DAY: "1000000",
        RUN_DEADLINE_SECONDS: "80",
        OPENROUTER_API_KEY: "",
      },
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
