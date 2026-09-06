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

// Demo surfaces use basic-web-components/theme.css (loaded by src/client.tsx)
// with zero author classes — selectors are rooted at the component hosts;
// Tailwind here is layout-only (flex/grid spacing around demos) so the
// configurator re-skins every demo.

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
 * layout Tailwind positions the demos; the theme needs no classes).
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
    slug: "accordion",
    title: "Accordion",
    tag: "bwc-accordion",
    subpath: "basic-web-components/accordion",
    blurb: "Collapsible sections built on native details elements.",
    demo: `<bwc-accordion id="demo-accordion" data-testid="demo-accordion" default-value='["two"]' class="grid min-w-0 grid-cols-1 gap-2">
  <details slot="item" data-value="one" id="demo-accordion-one" data-testid="demo-accordion-one">
    <summary id="demo-accordion-one-trigger" data-testid="demo-accordion-one-trigger">One</summary>
    <div id="demo-accordion-one-panel" data-testid="demo-accordion-one-panel">One content</div>
  </details>
  <details slot="item" data-value="two" id="demo-accordion-two" data-testid="demo-accordion-two">
    <summary id="demo-accordion-two-trigger" data-testid="demo-accordion-two-trigger">Two</summary>
    <div id="demo-accordion-two-panel" data-testid="demo-accordion-two-panel">Two content</div>
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
  <button slot="trigger" id="demo-modal-trigger" data-testid="demo-modal-trigger">Open dialog</button>
  <dialog slot="popup" id="demo-modal-popup" data-testid="demo-modal-popup">
    <p><strong>Confirm?</strong></p>
    <p>Backdrop click or Escape also closes.</p>
    <button data-close id="demo-modal-close" data-testid="demo-modal-close">Close</button>
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
  <button slot="trigger" id="demo-popover-trigger" data-testid="demo-popover-trigger">Options</button>
  <div slot="popup" id="demo-popover-popup" data-testid="demo-popover-popup">
    <p>Popover content</p>
    <button data-close id="demo-popover-close" data-testid="demo-popover-close">Close</button>
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
    demo: `<div class="flex items-center gap-3">
  <label id="demo-switch-label" data-testid="demo-switch-label" for="demo-switch-button">Notifications</label>
  <bwc-switch id="demo-switch" data-testid="demo-switch" default-checked></bwc-switch>
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
  <div slot="list" class="min-w-0 overflow-x-auto">
    <button id="demo-tab-one" data-testid="demo-tab-one" value="one">One</button>
    <button id="demo-tab-two" data-testid="demo-tab-two" value="two">Two</button>
  </div>
  <section slot="panel" data-value="one" id="demo-tab-panel-one" data-testid="demo-tab-panel-one">One panel</section>
  <section slot="panel" data-value="two" id="demo-tab-panel-two" data-testid="demo-tab-panel-two">Two panel</section>
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
  <button slot="trigger" id="demo-slide-out-trigger" data-testid="demo-slide-out-trigger">Open panel</button>
  <nav slot="panel" id="demo-slide-out-panel" data-testid="demo-slide-out-panel">
    <a href="./accordion.html" id="demo-slide-out-accordion" data-testid="demo-slide-out-accordion">Accordion</a>
    <button data-close id="demo-slide-out-close" data-testid="demo-slide-out-close">Close</button>
  </nav>
</bwc-slide-out>`,
    readoutEvent: "open-change",
    readoutKey: "open",
    readoutInitial: "closed",
    formatReadout: formatValue,
  },
];
