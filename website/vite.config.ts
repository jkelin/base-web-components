import tailwindcss from "@tailwindcss/vite";
import solid from "vite-plugin-solid";
import { defineConfig, type Connect, type Plugin } from "vite";
import { docsPrerender } from "./src/prerender.ts";

// Raw README routes (/<slug>.md) must serve as text/markdown regardless of
// the static host's default MIME map; dev and preview set it explicitly.
function markdownContentType(): Plugin {
  const serve: Connect.NextHandleFunction = (req, res, next) => {
    const url = req.url ?? "";
    if ((url.split("?")[0] ?? "").endsWith(".md")) {
      res.setHeader("Content-Type", "text/markdown; charset=utf-8");
    }
    next();
  };
  return {
    name: "markdown-content-type",
    configureServer(server) {
      server.middlewares.use(serve);
    },
    configurePreviewServer(server) {
      server.middlewares.use(serve);
    },
  };
}

// Pages, markdown, and llms.txt are emitted by the docs-prerender plugin:
// `vite build` writes them into dist/ via generateBundle (client entries
// resolve to hashed chunks), `vite dev` serves them from memory. No
// prerendered files live in the website tree.
export default defineConfig({
  // Relative asset URLs so the prerendered site works from any base path,
  // including username.github.io/<repo>/ project Pages (default "/" 404s
  // assets there). All shell hrefs/chunk/css emits are already ./-relative.
  base: "./",
  plugins: [
    markdownContentType(),
    docsPrerender(),
    tailwindcss(),
    solid({ solid: { moduleName: "@solidjs/web" } }),
  ],
  resolve: {
    // TypeScript entries directly (package subpaths, never dist paths).
    conditions: ["source", "development", "import", "module", "browser", "default"],
  },
  optimizeDeps: {
    exclude: ["basic-web-components", "microfw"],
  },
  // All public assets (markdown, llms.txt) come from the prerender plugin;
  // nothing is copied from a public/ directory.
  publicDir: false,
});
