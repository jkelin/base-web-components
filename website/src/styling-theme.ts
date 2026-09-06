// Theme configurator state: defaults, controls, storage, and CSS output.
// JSX-free so bun:test can import it (Solid component lives in styling.tsx).

export const STORAGE_KEY = "bwc-theme-vars";
/** Defaults mirror packages/basic-web-components src/theme.css `:root`. */
export const THEME_DEFAULTS: Record<string, string> = {
  "--bwc-background": "#ffffff",
  "--bwc-foreground": "#09090b",
  "--bwc-primary": "#18181b",
  "--bwc-primary-foreground": "#fafafa",
  "--bwc-secondary": "#f4f4f5",
  "--bwc-muted": "#71717a",
  "--bwc-accent": "#e4e4e7",
  "--bwc-border": "#e4e4e7",
  "--bwc-radius": "0.5rem",
  "--bwc-font-size": "0.875rem",
};

export interface Control {
  name: string;
  label: string;
  kind: "color" | "size";
  min?: number;
  max?: number;
  step?: number;
}

/** Row order in the form: colors first, then the two sizing variables. */
export const CONTROLS: Array<Control> = [
  { name: "--bwc-background", label: "Background", kind: "color" },
  { name: "--bwc-foreground", label: "Foreground", kind: "color" },
  { name: "--bwc-primary", label: "Primary", kind: "color" },
  { name: "--bwc-primary-foreground", label: "On primary", kind: "color" },
  { name: "--bwc-secondary", label: "Secondary", kind: "color" },
  { name: "--bwc-muted", label: "Muted", kind: "color" },
  { name: "--bwc-accent", label: "Accent", kind: "color" },
  { name: "--bwc-border", label: "Border", kind: "color" },
  { name: "--bwc-radius", label: "Radius", kind: "size", min: 0, max: 1, step: 0.0625 },
  { name: "--bwc-font-size", label: "Font size", kind: "size", min: 0.75, max: 1.25, step: 0.0625 },
];

/** `0.5rem` -> 0.5; anything unparsable -> fallback. */
export function parseRem(value: string, fallback: number): number {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

/** `:root` CSS block for the snippet and clipboard copy. */
export function buildRootCss(vars: Record<string, string>): string {
  const lines = Object.keys(THEME_DEFAULTS).map((name) => `  ${name}: ${vars[name] ?? ""};`);
  return `:root {\n${lines.join("\n")}\n}`;
}

export function readStoredTheme(): Record<string, string> | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (typeof parsed !== "object" || parsed === null) return null;
    const vars: Record<string, string> = {};
    for (const name of Object.keys(THEME_DEFAULTS)) {
      const value = (parsed as Record<string, unknown>)[name];
      if (typeof value === "string" && value.length > 0) vars[name] = value;
    }
    return vars;
  } catch {
    return null;
  }
}

/** Applies vars to `<html>`; empty map clears every override. */
export function applyTheme(vars: Record<string, string>): void {
  const root = document.documentElement;
  for (const name of Object.keys(THEME_DEFAULTS)) {
    if (name in vars) root.style.setProperty(name, vars[name] as string);
    else root.style.removeProperty(name);
  }
}

export function persistTheme(vars: Record<string, string>): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(vars));
  } catch {
    // Private-mode storage failure must not break the configurator.
  }
}

/** Restores the saved theme (or clears overrides when nothing is saved). */
export function restoreTheme(): void {
  applyTheme(readStoredTheme() ?? {});
}
