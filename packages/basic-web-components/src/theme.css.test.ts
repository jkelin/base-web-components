import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// Black-box theme contract: asserts on the shipped theme.css source.
const css = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "theme.css"),
  "utf8",
).replace(/\/\*[\s\S]*?\*\//g, "");
const EXPECTED_VARS = [
  "--bwc-background",
  "--bwc-foreground",
  "--bwc-primary",
  "--bwc-primary-foreground",
  "--bwc-secondary",
  "--bwc-muted",
  "--bwc-accent",
  "--bwc-border",
  "--bwc-radius",
  "--bwc-font-size",
] as const;

const ruleBody = (selector: string): string => {
  const match = new RegExp(`${selector}\\s*\\{([^}]*)\\}`).exec(css);
  if (!match) throw new Error(`theme.css has no ${selector} rule`);
  return match[1] ?? "";
};

describe("theme variables", () => {
  it("defines exactly the ten documented variables on :root", () => {
    const body = ruleBody(":root");
    for (const name of EXPECTED_VARS) expect(body).toContain(`${name}:`);
    expect(new Set(body.match(/--bwc-[a-z-]+/g)).size).toBe(EXPECTED_VARS.length);
  });

  it("overrides the dark palette under .dark without touching sizing", () => {
    const body = ruleBody("\\.dark");
    for (const name of EXPECTED_VARS.filter((name) => name !== "--bwc-radius")) {
      if (name === "--bwc-font-size") continue;
      expect(body).toContain(`${name}:`);
    }
    expect(body).not.toContain("--bwc-radius:");
    expect(body).not.toContain("--bwc-font-size:");
  });
});

describe("theme selectors", () => {
  it("themes every component through host-rooted element selectors", () => {
    for (const selector of [
      'bwc-modal \\[slot="trigger"\\]',
      'bwc-modal dialog\\[slot="popup"\\]',
      "bwc-modal \\[data-close\\]",
      'bwc-popover \\[slot="trigger"\\]',
      'bwc-popover \\[slot="popup"\\]',
      "bwc-popover \\[data-close\\]",
      'bwc-tooltip \\[slot="popup"\\]',
      'bwc-alert-dialog \\[slot="popup"\\]',
      "bwc-toast:not",
      'bwc-accordion details\\[slot="item"\\]',
      'bwc-accordion\\s+details\\[slot="item"\\]:not\\(\\[data-bwc-unstyled\\]\\)\\s*>\\s*summary',
      'bwc-tabs\\s+\\[slot="list"\\]:not\\(\\[data-bwc-unstyled\\]\\)\\s+button',
      'bwc-tabs\\s+\\[slot="list"\\]:not\\(\\[data-bwc-unstyled\\]\\)\\s+button:not\\(\\[data-bwc-unstyled\\]\\)\\[aria-selected="true"\\]',
      'bwc-tabs \\[slot="panel"\\]',
      'bwc-otp input\\[slot="field"\\]',
      "bwc-switch button",
      'bwc-slide-out \\[slot="trigger"\\]',
      'bwc-slide-out \\[slot="panel"\\]',
      'bwc-counter \\[slot="decrement"\\]',
      'bwc-counter \\[slot="value"\\]',
    ]) {
      expect(css).toMatch(new RegExp(selector));
    }
    expect(
      ruleBody(
        'bwc-modal \\[slot="trigger"\\][\\s\\S]*?bwc-counter \\[slot="increment"\\]:not\\(\\[data-bwc-unstyled\\]\\)',
      ),
    ).toMatch(/background:\s*var\(--bwc-primary\)/);
    expect(ruleBody('bwc-otp input\\[slot="field"\\]:not\\(\\[data-bwc-unstyled\\]\\)')).toMatch(
      /border:[^;]*var\(--bwc-border\)/,
    );
    expect(ruleBody('bwc-modal dialog\\[slot="popup"\\]:not\\(\\[data-bwc-unstyled\\]\\)')).toMatch(
      /background:\s*var\(--bwc-background\)/,
    );
    expect(ruleBody('bwc-popover \\[slot="popup"\\]:not\\(\\[data-bwc-unstyled\\]\\)')).toMatch(
      /background:\s*var\(--bwc-background\)/,
    );
    expect(ruleBody('bwc-tooltip \\[slot="popup"\\]:not\\(\\[data-bwc-unstyled\\]\\)')).toMatch(
      /background:\s*var\(--bwc-background\)/,
    );
    expect(
      ruleBody('bwc-alert-dialog \\[slot="popup"\\]:not\\(\\[data-bwc-unstyled\\]\\)'),
    ).toMatch(/background:\s*var\(--bwc-background\)/);
    expect(ruleBody("bwc-toast:not\\(\\[data-bwc-unstyled\\]\\)")).toMatch(
      /background:\s*var\(--bwc-background\)/,
    );
    expect(ruleBody('bwc-tabs \\[slot="panel"\\]:not\\(\\[data-bwc-unstyled\\]\\)')).toMatch(
      /border-radius:\s*var\(--bwc-radius\)/,
    );
  });

  it("ships no class selectors", () => {
    expect(css).not.toMatch(/\.bwc-[a-z-]/);
  });

  it("roots every rule at a bwc-* host, :root, .dark, or at-rules", () => {
    for (const chunk of css.split("}")) {
      const text = (chunk.split("{")[0] ?? "").trim();
      if (text === "" || text === ".dark" || text.startsWith(":root") || text.startsWith("@"))
        continue;
      expect(text).toContain("bwc-");
    }
  });
});

describe("unstyled opt-out", () => {
  // Shell/Tailwind interop: every selector matching an author-supplied node
  // must leave `[data-bwc-unstyled]` elements alone, so Tailwind-styled pages
  // (like this docs shell) can opt their own parts out while demos stay
  // themed. `:where()` alone cannot do this: the shipped site puts Tailwind
  // utilities in cascade layers while theme.css is unlayered, and unlayered
  // CSS beats layered CSS at any specificity — only `:not()` exclusion is
  // order/layer-independent.
  it("guards every author surface, close-button, and switch subject with :not([data-bwc-unstyled])", () => {
    for (const chunk of css.split("}")) {
      const head = (chunk.split("{")[0] ?? "").trim();
      if (head === "" || head === ".dark" || head.startsWith(":root") || head.startsWith("@")) {
        continue;
      }
      for (const selector of head.split(/,(?![^(]*\))/)) {
        const text = selector.trim();
        if (text === "") continue;
        if (/\[slot=|\[data-nav-panel\]|\[data-close\]|bwc-switch button/.test(text)) {
          expect(text).toMatch(/:not\([^)]*\[data-bwc-unstyled\][^)]*\)/);
        }
      }
    }
  });
});

