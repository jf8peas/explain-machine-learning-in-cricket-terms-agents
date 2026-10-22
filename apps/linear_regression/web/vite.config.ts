import { resolve } from "node:path";
import { defineConfig } from "vite";

export default defineConfig({
  server: {
    port: 5173,
    proxy: { "/api": "http://127.0.0.1:8000" },
  },
  // Two pages: the app and the "How this app was built" page (served as /under-the-hood.html).
  build: {
    outDir: "dist",
    rollupOptions: {
      input: {
        main: resolve(__dirname, "index.html"),
        underTheHood: resolve(__dirname, "under-the-hood.html"),
      },
    },
  },
  test: { include: ["tests/unit/**/*.test.ts"], setupFiles: ["tests/unit/setup-terms.ts"] },
});
