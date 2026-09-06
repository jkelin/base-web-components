import type { Plugin } from "vite";

// Minimal CSS minifier for `?inline` component stylesheets (popover.css,
// slide-out.css): Vite ships `?inline` CSS verbatim, comments included, so
// strip comments and redundant whitespace here. No `content:` strings or
// significant-whitespace selectors exist in these files; descendant
// combinators keep their single space.
export function minifyInlineCss(css: string): string {
  return css
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\s+/g, " ")
    .replace(/\s*([{}:;,>~+])\s*/g, "$1")
    .replace(/;}/g, "}")
    .trim();
}

// Minimal HTML minifier for static `html`` templates: component templates
// carry no `<pre>`/`<textarea>` and no significant inter-tag whitespace, so
// collapsing tag boundaries plus trimming is whitespace-safe.
export function minifyInlineHtml(html: string): string {
  return html.replace(/>\s+</g, "><").trim();
}

// Runs before Vite's css pipeline: rewrites the CSS source and lets the
// standard `?inline` handling wrap it as a string module.
export function minifyInlineAssets(): Plugin {
  return {
    name: "bwc-minify-inline-assets",
    apply: "build",
    enforce: "pre",
    transform: {
      filter: { id: /\.css\?inline/ },
      handler(source: string) {
        return { code: minifyInlineCss(source), map: null };
      },
    },
  };
}
