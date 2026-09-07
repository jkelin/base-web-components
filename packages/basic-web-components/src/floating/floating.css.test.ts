import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const floating = readFileSync(join(root, "floating", "floating.css"), "utf8");
const affected = [
  "popover/popover.css",
  "tooltip/tooltip.css",
  "preview-card/preview-card.css",
  "menu/menu.css",
  "context-menu/context-menu.css",
  "select/select.css",
  "navigation-menu/navigation-menu.css",
];

describe("shared floating arrow", () => {
  it("uses one surface-filled triangle for every placed side", () => {
    expect(floating).toContain("[data-floating-arrow]");
    expect(floating).toContain("background: inherit");
    expect(floating).toContain("border: 0");
    expect(floating.match(/clip-path:\s*polygon/g)).toHaveLength(4);
    for (const side of ["top", "right", "bottom", "left"]) {
      expect(floating).toContain(`[data-side="${side}"] [data-floating-arrow]`);
    }
  });

  it("keeps size configurable without rotated-square component copies", () => {
    expect(floating).toContain("var(--floating-arrow-size, 8px)");
    for (const relative of affected) {
      const css = readFileSync(join(root, relative), "utf8");
      expect(css).not.toContain("rotate(45deg)");
      expect(css).not.toMatch(/\[data-arrow\][\s\S]*?border:\s*inherit/);
    }
  });

  it("keeps select popup elevated without a negative arrow stack", () => {
    const select = readFileSync(join(root, "select", "select.css"), "utf8");
    expect(select).toMatch(/\[slot="popup"\][\s\S]*?z-index:\s*50/);
    expect(select).not.toMatch(/z-index:\s*-1/);
  });
});
