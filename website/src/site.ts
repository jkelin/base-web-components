// Shared docs metadata: imported by scripts/generate.ts (prerender) and
// referenced by vite.config.ts (page inputs). Demo markup mirrors the README
// examples and uses the real custom elements; src/client.tsx imports the
// matching package subpaths so the elements upgrade on the live page.

export interface ComponentPage {
  /** URL slug, HTML filename, and docs-markdown basename. */
  slug: string;
  /** Page title and sidebar label. */
  title: string;
  /** Custom-element tag used on the demo. */
  tag: string;
  /** Package subpath (never a dist path). */
  subpath: string;
  /** One-line blurb for the index cards and llms.txt. */
  blurb: string;
  /** Live demo markup (static HTML, upgraded client-side). */
  demo: string;
  /** `change`-style event the demo emits for the readout island. */
  readoutEvent: string;
  /** `detail` key carrying the demo value. */
  readoutKey: string;
  /** Initial readout text before the first event. */
  readoutInitial: string;
  /** Formats `event.detail[key]` for the readout. */
  formatReadout: (value: unknown) => string;
}

const BTN =
  "min-h-11 cursor-pointer rounded-md border border-stone-300 bg-white px-3 py-1.5 text-sm font-medium text-stone-900 transition hover:bg-stone-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stone-900 active:bg-stone-200 disabled:cursor-not-allowed disabled:opacity-40 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-100 dark:hover:bg-stone-800 dark:active:bg-stone-700";

const BTN_DARK =
  "min-h-11 min-w-11 cursor-pointer rounded-md border border-stone-900 bg-stone-900 px-3 py-1 text-center font-mono text-sm text-white transition hover:bg-stone-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stone-900 active:bg-stone-950 disabled:cursor-not-allowed disabled:opacity-40 dark:border-stone-100 dark:bg-stone-100 dark:text-stone-900 dark:hover:bg-white";

const OUTPUT =
  "min-w-10 rounded-md border border-stone-200 bg-stone-100 px-2 py-1 text-center font-mono text-lg tabular-nums text-stone-900 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-100";

function formatValue(value: unknown): string {
  if (Array.isArray(value)) return value.length > 0 ? value.join(", ") : "none open";
  if (typeof value === "boolean") return value ? "open" : "closed";
  if (value === "") return "—";
  return String(value);
}
/**
 * Displayed example source for the docs Code pane: the live demo markup with
 * the `id`, `data-testid`, `class`, and `*-class` part-class attributes
 * removed. The live preview keeps the full markup (ids drive readouts/tests,
 * classes drive styling).
 *
 * Edge cases (local to this function):
 * - Exact `id`/`data-testid`/`class` plus any name ending in `-class`
 *   (`button-class`/`field-class`/`thumb-class`) are removed; `for`/`side`/
 *   `side-offset` and substring traps (`classy`, `myclass`) survive because
 *   the name must equal `class` or end in `-class`.
 * - Double-quoted, single-quoted, and unquoted values are all removed; Tailwind
 *   class lists never contain the matching quote, so `[^"]*`/`[^']*` cannot
 *   overrun into neighboring attributes.
 * - The leading whitespace is consumed with the attribute, so no double spaces
 *   or trailing space before `>` remains.
 */
export function stripExampleAttributes(html: string): string {
  return html.replace(
    /\s+(?:data-testid|id|class|[A-Za-z0-9_-]+-class)="[^"]*"|\s+(?:data-testid|id|class|[A-Za-z0-9_-]+-class)='[^']*'|\s+(?:data-testid|id|class|[A-Za-z0-9_-]+-class)=[^\s"'`>=]+/g,
    "",
  );
}

