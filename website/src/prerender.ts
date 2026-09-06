// Docs prerender as a Vite plugin: reads each component README, renders it to
// HTML with raw escaped code blocks (highlighted client-side with microlighter),
// and emits one static HTML file per page plus the markdown sources and llms.txt.
//
// - `vite build`: page/markdown assets are emitted into dist/ via
//   `generateBundle` (client scripts resolve to their hashed chunk names),
//   so dist/ is the only place generated artefacts live.
// - `vite dev`: a middleware serves the same pages from memory with dev
//   script tags (`/@vite/client` preamble via transformIndexHtml), so
//   navigation, markdown, and llms.txt all work without a prior build.
// Run via `bun run build` / `bun run dev`.
import { readFile } from "node:fs/promises";
import { gzipSync } from "node:zlib";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { marked, type RendererObject } from "marked";
import type { Plugin } from "vite";
import { COMPONENTS, stripExampleAttributes } from "./site.ts";
import { phosphorIcon } from "./icons.ts";

const SITE_BASE = "https://jkelin.github.io/basic-web-components/";
const GITHUB_URL = "https://github.com/jkelin/basic-web-components";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const LIB = resolve(ROOT, "..", "packages", "basic-web-components", "src");
const LIB_DIST = resolve(ROOT, "..", "packages", "basic-web-components", "dist");

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

const STYLING_BLURB =
  "Styling basic-web-components: the optional variable-driven default CSS or Tailwind and direct styling, with a live configurator.";

async function loadGuideDoc(): Promise<DocSource> {
  try {
    const markdown = await readFile(join(ROOT, "..", "docs", "styling.md"), "utf8");
    const paragraph = firstParagraph(markdown);
    return {
      slug: "styling",
      markdown,
      title: "Styling",
      description: paragraph?.replace(/\s+/g, " ") ?? STYLING_BLURB,
      fromReadme: false,
    };
  } catch {
    // Missing guide: stub from the styling contract, never block the build.
    const markdown = `# Styling\n\n${STYLING_BLURB}\n\n\`\`\`css\n@import "basic-web-components/theme.css";\n\`\`\`\n`;
    return {
      slug: "styling",
      markdown,
      title: "Styling",
      description: STYLING_BLURB,
      fromReadme: false,
    };
  }
}

// Raw code blocks for client-side highlighting: prerender emits the escaped
// source with a `language-*` class (plus data-language for microlighter's
// fallback lookup); src/client.tsx runs microlighter's highlightAll() on load
// and after each SPA page swap. Unknown languages (e.g. `text`) and no-JS
// readers fall back to the plain escaped source — no build-time highlighter.
function codeBlock(text: string, lang: string | undefined): string {
  const language =
    lang !== undefined && (CODE_LANGS as readonly string[]).includes(lang) ? lang : "text";
  return `<pre data-language="${language}"><code class="language-${language}">${escapeHtml(text)}</code></pre>`;
}

