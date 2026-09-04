import { defineConfig } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";

export default defineConfig({
  plugins: [
    svelte({
      compilerOptions: {
        customElement: true,
      },
    }),
  ],
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
      fileName: "svelte-counter",
    },
  },
});
