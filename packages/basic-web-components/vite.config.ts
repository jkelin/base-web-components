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
  build: {
    target: "es2022",
    minify: "oxc",
    rolldownOptions: {
      output: {
        entryFileNames: "[name].js",
        chunkFileNames: "shared.js",
        manualChunks(id: string) {
          if (id.includes("/src/shared/") || id.includes("node_modules")) return "shared";
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
