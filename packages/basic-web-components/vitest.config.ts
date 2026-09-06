import { defineConfig } from "vitest/config";

export default defineConfig({
  // `source` + `development` first so microfw imports resolve to TypeScript
  // source; the library is never prebuilt for tests.
  resolve: {
    conditions: ["source", "development", "import", "module", "browser", "default"],
  },
  test: {
    environment: "happy-dom",
    include: ["src/**/*.test.ts", "build/**/*.test.ts"],
  },
});
