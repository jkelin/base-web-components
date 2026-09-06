import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// Black-box panel contract: asserts on the shipped slide-out.css source
// (vitest inlines `?inline` CSS imports as empty, so read the file).
const css = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "slide-out.css"), "utf8");

// Panel height contract: the drawer must fill the viewport even when its
// `position: fixed` is contained by an ancestor (the site header's
// backdrop-filter makes the header the containing block, so `top: 0` plus
// `bottom: 0` alone collapses the panel to header height on mobile).
// An explicit viewport height keeps it full-height in both cases.
describe("slide-out panel height", () => {
  const panelRule = (): string => {
    const match = /bwc-slide-out\s*>\s*\[slot="panel"\]\s*\{([^}]*)\}/.exec(css);
    if (!match) throw new Error("slide-out.css has no bwc-slide-out > [slot=panel] rule");
    return match[1] ?? "";
  };

  it("pins an explicit viewport height on the panel", () => {
    const rule = panelRule();
    expect(rule).toMatch(/height:\s*100vh/);
    expect(rule).toMatch(/height:\s*100dvh/);
  });

  it("keeps the viewport-edge anchors alongside the height", () => {
    const rule = panelRule();
    expect(rule).toMatch(/top:\s*0/);
    expect(rule).toMatch(/bottom:\s*0/);
  });
});
