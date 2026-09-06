// Shell/theme interop repro: the site shell renders its own Tailwind icon
// buttons (styling trigger, hamburger, menu close) plus its popover/panel
// surfaces inside bwc-* hosts while loading theme.css globally. The theme's
// host+attribute selectors (0,1,1) beat single-class Tailwind utilities
// (0,1,0) — and, being unlayered, beat the layered Tailwind output at any
// specificity — painting the shell buttons as black primary triggers. The
// shell therefore opts its parts out via `data-bwc-unstyled`, which every
// theme trigger/close/popup/panel selector must respect.
import { Window } from "happy-dom";
// @ts-ignore: bun:test types ship with the Bun runtime, not as a workspace package.
import { describe, expect, it } from "bun:test";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const THEME = join(ROOT, "..", "packages", "basic-web-components", "src", "theme.css");

async function shellHtml(): Promise<string> {
  try {
    return await readFile(join(ROOT, "dist", "index.html"), "utf8");
  } catch {
    throw new Error("no built dist/index.html — run `bun run build` from website/ first");
  }
}

function taggedElement(page: string, testid: string): string {
  const match = new RegExp(`<[^>]*data-testid="${testid}"[^>]*>`).exec(page);
  if (!match) throw new Error(`dist/index.html contains no ${testid}`);
  return match[0];
}

describe("shell theme opt-out", () => {
  it("marks every shell themed part data-bwc-unstyled", async () => {
    const page = await shellHtml();
    for (const testid of [
      "styling-trigger",
      "styling-popup",
      "menu-button",
      "menu-panel",
      "menu-close",
    ]) {
      expect(taggedElement(page, testid)).toContain("data-bwc-unstyled");
    }
  });

  it("excludes opted-out parts from every shell-relevant theme selector", async () => {
    const css = (await readFile(THEME, "utf8")).replace(/\/\*[\s\S]*?\*\//g, "");
    for (const chunk of css.split("}")) {
      const head = (chunk.split("{")[0] ?? "").trim();
      if (head === "") continue;
      for (const selector of head.split(",")) {
        const text = selector.trim();
        if (text === "") continue;
        if (
          /\[slot="(trigger|popup|panel)"\]|\[data-close\]|\[slot="panel"\] a/.test(text) &&
          /bwc-(popover|slide-out)/.test(text)
        ) {
          expect(text).toContain(":not([data-bwc-unstyled])");
        }
      }
    }
  });
});

describe("shell theme matching", () => {
  // Engine-level proof, beyond source-text assertions above: the shipped
  // selectors must actually match plain shell parts and unmatch the same
  // parts once opted out.
  it("matches plain shell parts but unmatches data-bwc-unstyled ones", async () => {
    const css = (await readFile(THEME, "utf8")).replace(/\/\*[\s\S]*?\*\//g, "");
    const selectors = css
      .split("}")
      .flatMap((chunk) => (chunk.split("{")[0] ?? "").split(","))
      .map((selector) => selector.trim())
      .filter((selector) => selector !== "");
    const baseSelector = (...parts: Array<string>): string => {
      const hit = selectors.find(
        (selector) =>
          parts.every((part) => selector.includes(part)) &&
          !/:hover|:focus-visible|:disabled/.test(selector) &&
          !selector.includes(".dark"),
      );
      if (!hit) throw new Error(`theme.css has no base selector with ${parts.join(" + ")}`);
      return hit;
    };

    const window = new Window({ url: "http://localhost/" });
    const document = window.document;
    const popover = document.createElement("bwc-popover");
    const trigger = document.createElement("button");
    trigger.setAttribute("slot", "trigger");
    popover.append(trigger);
    document.body.append(popover);
    const triggerSelector = baseSelector("bwc-popover", '[slot="trigger"]');
    expect(trigger.matches(triggerSelector)).toBe(true);
    trigger.setAttribute("data-bwc-unstyled", "");
    expect(trigger.matches(triggerSelector)).toBe(false);

    const menu = document.createElement("bwc-slide-out");
    const panel = document.createElement("div");
    panel.setAttribute("slot", "panel");
    const close = document.createElement("button");
    close.setAttribute("data-close", "");
    const link = document.createElement("a");
    link.setAttribute("href", "./accordion.html");
    panel.append(close, link);
    menu.append(panel);
    document.body.append(menu);
    const closeSelector = baseSelector("bwc-slide-out", "[data-close]");
    expect(close.matches(closeSelector)).toBe(true);
    close.setAttribute("data-bwc-unstyled", "");
    expect(close.matches(closeSelector)).toBe(false);

    const linkSelector = baseSelector("bwc-slide-out", '[slot="panel"]', " a");
    expect(link.matches(linkSelector)).toBe(true);
    panel.setAttribute("data-bwc-unstyled", "");
    expect(link.matches(linkSelector)).toBe(false);
    await window.happyDOM.close();
  });
});
