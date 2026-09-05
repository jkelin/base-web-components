import { defineConfig } from "vite";

export default defineConfig({
  build: {
    target: "es2022",
    // Native Rolldown full minify: Vite's oxc pass leaves whitespace in lib output.
    minify: false,
    rolldownOptions: {
      output: {
        minify: true,
      },
    },
    lib: {
      entry: "src/main.ts",
      fileName: () => "microfw.js",
      formats: ["es"],
    },
  },
});
