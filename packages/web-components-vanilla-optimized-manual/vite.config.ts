import { defineConfig } from "vite";

export default defineConfig({
  build: {
    target: "es2022",
    minify: "oxc",
    rolldownOptions: {
      output: {
        // This self-registering final bundle can safely use full whitespace minification.
        minify: true,
      },
    },
    lib: {
      entry: "src/index.ts",
      formats: ["es"],
      fileName: "optimized-counter",
    },
  },
});