function createRenderer(): RendererObject {
  return {
    code({ text, lang }) {
      return codeBlock(text, lang);
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

const THEME_INIT = `<script>(function(){try{var t=localStorage.getItem("bwc-theme");if(t==="dark"||(!t&&window.matchMedia("(prefers-color-scheme: dark)").matches)){document.documentElement.classList.add("dark");}}catch(e){}try{var v=localStorage.getItem("bwc-theme-vars");if(v){var o=JSON.parse(v);for(var k in o){document.documentElement.style.setProperty(k,o[k]);}}}catch(e){}})();</script>`;

// Critical shell styles, inline before paint: page background (no white
// flash in dark mode), pre-upgrade slide-out hiding, responsive
// sidebar/hamburger visibility, and the 100ms content-only fade. Everything
// else arrives via Tailwind; noscript keeps the sidebar usable.
const CRITICAL_CSS = `<style>html{background-color:#fafaf9}html.dark{background-color:#0c0a09}#main{transition:opacity 100ms ease-out}@media (prefers-reduced-motion:reduce){#main{transition:none}}bwc-slide-out:not(:defined)>[slot="panel"]{display:none}@media (max-width:1023.5px){#sidebar{display:none}}@media (min-width:1024px){#site-menu{display:none}}</style>`;
const NOSCRIPT_CSS = `<noscript><style>#sidebar{display:block !important}#site-menu{display:none !important}</style></noscript>`;
// Site logo: white lowercase `bwc` monospace wordmark on a black rounded
// rect. Hand-authored (rect + text only, no editor metadata) so it stays
// tiny; the generic monospace stack renders without webfonts. HEADER_LOGO_SVG
// renders the wordmark inline (no extra request) at ~28px tall to match the
// header. FAVICON_SVG is a separate tight square asset (single `b`, ~19%
// padding per side) emitted as favicon.svg.
const LOGO_VIEWBOX = "0 0 41 28";
const LOGO_INNER = `<rect width="41" height="28" rx="6" fill="#000"/><text x="20.5" y="14" dy="0.35em" text-anchor="middle" font-family="ui-monospace,SFMono-Regular,Menlo,Consolas,monospace" font-size="12" font-weight="700" fill="#fff">bwc</text>`;
const FAVICON_VIEWBOX = "0 0 64 64";
const FAVICON_INNER = `<rect width="64" height="64" rx="13" fill="#000"/><text x="32" y="32" dy="0.35em" text-anchor="middle" font-family="ui-monospace,SFMono-Regular,Menlo,Consolas,monospace" font-size="40" font-weight="700" fill="#fff">b</text>`;
const FAVICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${FAVICON_VIEWBOX}">${FAVICON_INNER}</svg>`;
const HEADER_LOGO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${LOGO_VIEWBOX}" aria-hidden="true" data-testid="nav-logo" class="h-7 w-auto dark:invert">${LOGO_INNER}</svg>`;

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
  return `<nav aria-label="Docs" class="min-w-0">
  <p class="px-3 text-[11px] font-semibold tracking-[0.14em] text-stone-400 uppercase select-none dark:text-stone-500">Overview</p>
  <ul class="mt-2 space-y-0.5">
    ${link("./", "Overview", active === "index")}
    ${link("./styling.html", "Styling", active === "styling")}
  </ul>
  <p class="mt-6 px-3 text-[11px] font-semibold tracking-[0.14em] text-stone-400 uppercase select-none dark:text-stone-500">Components</p>
  <ul class="mt-2 space-y-0.5">
    ${items}
  </ul>
  </nav>`;
}

// Mobile menu panel: the same prerendered links as the desktop sidebar, so
// navigation works with and without JS (no-JS readers use the noscript
// sidebar instead; the hamburger trigger is inert until upgrade). Shell
// parts (trigger, panel, close) carry `data-bwc-unstyled` so theme.css
// leaves the shell's Tailwind styling alone while demos stay themed.
function mobileMenu(active: string): string {
  return `<bwc-slide-out id="site-menu" data-testid="site-menu" class="lg:hidden">
  <button slot="trigger" data-bwc-unstyled id="menu-button" data-testid="menu-button" type="button" aria-label="Open menu" class="flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-md border border-stone-300 bg-white transition hover:bg-stone-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stone-900 dark:border-stone-700 dark:bg-stone-900 dark:hover:bg-stone-800">${phosphorIcon("menu", 16)}</button>
  <div slot="panel" data-bwc-unstyled id="menu-panel" data-testid="menu-panel" class="overflow-y-auto bg-white p-4 dark:bg-stone-900">
    <div class="mb-3 flex items-center justify-between gap-2">
      <span class="font-mono text-sm font-semibold">basic-web-components</span>
      <button data-close data-bwc-unstyled id="menu-close" data-testid="menu-close" type="button" aria-label="Close menu" class="flex min-h-11 min-w-11 cursor-pointer items-center justify-center rounded-md border border-stone-300 px-2 transition hover:bg-stone-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stone-900 dark:border-stone-700 dark:hover:bg-stone-800">${phosphorIcon("x", 20)}</button>
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
  const canonical = options.active === "index" ? SITE_BASE : `${SITE_BASE}${options.active}.html`;
  const fullTitle = `${options.title} · basic-web-components`;
  // Sidebar: top-89px equals the in-flow offset (57px sticky header + 32px
  // grid pt), so the nav is pixel-identical scrolled or not. The -ml-3
  // wrapper cancels the links px-3, aligning link text with the header icon.
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<meta name="description" content="${escapeHtml(options.description)}" />
<link rel="canonical" href="${canonical}" />
<link rel="icon" type="image/svg+xml" href="./favicon.svg" />
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&family=IBM+Plex+Mono:wght@400;500;600;700&display=swap" />
<meta property="og:type" content="website" />
<meta property="og:site_name" content="basic-web-components" />
<meta property="og:title" content="${escapeHtml(fullTitle)}" />
<meta property="og:description" content="${escapeHtml(options.description)}" />
<meta property="og:url" content="${canonical}" />
<meta name="twitter:card" content="summary" />
<title>${escapeHtml(fullTitle)}</title>
${options.head}${THEME_INIT}
${CRITICAL_CSS}
${NOSCRIPT_CSS}
</head>
<body class="min-h-screen bg-stone-50 text-stone-900 antialiased dark:bg-stone-950 dark:text-stone-100">
<a href="#main" class="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:rounded focus:bg-stone-900 focus:px-3 focus:py-1 focus:text-white">Skip to content</a>
<header class="sticky top-0 z-10 border-b border-stone-200 bg-stone-50/90 dark:border-stone-800 dark:bg-stone-950/90">
  <!-- Blur lives on this inner layer, not the header: backdrop-filter on the header would make it the containing block for the mobile slide-out's fixed panel + dismiss overlay (see menu-containment.test.ts). -->
  <div aria-hidden="true" data-testid="header-blur" class="pointer-events-none absolute inset-0 backdrop-blur-md"></div>
  <div class="relative mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
    <a href="./" data-testid="nav-home" class="flex min-w-0 items-center gap-2">
      ${HEADER_LOGO_SVG}
      <span data-testid="nav-wordmark" class="hidden truncate font-mono text-sm font-semibold sm:block">basic-web-components</span>
    </a>
    <div class="flex items-center gap-2">
      <a id="nav-markdown" href="${markdownHref}" data-testid="nav-markdown" target="_blank" rel="noopener" class="hidden rounded-md px-2 py-1 font-mono text-xs text-stone-500 hover:text-stone-900 sm:block dark:text-stone-400 dark:hover:text-stone-100">${options.active}.md</a>
      <a href="./llms.txt" data-testid="nav-llms" target="_blank" rel="noopener" class="hidden rounded-md px-2 py-1 font-mono text-xs text-stone-500 hover:text-stone-900 sm:block dark:text-stone-400 dark:hover:text-stone-100">llms.txt</a>
      <a id="nav-github" href="${GITHUB_URL}" data-testid="nav-github" aria-label="GitHub repository" title="GitHub repository" target="_blank" rel="noopener noreferrer" class="flex size-7 shrink-0 items-center justify-center rounded-md border border-stone-300 bg-white text-stone-600 transition hover:bg-stone-100 hover:text-stone-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stone-900 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-400 dark:hover:bg-stone-800 dark:hover:text-stone-100">${phosphorIcon("github", 16)}</a>
      <div id="theme-toggle-mount" data-testid="theme-toggle-mount"></div>
      <bwc-popover id="styling-popover" data-testid="styling-popover" side="bottom" side-offset="4" class="flex items-center">
        <button slot="trigger" data-bwc-unstyled id="styling-trigger" data-testid="styling-trigger" type="button" aria-label="Customize theme" title="Customize theme" class="flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-md border border-stone-300 bg-white text-stone-600 transition hover:bg-stone-100 hover:text-stone-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stone-900 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-400 dark:hover:bg-stone-800 dark:hover:text-stone-100">${phosphorIcon("paintRoller", 16)}</button>
        <div slot="popup" data-bwc-unstyled id="styling-popup" data-testid="styling-popup" class="w-80 max-w-[calc(100vw-2rem)] rounded-lg border border-stone-300 bg-white p-4 shadow-lg dark:border-stone-700 dark:bg-stone-900"><div id="styling-popover-mount" data-testid="styling-popover-mount"></div></div>
      </bwc-popover>
      ${mobileMenu(options.active)}
    </div>
  </div>
</header>
<div class="mx-auto grid max-w-6xl grid-cols-1 gap-8 px-4 py-8 sm:px-6 lg:grid-cols-[240px_minmax(0,1fr)]">
  <aside id="sidebar" class="hidden lg:sticky lg:top-[89px] lg:block lg:self-start"><div class="-ml-3">${sidebar(options.active)}</div></aside>
  <main id="main" data-page="${options.active}" class="min-w-0">${options.main}</main>
</div>
<footer class="border-t border-stone-200 dark:border-stone-800">
  <div class="mx-auto flex max-w-6xl flex-col gap-1 px-4 py-6 font-mono text-xs text-stone-500 sm:px-6 dark:text-stone-400"><p>basic-web-components docs · <a class="underline underline-offset-2" href="${GITHUB_URL}" data-testid="nav-github-footer" target="_blank" rel="noopener noreferrer">GitHub</a> · <a class="underline underline-offset-2" href="./sitemap.xml" data-testid="nav-sitemap" target="_blank" rel="noopener">sitemap.xml</a> · <a class="underline underline-offset-2" href="./llms.txt" data-testid="nav-llms-footer" target="_blank" rel="noopener">llms.txt</a></p><p><a class="underline underline-offset-2" href="https://fonts.google.com/specimen/IBM+Plex+Mono" data-testid="nav-font-footer" target="_blank" rel="noopener noreferrer">IBM Plex Mono</a> · <a class="underline underline-offset-2" href="https://fonts.google.com/specimen/Manrope" data-testid="nav-manrope-footer" target="_blank" rel="noopener noreferrer">Manrope</a> · <a class="underline underline-offset-2" href="https://phosphoricons.com" data-testid="nav-phosphor-footer" target="_blank" rel="noopener noreferrer">Phosphor icons</a> · <a class="underline underline-offset-2" href="https://github.com/stackblitz/alien-signals" data-testid="nav-alien-signals-footer" target="_blank" rel="noopener noreferrer">Alien Signals</a></p></div>
</footer>
${options.scripts}</body>
</html>
`;
}

function demoCard(
  slug: string,
  tag: string,
  demo: string,
  demoCode: string,
  readoutInitial: string,
): string {
  // Preview/Code toggle: two native buttons (keyboard accessible) flipping
  // `hidden` on the panes, so the live demo keeps its DOM state when
  // switching back. The code pane shows the stripped example source (ids,
  // testids, and classes removed) as raw escaped text, highlighted on the
  // client with microlighter. `demo` stays full markup for the live preview.
  return `<section aria-label="Live example" class="overflow-hidden rounded-xl border border-stone-200 bg-white dark:border-stone-800 dark:bg-stone-900">
  <div class="flex flex-wrap items-center justify-between gap-2 border-b border-stone-200 px-4 py-2.5 dark:border-stone-800">
    <p class="text-xs font-semibold tracking-[0.12em] text-stone-500 uppercase select-none dark:text-stone-400">Live example</p>
    <div role="group" aria-label="Demo view" class="flex items-center gap-1">
      <button type="button" id="demo-${slug}-toggle-preview" data-testid="demo-${slug}-toggle-preview" data-demo-toggle="${slug}" data-demo-view="preview" aria-pressed="true" aria-controls="demo-${slug}-preview demo-${slug}-code" class="demo-toggle">Preview</button>
      <button type="button" id="demo-${slug}-toggle-code" data-testid="demo-${slug}-toggle-code" data-demo-toggle="${slug}" data-demo-view="code" aria-pressed="false" aria-controls="demo-${slug}-preview demo-${slug}-code" class="demo-toggle">Code</button>
    </div>
  </div>
  <div id="demo-${slug}-preview" data-testid="demo-${slug}-preview" data-demo-pane="${slug}" data-demo-pane-view="preview" class="p-4 sm:p-5">${demo}</div>
  <div id="demo-${slug}-code" data-testid="demo-${slug}-code" data-demo-pane="${slug}" data-demo-pane-view="code" data-syntax-theme="github" class="demo-code" hidden>${demoCode}</div>
  <div class="border-t border-stone-200 px-4 py-2.5 font-mono text-xs text-stone-500 dark:border-stone-800 dark:text-stone-400">demo state: <span data-readout="${slug}" data-testid="demo-${slug}-readout">${escapeHtml(readoutInitial)}</span></div>
</section>`;
}

function indexMain(
  demoCode: ReadonlyMap<string, string>,
  sizes: ReadonlyMap<string, { built: string; gzip: string } | null>,
): string {
  const sections = COMPONENTS.map((component) => {
    const size = sizes.get(component.slug);
    // One muted line next to the component name: element name plus the
    // build-time entry size (omitted until the lib has been built once).
    const meta =
      size === undefined || size === null ? component.tag : `${component.tag} · gzip: ${size.gzip}`;
    return `<section aria-label="${component.title} example" data-testid="index-${component.slug}">
  <h2 class="text-lg font-semibold tracking-tight">${component.title}</h2>
  <p class="mt-1 font-mono text-xs text-stone-500 dark:text-stone-400" data-testid="index-${component.slug}-meta">${meta}</p>
  <p class="mt-1 mb-3 text-sm text-stone-600 dark:text-stone-400">${escapeHtml(component.blurb)}</p>
  ${demoCard(component.slug, component.tag, component.demo, demoCode.get(component.slug) ?? "", component.readoutInitial)}
  <p class="mt-3 text-sm"><a href="./${component.slug}.html" data-testid="index-${component.slug}-docs" class="underline underline-offset-4 hover:no-underline">View ${component.title} docs</a></p>
</section>`;
  }).join("\n");
  return `<div>
  <h1 class="mt-2 text-4xl font-bold tracking-tight">basic-web-components</h1>
  <p class="mt-3 text-lg text-stone-600 dark:text-stone-400">Small self-registering web components with native slots. One page per component: a live example plus the full README reference.</p>
</div>
<div class="mt-8 grid grid-cols-1 gap-8">${sections}</div>`;
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
    "- [Styling](./styling.html): optional variable-driven default CSS or Tailwind and direct styling, with a live configurator. Markdown: ./styling.md",
    "",
    "## Markdown sources",
    "",
    "- [Overview markdown](./index.md)",
    ...docs.map((doc) => `- [${doc.title} markdown](./${doc.slug}.md)`),
    "- [Styling markdown](./styling.md)",
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
    "## Guides",
    "",
    "- [Styling](./styling.html) ([markdown](./styling.md)): optional variable-driven default CSS or Tailwind and direct styling, with a live configurator.",
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
  /** Raw text filename (index.md, <slug>.md, docs/<slug>.md, llms.txt, sitemap.xml). */
  texts: Map<string, string>;
}

// Built + gzip size of each component's dist entry, computed at prerender
// time from packages/basic-web-components/dist/<slug>.js. Returns null when
// the lib hasn't been built yet (dev before first build): the size is then
// omitted so pages still render.
async function componentSize(slug: string): Promise<{ built: string; gzip: string } | null> {
  try {
    const file = await readFile(join(LIB_DIST, `${slug}.js`));
    const kb = (bytes: number): string => `${(bytes / 1024).toFixed(1)} kB`;
    return { built: kb(file.length), gzip: kb(gzipSync(file).length) };
  } catch {
    return null;
  }
}
// Size line inside the component title (h1), in a smaller grey span — not a
// separate badge paragraph. Keeps the `size-<slug>` testid hook.
function sizeTitleSpan(slug: string, size: { built: string; gzip: string } | null): string {
  if (size === null) return "";
  return ` <span data-testid="size-${slug}" class="font-mono text-sm font-normal text-stone-500 dark:text-stone-400">gzip: ${size.gzip}</span>`;
}

// Appends the size span to the first h1 (the README `# <tag>` title). Falls
// back to a badge paragraph when the markdown has no h1 — never happens today
// (the stub always starts with `# <tag>`), but keeps the size visible anyway.
function withSizeInTitle(
  html: string,
  slug: string,
  size: { built: string; gzip: string } | null,
): string {
  if (size === null) return html;
  if (/<h1[\s>]/.test(html)) {
    return html.replace(/<h1([^>]*)>([\s\S]*?)<\/h1>/, `<h1$1>$2${sizeTitleSpan(slug, size)}</h1>`);
  }
  return `${html}\n<p data-testid="size-${slug}" class="mt-3 font-mono text-xs text-stone-500 dark:text-stone-400">gzip: ${size.gzip}</p>`;
}
// Sitemap over every emitted page (index.html -> the site root), served in
// dev and emitted into dist/ on build via the texts map.
function sitemapXml(pageFiles: Iterable<string>): string {
  const urls = [...pageFiles]
    .filter((file) => file.endsWith(".html"))
    .sort()
    .map((file) => (file === "index.html" ? SITE_BASE : `${SITE_BASE}${file}`));
  return (
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    `${urls.map((url) => `  <url><loc>${url}</loc></url>`).join("\n")}\n` +
    `</urlset>\n`
  );
}

async function generateSite(): Promise<GeneratedSite> {
  const pages = new Map<string, PageInput>();
  const texts = new Map<string, string>();
  const docs: Array<DocSource> = [];
  const overviewDemos = new Map<string, string>();
  const overviewSizes = new Map<string, { built: string; gzip: string } | null>();
  for (const component of COMPONENTS) {
    const doc = await loadDoc(component.slug, component.tag, component.subpath, component.blurb);
    docs.push(doc);
    // Code blocks render raw (escaped); the client highlights them, so marked
    // renders straight through with a sync renderer.
    marked.use({ renderer: createRenderer() });
    const html = wrapTables(marked.parse(doc.markdown, { async: false }));
    marked.use({ renderer: null });
    // Code pane shows the stripped example source; the preview keeps `demo` verbatim.
    const exampleSource = stripExampleAttributes(component.demo);
    const demoCode = codeBlock(exampleSource, "html");
    overviewDemos.set(component.slug, demoCode);
    const size = await componentSize(component.slug);
    overviewSizes.set(component.slug, size);
    pages.set(`${component.slug}.html`, {
      title: doc.title,
      description: doc.description,
      active: component.slug,
      main: `${demoCard(component.slug, component.tag, component.demo, demoCode, component.readoutInitial)}
<article class="doc mt-8" data-syntax-theme="github" data-testid="doc-${component.slug}">${withSizeInTitle(html, component.slug, size)}</article>`,
    });
    // Raw markdown sources: sibling /<slug>.md routes plus the docs/ copies.
    texts.set(`docs/${component.slug}.md`, doc.markdown);
    texts.set(`${component.slug}.md`, doc.markdown);
  }

  // Styling guide: same markdown pipeline as component pages, sourced from
  // the repo-root docs/ copy (also emitted as styling.md + docs/styling.md
  // so the header markdown link keeps working).
  const stylingDoc = await loadGuideDoc();
  marked.use({ renderer: createRenderer() });
  const stylingHtml = wrapTables(marked.parse(stylingDoc.markdown, { async: false }));
  marked.use({ renderer: null });
  const configuratorSection = `<section aria-label="Theme configurator" class="overflow-hidden rounded-xl border border-stone-200 bg-white dark:border-stone-800 dark:bg-stone-900">
  <div class="border-b border-stone-200 px-4 py-2.5 dark:border-stone-800">
    <p class="text-xs font-semibold tracking-[0.12em] text-stone-500 uppercase select-none dark:text-stone-400">Configurator</p>
  </div>
  <div class="p-4 sm:p-5"><div id="styling-configurator-mount" data-testid="styling-configurator-mount"></div></div>
</section>`;
  // Configurator sits below Option 1: split the article at the Option 2
  // heading so the variable-theme docs read first. Falls back to the
  // configurator-first layout when the heading is missing.
  const option2At = stylingHtml.search(/<h2[^>]*>(?:(?!<h2)[\s\S])*?Option 2/);
  const stylingMain =
    option2At >= 0
      ? `<article class="doc mt-8" data-syntax-theme="github" data-testid="doc-styling">${stylingHtml.slice(0, option2At)}</article>${configuratorSection}<article class="doc mt-8" data-syntax-theme="github" data-testid="doc-styling-option-2">${stylingHtml.slice(option2At)}</article>`
      : `${configuratorSection}<article class="doc mt-8" data-syntax-theme="github" data-testid="doc-styling">${stylingHtml}</article>`;
  pages.set("styling.html", {
    title: stylingDoc.title,
    description: stylingDoc.description,
    active: "styling",
    main: stylingMain,
  });
  texts.set("docs/styling.md", stylingDoc.markdown);
  texts.set("styling.md", stylingDoc.markdown);

  pages.set("index.html", {
    title: "Overview",
    description:
      "Documentation for basic-web-components: one live page per component plus full README references.",
    active: "index",
    main: indexMain(overviewDemos, overviewSizes),
  });
  texts.set("index.md", indexMarkdown(docs));
  texts.set("sitemap.xml", sitemapXml(pages.keys()));
  texts.set("favicon.svg", `${FAVICON_SVG}\n`);
  texts.set("llms.txt", buildLlmsTxt(docs));
  return { pages, texts };
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
              textKey.endsWith(".md")
                ? MARKDOWN_TYPE
                : textKey.endsWith(".xml")
                  ? "application/xml; charset=utf-8"
                  : textKey.endsWith(".svg")
                    ? "image/svg+xml"
                    : "text/plain; charset=utf-8",
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
      // Shared runtime chunk (client/nav imports): modulepreload it on every
      // page so the browser fetches it with high priority alongside entries.
      const cssFiles: Array<string> = [];
      let preload = "";
      for (const item of Object.values(bundle)) {
        if (item.type === "asset" && item.fileName.endsWith(".css")) {
          cssFiles.push(item.fileName);
        } else if (
          item.type === "chunk" &&
          !item.isEntry &&
          item.fileName.endsWith(".js") &&
          preload === ""
        ) {
          preload = `<link rel="modulepreload" href="./${item.fileName}" />\n`;
        }
      }
      const head =
        preload + cssFiles.map((file) => `<link rel="stylesheet" href="./${file}" />\n`).join("");
      const scripts =
        `<script type="module" crossorigin src="./${chunkFile("/src/client.tsx")}"></script>\n` +
        `<script type="module" crossorigin src="./${chunkFile("/src/nav.ts")}"></script>`;
      const site = await getSite();
      // Microlighter grammars: the client chunk dynamic-imports
      // `./grammars/<lang>.js` relative to itself (Vite leaves that import
      // native), so the docs languages are emitted as static assets beside
      // the chunks and load on demand. `shell`/`js`/`ts` resolve to the
      // bash/javascript/typescript grammars via built-in aliases, `diff` via
      // the client's languageAliases, and `text` has no grammar (stays plain).
      for (const lang of [
        "html",
        "javascript",
        "typescript",
        "bash",
        "css",
        "json",
        "git-diff",
      ] as const) {
        const grammar = await readFile(
          join(ROOT, "node_modules", "microlighter", "dist", "grammars", `${lang}.js`),
          "utf8",
        );
        this.emitFile({ type: "asset", fileName: `assets/grammars/${lang}.js`, source: grammar });
      }
      for (const [fileName, page] of site.pages) {
        this.emitFile({ type: "asset", fileName, source: shell({ ...page, head, scripts }) });
      }
      for (const [fileName, source] of site.texts) {
        this.emitFile({ type: "asset", fileName, source });
      }
    },
  };
}
