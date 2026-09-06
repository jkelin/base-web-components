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
// collapsing tag boundaries plus trimming is whitespace-safe. Whitespace
// inside tags (newlines/indentation between attributes, space before `>` or
// `/>`) is also insignificant, but quoted attribute values are preserved
// verbatim: `style="rgb(0 0 0 / 0.4)"` and `title="a > b"` keep their inner
// spacing. Text nodes are never touched, so cooked escapes like `<p>line\nitem</p>`
// keep their newline.
function minifyInlineTag(tag: string): string {
  let output = "";
  let quote: '"' | "'" | null = null;
  let pendingSpace = false;
  for (let index = 0; index < tag.length; index += 1) {
    const char = tag[index]!;
    if (quote !== null) {
      output += char;
      if (char === quote) quote = null;
      continue;
    }
    if (char === '"' || char === "'") {
      if (pendingSpace) {
        output += " ";
        pendingSpace = false;
      }
      quote = char;
      output += char;
    } else if (char === "<") {
      output += char;
    } else if (char === ">" || (char === "/" && tag[index + 1] === ">")) {
      // Drop whitespace before the tag close: `</slot\n>` and `<input\n/>`.
      pendingSpace = false;
      output += char;
    } else if (/\s/.test(char)) {
      pendingSpace = true;
    } else {
      if (pendingSpace) {
        output += " ";
        pendingSpace = false;
      }
      output += char;
    }
  }
  return output;
}

export function minifyInlineHtml(html: string): string {
  return html
    .replace(/<(?:"[^"]*"|'[^']*'|[^'">])*>/g, minifyInlineTag)
    .replace(/>\s+</g, "><")
    .trim();
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
