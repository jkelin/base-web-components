// @ts-ignore: bun:test types ship with the Bun runtime, not as a workspace package.
import { describe, expect, it } from "bun:test";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// Black-box header contract: asserts on the built dist/index.html deliverable
// (run `bun run build` from website/ first), not on source text.
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
// Prerendered page lookup: the docs-prerender vite plugin emits pages into
// dist/ only; nothing generated lives at the website root.
const SM_VISIBLE = /sm:(block|inline|inline-block|inline-flex|flex)\b/;

async function headerHtml(): Promise<string> {
  let page: string | undefined;
  try {
    page = await readFile(join(ROOT, "dist", "index.html"), "utf8");
  } catch {
    throw new Error("no built dist/index.html — run `bun run build` from website/ first");
  }
  const match = /<header[\s\S]*?<\/header>/.exec(page);
  if (!match) throw new Error("dist/index.html contains no <header> — run `bun run build` first");
  return match[0];
}

/** Class attribute of the first element in `html` carrying `data-testid`. */
function classOf(html: string, testid: string): string {
  const match = new RegExp(`<[^>]*data-testid="${testid}"[^>]*>`).exec(html);
  if (!match) throw new Error(`<header> has no element with data-testid="${testid}"`);
  const cls = /class="([^"]*)"/.exec(match[0]);
  if (!cls) throw new Error(`data-testid="${testid}" element has no class attribute`);
  return cls[1] ?? "";
}

/** True when the class list hides the element below the `sm` breakpoint. */
function mobileHidden(classAttr: string): boolean {
  const tokens = classAttr.split(/\s+/);
  return tokens.includes("hidden") && SM_VISIBLE.test(classAttr);
}

describe("mobile header", () => {
  it("hides the wordmark text on mobile, shows it on desktop", async () => {
    const header = await headerHtml();
    // Wordmark span: the header instance before the slide-out panel (which
    // repeats the name inside the menu). Prefer the testid when present.
    const testid = /data-testid="nav-wordmark"/.test(header)
      ? classOf(header, "nav-wordmark")
      : (() => {
          const brand = /<a[^>]*data-testid="nav-home"[^>]*>([\s\S]*?)<\/a>/.exec(header);
          if (!brand) throw new Error("header has no nav-home brand link");
          const span = /<span(?![^>]*aria-hidden)[^>]*>basic-web-components<\/span>/.exec(
            brand[1] ?? "",
          );
          if (!span) throw new Error("brand link has no wordmark span");
          return /class="([^"]*)"/.exec(span[0])?.[1] ?? "";
        })();
    expect(mobileHidden(testid)).toBe(true);
  });

  it("hides the Markdown link on mobile, shows it on desktop", async () => {
    expect(mobileHidden(classOf(await headerHtml(), "nav-markdown"))).toBe(true);
  });

  it("hides the header llms.txt link on mobile, shows it on desktop", async () => {
    const header = await headerHtml();
    const matches = [...header.matchAll(/<[^>]*data-testid="nav-llms"[^>]*>/g)];
    expect(matches.length).toBeGreaterThan(0);
    for (const m of matches) {
      const cls = /class="([^"]*)"/.exec(m[0])?.[1] ?? "";
      expect(mobileHidden(cls)).toBe(true);
    }
  });

  it("keeps the hamburger trigger visible on mobile", async () => {
    const header = await headerHtml();
    const trigger = classOf(header, "menu-button");
    expect(trigger.split(/\s+/).includes("hidden")).toBe(false);
    // Wrapper hides the whole slide-out trigger on desktop only.
    expect(classOf(header, "site-menu").split(/\s+/)).toContain("lg:hidden");
  });

  it("keeps the theme toggle mount in the header", async () => {
    await expect(headerHtml()).resolves.toMatch('data-testid="theme-toggle-mount"');
  });
});
