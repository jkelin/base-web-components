// Menu-containment repro: the mobile slide-out panel (`position: fixed`) must
// be contained by the viewport, not the header. A header backdrop-filter
// creates a containing block for fixed descendants, clipping the panel (and
// its dismiss overlay) to the header box — no panel height can escape that.
// @ts-ignore: bun:test types ship with the Bun runtime, not as a workspace package.
import { describe, expect, it } from "bun:test";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

// CSS properties that make an ancestor the containing block for fixed
// descendants (filter/backdrop-filter/transform/perspective all do).
const CONTAINING_TOKENS = [
  "backdrop-blur",
  "backdrop-filter",
  "filter:",
  "transform:",
  "perspective:",
  "will-change:transform",
  "will-change: transform",
];

async function shellHtml(): Promise<string> {
  let page: string;
  try {
    page = await readFile(join(ROOT, "dist", "index.html"), "utf8");
  } catch {
    throw new Error("no built dist/index.html — run `bun run build` from website/ first");
  }
  return page;
}

describe("menu containment", () => {
  it("keeps the header free of fixed-containing filters so the menu reaches the viewport", async () => {
    const page = await shellHtml();
    const match = /<header[^>]*>/.exec(page);
    if (!match) throw new Error("dist/index.html contains no <header>");
    for (const token of CONTAINING_TOKENS) {
      expect(match[0]).not.toContain(token);
    }
  });

  it("blurs scrolled content behind the bar via an inner layer, not the header", async () => {
    const page = await shellHtml();
    const header = /<header[^>]*>([\s\S]*?)<\/header>/.exec(page)?.[0] ?? "";
    expect(header).toContain('data-testid="header-blur"');
    expect(header).toContain("backdrop-blur");
  });

  it("keeps the sticky header and the in-header menu trigger", async () => {
    const page = await shellHtml();
    const open = /<header[^>]*>/.exec(page)?.[0] ?? "";
    expect(open).toContain("sticky");
    expect(page).toContain('data-testid="menu-button"');
    expect(page).toContain('data-testid="site-menu"');
  });
});
