import { defineConfig } from "vite";

export default defineConfig({
  build: {
    target: "es2022",
    minify: "oxc",
    rolldownOptions: {
      output: {
        // Standalone script, never re-bundled: full minify incl. whitespace is safe.
        // (Vite skips whitespace in ES lib mode to preserve pure annotations.)
        minify: true,
      },
    },
    lib: {
      entry: "src/index.ts",
      formats: ["es"],
      fileName: "vanilla-counter",
    },
  },
});
