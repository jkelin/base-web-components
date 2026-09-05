import { defineConfig } from "vite";

export default defineConfig({
  build: {
    outDir: "dist/showcase",
    target: "es2022",
    minify: "oxc",
  },
});
