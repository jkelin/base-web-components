import { defineConfig } from "vite";
import { minifyInlineAssets } from "./build/minify-inline-assets.ts";
import { staticHtmlPlugin } from "./build/static-html.ts";

const entries = {
  counter: "src/counter/index.ts",
  accordion: "src/accordion/index.ts",
  modal: "src/modal/index.ts",
  popover: "src/popover/index.ts",
  tooltip: "src/tooltip/index.ts",
  "preview-card": "src/preview-card/index.ts",
  menu: "src/menu/index.ts",
  "context-menu": "src/context-menu/index.ts",
  select: "src/select/index.ts",
  switch: "src/switch/index.ts",
  otp: "src/otp/index.ts",
  tabs: "src/tabs/index.ts",
  "slide-out": "src/slide-out/index.ts",
  "alert-dialog": "src/alert-dialog/index.ts",
  toast: "src/toast/index.ts",
  menubar: "src/menubar/index.ts",
  "navigation-menu": "src/navigation-menu/index.ts",
};

export default defineConfig({
  plugins: [minifyInlineAssets(), staticHtmlPlugin()],
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
            id.includes("virtual:bwc-static-html") ||
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
