import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

// `source` + `development` first so dev imports resolve the library's
// TypeScript entries directly; the library is never prebuilt for smoke.
export default defineConfig({
  plugins: [tailwindcss()],
  resolve: {
    conditions: ["source", "development", "import", "module", "browser", "default"],
  },
  optimizeDeps: {
    exclude: ["basic-web-components"],
  },
  server: {
    host: "127.0.0.1",
    port: 5173,
  },
  preview: {
    host: "127.0.0.1",
    port: 4173,
  },
});
