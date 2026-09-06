// @ts-ignore: bun:test types ship with the Bun runtime, not as a workspace package.
import { describe, expect, it } from "bun:test";
import { Window } from "happy-dom";
import {
  applyTheme,
  buildRootCss,
  CONTROLS,
  parseRem,
  persistTheme,
  readStoredTheme,
  restoreTheme,
  THEME_DEFAULTS,
} from "./styling-theme.ts";

const window = new Window({ url: "http://localhost/" });
const globals = globalThis as unknown as Record<string, unknown>;
const scope = window as unknown as Record<string, unknown>;
for (const key of Object.getOwnPropertyNames(scope)) {
  if (!(key in globals)) {
    try {
      globals[key] = scope[key];
    } catch {
      // Read-only globals stay untouched.
    }
  }
}

describe("theme defaults", () => {
  it("holds exactly ten --bwc-* variables", () => {
    expect(Object.keys(THEME_DEFAULTS)).toHaveLength(10);
    for (const name of Object.keys(THEME_DEFAULTS)) {
      expect(name.startsWith("--bwc-")).toBe(true);
    }
  });

  it("covers every variable with exactly one control", () => {
    const names = CONTROLS.map((control) => control.name).sort();
    expect(names).toEqual(Object.keys(THEME_DEFAULTS).sort());
  });
});

describe("buildRootCss", () => {
  it("emits a :root block with one line per variable", () => {
    const css = buildRootCss(THEME_DEFAULTS);
    expect(css.startsWith(":root {\n")).toBe(true);
    expect(css.endsWith("\n}")).toBe(true);
    for (const [name, value] of Object.entries(THEME_DEFAULTS)) {
      expect(css).toContain(`  ${name}: ${value};`);
    }
  });
});

describe("parseRem", () => {
  it.each([
    ["0.5rem", 0.5],
    ["1rem", 1],
    ["0.875rem", 0.875],
  ])("parses %s", (input: string, expected: number) => {
    expect(parseRem(input, 0)).toBe(expected);
  });

  it("falls back on garbage", () => {
    expect(parseRem("hotpink", 0.5)).toBe(0.5);
    expect(parseRem("", 1)).toBe(1);
  });
});

describe("theme persistence", () => {
  it("round-trips vars through localStorage onto <html>", () => {
    const vars = { ...THEME_DEFAULTS, "--bwc-primary": "#4f46e5" };
    persistTheme(vars);
    expect(readStoredTheme()).toEqual(vars);

    applyTheme(vars);
    expect(document.documentElement.style.getPropertyValue("--bwc-primary")).toBe("#4f46e5");

    restoreTheme();
    expect(document.documentElement.style.getPropertyValue("--bwc-primary")).toBe("#4f46e5");
  });

  it("reset path clears overrides when storage is empty", () => {
    localStorage.clear();
    expect(readStoredTheme()).toBeNull();
    document.documentElement.style.setProperty("--bwc-primary", "#4f46e5");
    restoreTheme();
    expect(document.documentElement.style.getPropertyValue("--bwc-primary")).toBe("");
  });

  it("ignores corrupt storage", () => {
    localStorage.setItem("bwc-theme-vars", "not-json{{{");
    expect(readStoredTheme()).toBeNull();
  });
});