describe("accordion summary row", () => {
  it("vertically centers a border-box 2.75rem row without hiding the marker", () => {
    const body = ruleBody(
      'bwc-accordion\\s+details\\[slot="item"\\]:not\\(\\[data-bwc-unstyled\\]\\)\\s*>\\s*summary:not\\(\\[data-bwc-unstyled\\]\\)',
    );
    expect(body).toMatch(/min-height:\s*2\.75rem/);
    expect(body).toMatch(/display:\s*(inline-)?flex/);
    expect(body).toMatch(/align-items:\s*center/);
    // Content-box padding stacks on top of min-height, so without
    // border-box the closed row renders taller than 2.75rem.
    expect(body).toMatch(/box-sizing:\s*border-box/);
    expect(body).not.toMatch(/list-style:\s*none/);
    expect(css).not.toMatch(/marker[^}]*display:\s*none/);
  });
});

describe("dialog, toast, and navigation polish", () => {
  it("shares section structure and 1.5rem header closes across dialogs", () => {
    for (const hook of ["modal", "alert"]) {
      expect(css).toMatch(
        new RegExp(
          `bwc-${hook === "modal" ? "modal" : "alert-dialog"} \\[data-${hook}-header\\][\\s\\S]*?justify-content:\\s*space-between`,
        ),
      );
      expect(css).toMatch(
        new RegExp(
          `bwc-${hook === "modal" ? "modal" : "alert-dialog"} \\[data-${hook}-content\\][\\s\\S]*?padding:\\s*1rem`,
        ),
      );
      expect(css).toMatch(
        new RegExp(
          `bwc-${hook === "modal" ? "modal" : "alert-dialog"} \\[data-${hook}-actions\\][\\s\\S]*?justify-content:\\s*flex-end`,
        ),
      );
    }
    const compactClose = ruleBody(
      "bwc-modal \\[data-modal-header\\]:not\\(\\[data-bwc-unstyled\\]\\)[\\s\\S]*?bwc-toast \\[data-toast-header\\]:not\\(\\[data-bwc-unstyled\\]\\) \\[data-close\\]:not\\(\\[data-bwc-unstyled\\]\\)",
    );
    expect(compactClose).toMatch(/width:\s*1\.5rem/);
    expect(compactClose).toMatch(/height:\s*1\.5rem/);
  });

  it("gives toast a responsive practical width and a heading row", () => {
    const toast = ruleBody("bwc-toast:not\\(\\[data-bwc-unstyled\\]\\)");
    expect(toast).toMatch(/min-width:\s*min\(20rem/);
    expect(toast).toMatch(/max-width:\s*min\(24rem/);
    const header = ruleBody("bwc-toast \\[data-toast-header\\]:not\\(\\[data-bwc-unstyled\\]\\)");
    expect(header).toMatch(/display:\s*flex/);
    expect(header).toMatch(/justify-content:\s*space-between/);
  });

  it("keeps navigation triggers compact and panel links structured", () => {
    const trigger = ruleBody(
      "bwc-navigation-menu \\[data-nav-trigger\\]:not\\(\\[data-bwc-unstyled\\]\\)",
    );
    expect(trigger).toMatch(/min-height:\s*2rem/);
    expect(trigger).not.toMatch(/min-width:\s*10rem/);
    expect(css).toMatch(/bwc-navigation-menu[^}]*\[data-open\]/);
    expect(css).toMatch(/bwc-navigation-menu > \[data-nav-panel\][\s\S]*?a:not/);
  });
});
