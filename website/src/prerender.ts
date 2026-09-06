// Docs prerender as a Vite plugin (replaces the old `bun scripts/generate.ts`
// step): reads each component README, renders it to HTML with shiki syntax
// highlighting, and emits one static HTML file per page plus the markdown
// sources and llms.txt.
//
// - `vite build`: page/markdown assets are emitted into dist/ via
//   `generateBundle` (client scripts resolve to their hashed chunk names),
//   so dist/ is the only place generated artefacts live.
// - `vite dev`: a middleware serves the same pages from memory with dev
//   script tags (`/@vite/client` preamble via transformIndexHtml), so
//   navigation, markdown, and llms.txt all work without a prior build.
// Run via `bun run build` / `bun run dev`.
import { readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { marked, type RendererObject, type Token } from "marked";
import { createHighlighter, type Highlighter } from "shiki";
import type { Plugin } from "vite";
import { COMPONENTS } from "./site.ts";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const LIB = resolve(ROOT, "..", "packages", "basic-web-components", "src");

const LIGHT_THEME = "github-light";
const DARK_THEME = "github-dark";
const CODE_LANGS = ["html", "js", "ts", "bash", "shell", "json", "css", "diff", "text"] as const;

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/<[^>]*>/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

interface DocSource {
  slug: string;
  markdown: string;
  title: string;
  description: string;
  fromReadme: boolean;
}

function firstParagraph(markdown: string): string | undefined {
  const body = markdown.split(/\n#{1,6}\s/)[0];
  if (!body) return undefined;
  const withoutTitle = body.replace(/^#\s+.+\n/, "");
  const withoutCode = withoutTitle.split("```")[0];
  if (!withoutCode) return undefined;
  return withoutCode
    .split("\n\n")
    .map((block: string) => block.trim())
    .find((block: string) => block.length > 0 && !block.startsWith("```"));
}

async function loadDoc(
  slug: string,
  tag: string,
  subpath: string,
  blurb: string,
): Promise<DocSource> {
  try {
    const markdown = await readFile(join(LIB, slug, "README.md"), "utf8");
    const titleMatch = /^#\s+(.+)$/m.exec(markdown);
    const title = titleMatch?.[1]?.trim() ?? tag;
    const paragraph = firstParagraph(markdown);
    return {
      slug,
      markdown,
      title,
      description: paragraph?.replace(/\s+/g, " ") ?? blurb,
      fromReadme: true,
    };
  } catch {
    // Missing README: stub from the component contract, never block the build.
    const markdown = `# ${tag}\n\n${blurb}\n\n\`\`\`js\nimport "${subpath}";\n\`\`\`\n\nFull documentation is on its way; the live example above mirrors the README.`;
    return { slug, markdown, title: tag, description: blurb, fromReadme: false };
  }
}

function highlightCode(highlighter: Highlighter, text: string, lang: string | undefined): string {
  const language =
    lang !== undefined && (CODE_LANGS as readonly string[]).includes(lang) ? lang : "text";
  try {
    return highlighter.codeToHtml(text, {
      lang: language,
      themes: { light: LIGHT_THEME, dark: DARK_THEME },
    });
  } catch {
    return `<pre class="shiki"><code>${escapeHtml(text)}</code></pre>`;
  }
}
function collectCodeBlocks(tokens: Array<Token>, into: Array<Token>): void {
  for (const token of tokens) {
    if (token.type === "code") {
      into.push(token);
    }
    if ("tokens" in token && Array.isArray(token.tokens)) {
      collectCodeBlocks(token.tokens as Array<Token>, into);
    }
    if ("items" in token && Array.isArray(token.items)) {
      for (const item of token.items as Array<{ tokens?: Array<Token> }>) {
        if (item.tokens) collectCodeBlocks(item.tokens, into);
      }
    }
  }
}

function createRenderer(highlighted: ReadonlyMap<string, string>): RendererObject {
  return {
    code({ text, lang }) {
      // Every fenced block was highlighted up front; the fallback keeps the
      // shiki class so no <pre> renders unstyled in either theme.
      return (
        highlighted.get(`${lang ?? ""}\n${text}`) ??
        `<pre class="shiki"><code>${escapeHtml(text)}</code></pre>`
      );
    },
    heading({ tokens, depth }) {
      const inline = this.parser.parseInline(tokens);
      return `<h${depth} id="${slugify(inline)}">${inline}</h${depth}>`;
    },
  };
}

// API tables: wrap in a scroll region so narrow screens scroll horizontally
// instead of squeezing columns. (Post-process, not a marked table override,
// so the default table renderer stays untouched.)
function wrapTables(html: string): string {
  return html
    .replaceAll(
      "<table>",
      `<div class="doc-table-wrap" role="region" aria-label="Scrollable table" tabindex="0"><table>`,
    )
    .replaceAll("</table>", "</table></div>");
}

const THEME_INIT = `<script>(function(){try{var t=localStorage.getItem("bwc-theme");if(t==="dark"||(!t&&window.matchMedia("(prefers-color-scheme: dark)").matches)){document.documentElement.classList.add("dark");}}catch(e){}})();</script>`;

// Critical shell styles, inline before paint: page background (no white
// flash in dark mode), pre-upgrade slide-out hiding, responsive
// sidebar/hamburger visibility, and the 100ms content-only fade. Everything
// else arrives via Tailwind; noscript keeps the sidebar usable.
const CRITICAL_CSS = `<style>html{background-color:#fafaf9}html.dark{background-color:#0c0a09}#main{transition:opacity 100ms ease-out}@media (prefers-reduced-motion:reduce){#main{transition:none}}bwc-slide-out:not(:defined)>[slot="panel"]{display:none}@media (max-width:1023.5px){#sidebar{display:none}}@media (min-width:1024px){#site-menu{display:none}}</style>`;
const NOSCRIPT_CSS = `<noscript><style>#sidebar{display:block !important}#site-menu{display:none !important}</style></noscript>`;

function sidebar(active: string): string {
  const link = (href: string, label: string, current: boolean, mono = false) =>
    `<li><a href="${href}" ${current ? 'aria-current="page" ' : ""}data-testid="nav-${href === "./" ? "overview" : href.replace("./", "").replace(".html", "")}" class="block rounded-md px-3 py-2 text-sm transition ${current ? "bg-stone-900 font-semibold text-white dark:bg-stone-100 dark:text-stone-900" : "text-stone-600 hover:bg-stone-200/70 hover:text-stone-900 dark:text-stone-400 dark:hover:bg-stone-800 dark:hover:text-stone-100"} ${mono ? "font-mono text-[13px]" : ""}">${label}</a></li>`;
  const items = COMPONENTS.map((component) =>
    link(
      `./${component.slug}.html`,
      `${component.title} · ${component.tag}`,
      active === component.slug,
      true,
    ),
  ).join("\n");
  return `<nav aria-label="Components" class="min-w-0">
  <p class="px-3 text-[11px] font-semibold tracking-[0.14em] text-stone-400 uppercase select-none dark:text-stone-500">Components</p>
  <ul class="mt-2 space-y-0.5">
    ${link("./", "Overview", active === "index")}
    ${items}
  </ul>
</nav>`;
}

// Mobile menu panel: the same prerendered links as the desktop sidebar, so
// navigation works with and without JS (no-JS readers use the noscript
// sidebar instead; the hamburger trigger is inert until upgrade).
function mobileMenu(active: string): string {
  return `<bwc-slide-out id="site-menu" data-testid="site-menu" class="lg:hidden">
  <button slot="trigger" id="menu-button" data-testid="menu-button" type="button" aria-label="Open menu" class="flex min-h-11 min-w-11 cursor-pointer items-center justify-center rounded-md border border-stone-300 bg-white px-2 text-base transition hover:bg-stone-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stone-900 dark:border-stone-700 dark:bg-stone-900 dark:hover:bg-stone-800">☰</button>
  <div slot="panel" id="menu-panel" data-testid="menu-panel" class="overflow-y-auto bg-white p-4 dark:bg-stone-900">
    <div class="mb-3 flex items-center justify-between gap-2">
      <span class="font-mono text-sm font-semibold">basic-web-components</span>
      <button data-close id="menu-close" data-testid="menu-close" type="button" aria-label="Close menu" class="min-h-11 min-w-11 cursor-pointer rounded-md border border-stone-300 px-2 text-base transition hover:bg-stone-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stone-900 dark:border-stone-700 dark:hover:bg-stone-800">✕</button>
    </div>
    ${sidebar(active)}
  </div>
</bwc-slide-out>`;
}

function shell(options: {
  title: string;
  description: string;
  active: string;
  main: string;
  /** Extra head content (build stylesheet links; empty in dev). */
  head: string;
  /** Client script tags: dev entries in serve mode, hashed chunks in build. */
  scripts: string;
}): string {
  const markdownHref = options.active === "index" ? "./index.md" : `./${options.active}.md`;
  // Sidebar: top-89px equals the in-flow offset (57px sticky header + 32px
  // grid pt), so the nav is pixel-identical scrolled or not. The -ml-3
  // wrapper cancels the links px-3, aligning link text with the header icon.
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<meta name="description" content="${escapeHtml(options.description)}" />
<title>${escapeHtml(options.title)} · basic-web-components</title>
${options.head}${THEME_INIT}
${CRITICAL_CSS}
${NOSCRIPT_CSS}
</head>
<body class="min-h-screen bg-stone-50 text-stone-900 antialiased dark:bg-stone-950 dark:text-stone-100">
<a href="#main" class="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:rounded focus:bg-stone-900 focus:px-3 focus:py-1 focus:text-white">Skip to content</a>
<header class="sticky top-0 z-10 border-b border-stone-200 bg-stone-50/90 dark:border-stone-800 dark:bg-stone-950/90">
  <div class="mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
    <a href="./" data-testid="nav-home" class="flex min-w-0 items-center gap-2">
      <span aria-hidden="true" class="flex size-7 items-center justify-center rounded-md bg-stone-900 font-mono text-sm font-bold text-white dark:bg-stone-100 dark:text-stone-900">b</span>
      <span data-testid="nav-wordmark" class="hidden truncate font-mono text-sm font-semibold sm:block">basic-web-components</span>
    </a>
    <div class="flex items-center gap-2">
      <a id="nav-markdown" href="${markdownHref}" data-testid="nav-markdown" class="hidden rounded-md px-2 py-1 font-mono text-xs text-stone-500 hover:text-stone-900 sm:block dark:text-stone-400 dark:hover:text-stone-100">${options.active}.md</a>
      <a href="./llms.txt" data-testid="nav-llms" class="hidden rounded-md px-2 py-1 font-mono text-xs text-stone-500 hover:text-stone-900 sm:block dark:text-stone-400 dark:hover:text-stone-100">llms.txt</a>
      <div id="theme-toggle-mount" data-testid="theme-toggle-mount"></div>
      ${mobileMenu(options.active)}
    </div>
  </div>
</header>
<div class="mx-auto grid max-w-6xl grid-cols-1 gap-8 px-4 py-8 sm:px-6 lg:grid-cols-[240px_minmax(0,1fr)]">
  <aside id="sidebar" class="hidden lg:sticky lg:top-[89px] lg:block lg:self-start"><div class="-ml-3">${sidebar(options.active)}</div></aside>
  <main id="main" data-page="${options.active}" class="min-w-0">${options.main}</main>
</div>
<footer class="border-t border-stone-200 dark:border-stone-800">
  <p class="mx-auto max-w-6xl px-4 py-6 font-mono text-xs text-stone-500 sm:px-6 dark:text-stone-400">basic-web-components docs · static prerender · <a class="underline underline-offset-2" href="./llms.txt" data-testid="nav-llms-footer">llms.txt</a></p>
</footer>
${options.scripts}</body>
</html>
`;
}

function demoCard(
  slug: string,
  tag: string,
  demo: string,
  demoHighlighted: string,
  readoutInitial: string,
): string {
  // Preview/Code toggle: two native buttons (keyboard accessible) flipping
  // `hidden` on the panes, so the live demo keeps its DOM state when
  // switching back. The code pane reuses the shiki pipeline at build time —
  // no client highlighter. `demo` is the exact source shown in Code.
  return `<section aria-label="Live example" class="overflow-hidden rounded-xl border border-stone-200 bg-white dark:border-stone-800 dark:bg-stone-900">
  <div class="flex flex-wrap items-center justify-between gap-2 border-b border-stone-200 px-4 py-2.5 dark:border-stone-800">
    <h2 class="text-xs font-semibold tracking-[0.12em] text-stone-500 uppercase select-none dark:text-stone-400">Live example</h2>
    <div role="group" aria-label="Demo view" class="flex items-center gap-1">
      <button type="button" id="demo-${slug}-toggle-preview" data-testid="demo-${slug}-toggle-preview" data-demo-toggle="${slug}" data-demo-view="preview" aria-pressed="true" aria-controls="demo-${slug}-preview demo-${slug}-code" class="demo-toggle">Preview</button>
      <button type="button" id="demo-${slug}-toggle-code" data-testid="demo-${slug}-toggle-code" data-demo-toggle="${slug}" data-demo-view="code" aria-pressed="false" aria-controls="demo-${slug}-preview demo-${slug}-code" class="demo-toggle">Code</button>
    </div>
  </div>
  <div id="demo-${slug}-preview" data-testid="demo-${slug}-preview" data-demo-pane="${slug}" data-demo-pane-view="preview" class="p-4 sm:p-5">${demo}</div>
  <div id="demo-${slug}-code" data-testid="demo-${slug}-code" data-demo-pane="${slug}" data-demo-pane-view="code" class="demo-code" hidden>${demoHighlighted}</div>
  <div class="border-t border-stone-200 px-4 py-2.5 font-mono text-xs text-stone-500 dark:border-stone-800 dark:text-stone-400">demo state: <span data-readout="${slug}" data-testid="demo-${slug}-readout">${escapeHtml(readoutInitial)}</span></div>
</section>`;
}

function indexMain(demoHighlighted: ReadonlyMap<string, string>): string {
  const sections = COMPONENTS.map(
    (
      component,
    ) => `<section aria-label="${component.title} example" data-testid="index-${component.slug}">
  <p class="font-mono text-xs text-emerald-700 dark:text-emerald-400">${component.tag}</p>
  <h2 class="mt-1 text-lg font-semibold tracking-tight">${component.title}</h2>
  <p class="mt-1 mb-3 text-sm text-stone-600 dark:text-stone-400">${escapeHtml(component.blurb)}</p>
  ${demoCard(component.slug, component.tag, component.demo, demoHighlighted.get(component.slug) ?? "", component.readoutInitial)}
  <p class="mt-3 text-sm"><a href="./${component.slug}.html" data-testid="index-${component.slug}-docs" class="underline underline-offset-4 hover:no-underline">View ${component.title} docs</a></p>
</section>`,
  ).join("\n");
  return `<div>
  <p class="text-[11px] font-semibold tracking-[0.14em] text-stone-400 uppercase select-none dark:text-stone-500">Documentation</p>
  <h1 class="mt-2 text-4xl font-bold tracking-tight">basic-web-components</h1>
  <p class="mt-3 text-lg text-stone-600 dark:text-stone-400">Small self-registering web components with native slots. One page per component: a live example plus the full README reference.</p>
</div>
<h2 class="mt-10 mb-4 text-xs font-semibold tracking-[0.12em] text-stone-500 uppercase select-none dark:text-stone-400">All components</h2>
<div class="grid grid-cols-1 gap-8">${sections}</div>`;
}
function buildLlmsTxt(docs: Array<DocSource>): string {
  const lines = [
    "# basic-web-components",
    "",
    "Static docs for the basic-web-components library (self-registering web",
    "components with native slots). One page per component: a live example",
    "plus the full README reference, rendered with syntax highlighting.",
    "This file is auto-generated by `website/src/prerender.ts` on every",
    "build — do not edit by hand.",
    "",
    "## Pages",
    "",
    "- [Overview](./index.html): component index and getting started. Markdown: ./index.md",
    ...docs.map(
      (doc) =>
        `- [${doc.title}](./${doc.slug}.html): ${doc.description} Markdown: ./${doc.slug}.md`,
    ),
    "",
    "## Markdown sources",
    "",
    "- [Overview markdown](./index.md)",
    ...docs.map((doc) => `- [${doc.title} markdown](./${doc.slug}.md)`),
    "",
  ];
  return lines.join("\n");
}

function indexMarkdown(docs: Array<DocSource>): string {
  const lines = [
    "# basic-web-components",
    "",
    "Small self-registering web components with native slots. One page per",
    "component: a live example plus the full README reference.",
    "",
    "## Components",
    "",
    ...docs.map(
      (doc) =>
        `- [${doc.title}](./${doc.slug}.html) ([markdown](./${doc.slug}.md)): ${doc.description}`,
    ),
    "",
  ];
  return lines.join("\n");
}

interface PageInput {
  title: string;
  description: string;
  active: string;
  main: string;
}

interface GeneratedSite {
  /** Page filename (index.html, <slug>.html) -> shell inputs. */
  pages: Map<string, PageInput>;
  /** Raw text filename (index.md, <slug>.md, docs/<slug>.md, llms.txt). */
  texts: Map<string, string>;
}

async function generateSite(): Promise<GeneratedSite> {
  const highlighter = await createHighlighter({
    themes: [LIGHT_THEME, DARK_THEME],
    langs: [...CODE_LANGS],
  });
  try {
    const pages = new Map<string, PageInput>();
    const texts = new Map<string, string>();
    const docs: Array<DocSource> = [];
    const overviewDemos = new Map<string, string>();
    for (const component of COMPONENTS) {
      const doc = await loadDoc(component.slug, component.tag, component.subpath, component.blurb);
      docs.push(doc);
      // Shiki highlighting is sync, but marked renderers must be sync too: lex
      // first, highlight every fenced block up front, then render from the map.
      const blocks: Array<Token> = [];
      collectCodeBlocks(marked.lexer(doc.markdown), blocks);
      const highlighted = new Map<string, string>();
      for (const block of blocks) {
        if (block.type !== "code") continue;
        const key = `${block.lang ?? ""}\n${block.text}`;
        if (!highlighted.has(key)) {
          highlighted.set(key, highlightCode(highlighter, block.text, block.lang));
        }
      }
      marked.use({ renderer: createRenderer(highlighted) });
      const html = wrapTables(marked.parse(doc.markdown, { async: false }));
      marked.use({ renderer: null });
      const demoHighlighted = highlightCode(highlighter, component.demo, "html");
      overviewDemos.set(component.slug, demoHighlighted);
      pages.set(`${component.slug}.html`, {
        title: doc.title,
        description: doc.description,
        active: component.slug,
        main: `${demoCard(component.slug, component.tag, component.demo, demoHighlighted, component.readoutInitial)}
<article class="doc mt-8" data-testid="doc-${component.slug}">${html}</article>`,
      });
      // Raw markdown sources: sibling /<slug>.md routes plus the docs/ copies.
      texts.set(`docs/${component.slug}.md`, doc.markdown);
      texts.set(`${component.slug}.md`, doc.markdown);
    }

    pages.set("index.html", {
      title: "Overview",
      description:
        "Documentation for basic-web-components: one live page per component plus full README references.",
      active: "index",
      main: indexMain(overviewDemos),
    });
    texts.set("index.md", indexMarkdown(docs));
    texts.set("llms.txt", buildLlmsTxt(docs));
    return { pages, texts };
  } finally {
    highlighter.dispose();
  }
}

// Dev-mode client entries (transformed per request, HMR-capable).
const DEV_SCRIPTS = `<script type="module" src="/src/client.tsx"></script>
<script type="module" src="/src/nav.ts"></script>`;

const MARKDOWN_TYPE = "text/markdown; charset=utf-8";

/** Docs prerender plugin: build emits pages + markdown into dist/; dev serves them from memory. */
export function docsPrerender(): Plugin {
  let pending: Promise<GeneratedSite> | null = null;
  const getSite = (): Promise<GeneratedSite> => {
    pending ??= generateSite().catch((error: unknown) => {
      pending = null;
      throw error;
    });
    return pending;
  };

  return {
    name: "docs-prerender",
    config(_config, { command }) {
      if (command === "build") {
        return {
          build: {
            rollupOptions: {
              input: { client: "src/client.tsx", nav: "src/nav.ts" },
            },
          },
        };
      }
      return undefined;
    },
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        try {
          const pathname = (req.url ?? "/").split("?")[0] ?? "/";
          const site = await getSite();
          const pageKey =
            pathname === "/" || pathname === "/index.html"
              ? "index.html"
              : pathname.startsWith("/") && pathname.endsWith(".html")
                ? pathname.slice(1)
                : null;
          if (pageKey !== null) {
            const page = site.pages.get(pageKey);
            if (page === undefined) {
              next();
              return;
            }
            const html = await server.transformIndexHtml(
              req.url ?? "/",
              shell({ ...page, head: "", scripts: DEV_SCRIPTS }),
            );
            res.setHeader("Content-Type", "text/html; charset=utf-8");
            res.end(html);
            return;
          }
          const textKey = pathname.startsWith("/") ? pathname.slice(1) : null;
          if (textKey !== null && site.texts.has(textKey)) {
            const text = site.texts.get(textKey) ?? "";
            res.setHeader(
              "Content-Type",
              textKey.endsWith(".md") ? MARKDOWN_TYPE : "text/plain; charset=utf-8",
            );
            res.end(text);
            return;
          }
          next();
        } catch (error) {
          next(error);
        }
      });
    },
    async generateBundle(_options, bundle) {
      const chunkFile = (suffix: string): string => {
        for (const item of Object.values(bundle)) {
          if (item.type !== "chunk") continue;
          const facade = (item.facadeModuleId ?? "").replace(/\\/g, "/");
          if (facade.endsWith(suffix)) return item.fileName;
        }
        throw new Error(`docs-prerender: missing chunk for ${suffix}`);
      };
      const cssFiles = Object.values(bundle)
        .filter((item) => item.type === "asset" && item.fileName.endsWith(".css"))
        .map((item) => (item as { fileName: string }).fileName);
      const head = cssFiles.map((file) => `<link rel="stylesheet" href="./${file}" />\n`).join("");
      const scripts =
        `<script type="module" crossorigin src="./${chunkFile("/src/client.tsx")}"></script>\n` +
        `<script type="module" crossorigin src="./${chunkFile("/src/nav.ts")}"></script>`;
      const site = await getSite();
      for (const [fileName, page] of site.pages) {
        this.emitFile({ type: "asset", fileName, source: shell({ ...page, head, scripts }) });
      }
      for (const [fileName, source] of site.texts) {
        this.emitFile({ type: "asset", fileName, source });
      }
    },
  };
}
