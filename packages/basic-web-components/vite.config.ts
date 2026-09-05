import { defineConfig } from "vite";

const entries = {
  counter: "src/counter/index.ts",
  accordion: "src/accordion/index.ts",
  modal: "src/modal/index.ts",
  popover: "src/popover/index.ts",
  switch: "src/switch/index.ts",
  otp: "src/otp/index.ts",
  tabs: "src/tabs/index.ts",
};

export default defineConfig({
  // `source` + `development` first so the shared microfw/alien runtime resolves
  // to TypeScript source and bundles exactly once into shared.js.
  resolve: {
    conditions: ["source", "development", "import", "module", "browser", "default"],
  },
  build: {
    target: "es2022",
    // Native Rolldown full minify, matching microfw: Vite's oxc pass is redundant
    // alongside rolldown output minify.
    minify: false,
    rolldownOptions: {
      output: {
        entryFileNames: "[name].js",
        chunkFileNames: "shared.js",
        manualChunks(id: string) {
          if (
            id.includes("/src/shared/") ||
            id.includes("packages/microfw/") ||
            id.includes("node_modules")
          )
            return "shared";
        },
        minify: true,
      },
    },
    lib: {
      entry: entries,
      formats: ["es"],
    },
  },
});
