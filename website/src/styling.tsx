import { createMemo, createSignal } from "solid-js";
import { render } from "@solidjs/web";
import {
  CONTROLS,
  STORAGE_KEY,
  THEME_DEFAULTS,
  applyTheme,
  buildRootCss,
  parseRem,
  persistTheme,
  readStoredTheme,
  restoreTheme,
} from "./styling-theme";

function slug(name: string): string {
  return name.replace(/^--bwc-/, "");
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Clipboard API unavailable (permissions, insecure context): fall back
    // to an ephemeral textarea + execCommand.
    try {
      const area = document.createElement("textarea");
      area.value = text;
      area.style.position = "fixed";
      area.style.opacity = "0";
      document.body.appendChild(area);
      area.select();
      const ok = document.execCommand("copy");
      area.remove();
      return ok;
    } catch {
      return false;
    }
  }
}

const rowClass = "flex items-center gap-2";
const labelClass = "w-24 shrink-0 text-xs font-medium text-stone-600 dark:text-stone-400";
const textClass =
  "h-8 w-full min-w-0 flex-1 rounded-md border border-stone-300 bg-white px-2 font-mono text-xs text-stone-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stone-900 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-100";

/** Configurator form with live page re-theme. The `:root` snippet renders only
 *  when `showSnippet` (styling page); the header popover embeds the same form
 *  with just form-row buttons and no snippet. */
export function StylingConfigurator(props: { showSnippet: boolean }) {
  const [vars, setVars] = createSignal<Record<string, string>>({
    ...THEME_DEFAULTS,
    ...readStoredTheme(),
  });
  const [copied, setCopied] = createSignal(false);

  const css = createMemo(() => buildRootCss(vars()));

  const update = (name: string, value: string): void => {
    const next = { ...vars(), [name]: value };
    setVars(next);
    applyTheme(next);
    persistTheme(next);
    setCopied(false);
  };

  const reset = (): void => {
    setVars({ ...THEME_DEFAULTS });
    applyTheme({});
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Ignore private-mode failures (same contract as persistTheme).
    }
    setCopied(false);
  };

  const copy = async (): Promise<void> => {
    setCopied(await copyText(css()));
  };

  return (
    <div class="grid min-w-0 grid-cols-1 gap-4">
      <form
        aria-label="Theme settings"
        onSubmit={(event) => event.preventDefault()}
        class="grid min-w-0 grid-cols-1 gap-2"
      >
        {CONTROLS.map((control) => (
          <div class={rowClass}>
            <label for={`styling-${slug(control.name)}`} class={labelClass}>
              {control.label}
            </label>
            {control.kind === "color" ? (
              <>
                <input
                  type="color"
                  id={`styling-${slug(control.name)}`}
                  data-testid={`styling-${slug(control.name)}`}
                  value={vars()[control.name]}
                  onInput={(event) => update(control.name, event.target.value)}
                  class="h-8 w-10 shrink-0 cursor-pointer rounded-md border border-stone-300 bg-white p-0.5 dark:border-stone-700 dark:bg-stone-900"
                />
                <input
                  type="text"
                  id={`styling-${slug(control.name)}-text`}
                  data-testid={`styling-${slug(control.name)}-text`}
                  value={vars()[control.name]}
                  onInput={(event) => update(control.name, event.target.value)}
                  spellcheck={false}
                  class={textClass}
                />
              </>
            ) : (
              <>
                <input
                  type="range"
                  id={`styling-${slug(control.name)}`}
                  data-testid={`styling-${slug(control.name)}`}
                  min={control.min}
                  max={control.max}
                  step={control.step}
                  value={parseRem(vars()[control.name] ?? "", control.min ?? 0)}
                  onInput={(event) => update(control.name, `${event.target.value}rem`)}
                  class="h-8 min-w-0 flex-1 cursor-pointer"
                />
                <input
                  type="text"
                  id={`styling-${slug(control.name)}-text`}
                  data-testid={`styling-${slug(control.name)}-text`}
                  value={vars()[control.name]}
                  onInput={(event) => update(control.name, event.target.value)}
                  spellcheck={false}
                  class={`${textClass} max-w-24`}
                />
              </>
            )}
          </div>
        ))}
        <div class="mt-1 flex flex-wrap items-center justify-end gap-2">
          <button
            type="button"
            id={props.showSnippet ? "styling-reset" : "styling-reset-popover"}
            data-testid={props.showSnippet ? "styling-reset" : "styling-reset-popover"}
            onClick={reset}
            class="inline-flex min-h-11 cursor-pointer items-center justify-center rounded-md border border-stone-300 bg-white px-3 py-1.5 text-sm font-medium text-stone-900 transition hover:bg-stone-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stone-900 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-100 dark:hover:bg-stone-800"
          >
            Reset
          </button>
          <button
            type="button"
            id={props.showSnippet ? "styling-copy" : "styling-copy-popover"}
            data-testid={props.showSnippet ? "styling-copy" : "styling-copy-popover"}
            onClick={() => void copy()}
            class="inline-flex min-h-11 cursor-pointer items-center justify-center rounded-md border border-stone-900 bg-stone-900 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-stone-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stone-900 dark:border-stone-100 dark:bg-stone-100 dark:text-stone-900 dark:hover:bg-stone-300"
          >
            {copied() ? "Copied" : "Copy CSS"}
          </button>
        </div>
      </form>
      {props.showSnippet && (
        <div class="grid min-w-0 grid-cols-1 gap-2">
          <p class="text-xs font-semibold tracking-[0.12em] text-stone-500 uppercase select-none dark:text-stone-400">
            Current theme
          </p>
          <pre
            id="styling-snippet"
            data-testid="styling-snippet"
            data-syntax-theme="github"
            class="overflow-x-auto rounded-lg"
          >
            <code class="language-css">{css()}</code>
          </pre>
        </div>
      )}
    </div>
  );
}

const boundMounts = new WeakSet<Element>();

function mountInto(id: string, showSnippet: boolean): void {
  const mount = document.getElementById(id);
  if (!mount || boundMounts.has(mount)) return;
  boundMounts.add(mount);
  mount.textContent = "";
  render(() => <StylingConfigurator showSnippet={showSnippet} />, mount);
}

/** Mounts the page + header-popover configurators; re-runs after each SPA
 *  page swap (fresh `#main` nodes). Idempotent per mount element. */
export function mountStylingIslands(): void {
  restoreTheme();
  mountInto("styling-configurator-mount", true);
  mountInto("styling-popover-mount", false);
}