export const COMPONENTS: Array<ComponentPage> = [
  {
    slug: "counter",
    title: "Counter",
    tag: "bwc-counter",
    subpath: "basic-web-components/counter",
    blurb: "Numeric stepper: two buttons around a live readout.",
    demo: `<bwc-counter id="demo-counter" data-testid="demo-counter" default-value="3" class="flex flex-wrap items-center gap-3">
  <button slot="decrement" id="demo-counter-minus" data-testid="demo-counter-minus" class="${BTN_DARK}">−</button>
  <output slot="value" id="demo-counter-label" data-testid="demo-counter-label" class="${OUTPUT}"></output>
  <button slot="increment" id="demo-counter-plus" data-testid="demo-counter-plus" class="${BTN_DARK}">+</button>
</bwc-counter>`,
    readoutEvent: "change",
    readoutKey: "value",
    readoutInitial: "3",
    formatReadout: formatValue,
  },
  {
    slug: "accordion",
    title: "Accordion",
    tag: "bwc-accordion",
    subpath: "basic-web-components/accordion",
    blurb: "Collapsible sections built on native details elements.",
    demo: `<bwc-accordion id="demo-accordion" data-testid="demo-accordion" default-value='["two"]' class="grid min-w-0 grid-cols-1 gap-2">
  <details slot="item" data-value="one" id="demo-accordion-one" data-testid="demo-accordion-one" class="rounded-md border border-stone-300 dark:border-stone-700">
    <summary id="demo-accordion-one-trigger" data-testid="demo-accordion-one-trigger" class="min-h-11 cursor-pointer px-3 py-2 text-sm font-medium select-none hover:bg-stone-100 dark:hover:bg-stone-800">One</summary>
    <div id="demo-accordion-one-panel" data-testid="demo-accordion-one-panel" class="border-t border-stone-200 px-3 py-2 text-sm text-stone-600 dark:border-stone-700 dark:text-stone-400">One content</div>
  </details>
  <details slot="item" data-value="two" id="demo-accordion-two" data-testid="demo-accordion-two" class="rounded-md border border-stone-300 dark:border-stone-700">
    <summary id="demo-accordion-two-trigger" data-testid="demo-accordion-two-trigger" class="min-h-11 cursor-pointer px-3 py-2 text-sm font-medium select-none hover:bg-stone-100 dark:hover:bg-stone-800">Two</summary>
    <div id="demo-accordion-two-panel" data-testid="demo-accordion-two-panel" class="border-t border-stone-200 px-3 py-2 text-sm text-stone-600 dark:border-stone-700 dark:text-stone-400">Two content</div>
  </details>
</bwc-accordion>`,
    readoutEvent: "value-change",
    readoutKey: "value",
    readoutInitial: "two",
    formatReadout: formatValue,
  },
  {
    slug: "modal",
    title: "Modal",
    tag: "bwc-modal",
    subpath: "basic-web-components/modal",
    blurb: "Dialog overlay with modal focus and backdrop dismissal.",
    demo: `<bwc-modal id="demo-modal" data-testid="demo-modal" class="flex flex-wrap items-center gap-2">
  <button slot="trigger" id="demo-modal-trigger" data-testid="demo-modal-trigger" class="${BTN}">Open dialog</button>
  <dialog slot="popup" id="demo-modal-popup" data-testid="demo-modal-popup" class="m-auto w-80 max-w-[calc(100vw-2rem)] rounded-lg border border-stone-300 bg-white p-4 text-sm text-stone-900 shadow-lg dark:border-stone-700 dark:bg-stone-900 dark:text-stone-100">
    <p class="font-medium">Confirm?</p>
    <p class="mt-1 text-stone-600 dark:text-stone-400">Backdrop click or Escape also closes.</p>
    <button data-close id="demo-modal-close" data-testid="demo-modal-close" class="${BTN} mt-3">Close</button>
  </dialog>
</bwc-modal>`,
    readoutEvent: "open-change",
    readoutKey: "open",
    readoutInitial: "closed",
    formatReadout: formatValue,
  },
  {
    slug: "popover",
    title: "Popover",
    tag: "bwc-popover",
    subpath: "basic-web-components/popover",
    blurb: "Non-modal floating panel on the native popover API.",
    demo: `<bwc-popover id="demo-popover" data-testid="demo-popover" side="bottom" side-offset="4" class="flex flex-wrap items-center gap-2">
  <button slot="trigger" id="demo-popover-trigger" data-testid="demo-popover-trigger" class="${BTN}">Options</button>
  <div slot="popup" id="demo-popover-popup" data-testid="demo-popover-popup" class="rounded-md border border-stone-300 bg-white p-3 text-sm shadow-lg dark:border-stone-700 dark:bg-stone-900">
    <span>Popover content</span>
    <button data-close id="demo-popover-close" data-testid="demo-popover-close" class="${BTN} ml-2">Close</button>
  </div>
</bwc-popover>`,
    readoutEvent: "open-change",
    readoutKey: "open",
    readoutInitial: "closed",
    formatReadout: formatValue,
  },
  {
    slug: "switch",
    title: "Switch",
    tag: "bwc-switch",
    subpath: "basic-web-components/switch",
    blurb: "On/off toggle with native form participation.",
    demo: `<div class="flex min-h-11 items-center gap-3 text-sm">
  <label id="demo-switch-label" data-testid="demo-switch-label" for="demo-switch-button" class="cursor-pointer font-medium select-none">Notifications</label>
  <bwc-switch id="demo-switch" data-testid="demo-switch" default-checked
    button-class="flex h-7 w-12 shrink-0 cursor-pointer items-center rounded-full border border-stone-300 bg-white px-0.5 transition hover:brightness-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stone-900 disabled:cursor-not-allowed disabled:opacity-40 data-[checked]:border-emerald-600 data-[checked]:bg-emerald-600 dark:border-stone-600 dark:bg-stone-800"
    thumb-class="size-5 rounded-full bg-stone-400 transition-transform data-[checked]:translate-x-[22px] data-[checked]:bg-white"
    input-class=""></bwc-switch>
</div>`,
    readoutEvent: "checked-change",
    readoutKey: "checked",
    readoutInitial: "on",
    formatReadout: (value) =>
      value === true ? "on" : value === false ? "off" : formatValue(value),
  },
  {
    slug: "otp",
    title: "OTP",
    tag: "bwc-otp",
    subpath: "basic-web-components/otp",
    blurb: "One-time-code input with generated fields and a hidden form input.",
    demo: `<bwc-otp id="demo-otp" data-testid="demo-otp" length="4" validation-type="numeric" name="demo-code"
  field-class="h-11 w-11 rounded-md border border-stone-300 bg-white text-center font-mono text-lg text-stone-900 outline-none hover:border-stone-400 focus-visible:border-stone-900 focus-visible:ring-2 focus-visible:ring-stone-900/15 disabled:cursor-not-allowed disabled:opacity-40 data-[complete]:border-emerald-600 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-100"
  hidden-input-class=""
  class="flex flex-wrap gap-2"></bwc-otp>`,
    readoutEvent: "value-change",
    readoutKey: "value",
    readoutInitial: "—",
    formatReadout: formatValue,
  },
  {
    slug: "tabs",
    title: "Tabs",
    tag: "bwc-tabs",
    subpath: "basic-web-components/tabs",
    blurb: "Tabbed interface with matched panels, one visible at a time.",
    demo: `<bwc-tabs id="demo-tabs" data-testid="demo-tabs" default-value="one" class="grid min-w-0 grid-cols-1 gap-2">
  <div slot="list" class="flex min-w-0 gap-1 overflow-x-auto border-b border-stone-200 dark:border-stone-800">
    <button id="demo-tab-one" data-testid="demo-tab-one" value="one" class="min-h-11 cursor-pointer rounded-t border-b-2 border-transparent px-3 py-1.5 text-sm whitespace-nowrap text-stone-500 transition hover:text-stone-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stone-900 aria-selected:border-emerald-600 aria-selected:font-semibold aria-selected:text-stone-900 disabled:cursor-not-allowed disabled:opacity-40 dark:text-stone-400 dark:hover:text-stone-100 dark:aria-selected:text-stone-100">One</button>
    <button id="demo-tab-two" data-testid="demo-tab-two" value="two" class="min-h-11 cursor-pointer rounded-t border-b-2 border-transparent px-3 py-1.5 text-sm whitespace-nowrap text-stone-500 transition hover:text-stone-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stone-900 aria-selected:border-emerald-600 aria-selected:font-semibold aria-selected:text-stone-900 disabled:cursor-not-allowed disabled:opacity-40 dark:text-stone-400 dark:hover:text-stone-100 dark:aria-selected:text-stone-100">Two</button>
  </div>
  <section slot="panel" data-value="one" id="demo-tab-panel-one" data-testid="demo-tab-panel-one" class="rounded-md border border-stone-200 p-3 text-sm dark:border-stone-800">One panel</section>
  <section slot="panel" data-value="two" id="demo-tab-panel-two" data-testid="demo-tab-panel-two" class="rounded-md border border-stone-200 p-3 text-sm dark:border-stone-800">Two panel</section>
</bwc-tabs>`,
    readoutEvent: "value-change",
    readoutKey: "value",
    readoutInitial: "one",
    formatReadout: formatValue,
  },
  {
    slug: "slide-out",
    title: "Slide-out",
    tag: "bwc-slide-out",
    subpath: "basic-web-components/slide-out",
    blurb: "Non-modal drawer panel with overlay dismissal and focus management.",
    demo: `<bwc-slide-out id="demo-slide-out" data-testid="demo-slide-out" class="flex flex-wrap items-center gap-2">
  <button slot="trigger" id="demo-slide-out-trigger" data-testid="demo-slide-out-trigger" class="${BTN}">Open panel</button>
  <nav slot="panel" id="demo-slide-out-panel" data-testid="demo-slide-out-panel" class="bg-white p-4 dark:bg-stone-900">
    <a href="./counter.html" id="demo-slide-out-counter" data-testid="demo-slide-out-counter" class="block rounded-md px-3 py-2 text-sm text-stone-600 transition hover:bg-stone-200/70 hover:text-stone-900 dark:text-stone-400 dark:hover:bg-stone-800 dark:hover:text-stone-100">Counter</a>
    <button data-close id="demo-slide-out-close" data-testid="demo-slide-out-close" class="${BTN} mt-3">Close</button>
  </nav>
</bwc-slide-out>`,
    readoutEvent: "open-change",
    readoutKey: "open",
    readoutInitial: "closed",
    formatReadout: formatValue,
  },
];
