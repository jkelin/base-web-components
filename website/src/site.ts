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
  /** Sidebar category; defaults to Components. */
  category?: "Popper" | "Overlay";
  /** Live demo markup (static HTML, upgraded client-side). */
  demo: string;
  /** `change`-style event for an optional readout island. */
  readoutEvent?: string;
  /** detail key carrying the demo value, when readout is enabled. */
  readoutKey?: string;
  /** Initial readout text before the first event, when enabled. */
  readoutInitial?: string;
  /** Formats event detail for the readout, when enabled. */
  formatReadout?: (value: unknown) => string;
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
// Layout-only stage for anchored popup demos. Component appearance belongs
// exclusively to theme.css; normal side offsets keep open panels legible.
const POPUP_STAGE = "flex flex-wrap items-center gap-2";
const POPUP_STAGE_LIST = "flex flex-wrap items-center gap-2";
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
    category: "Overlay",
    title: "Modal",
    tag: "bwc-modal",
    subpath: "basic-web-components/modal",
    blurb: "Dialog overlay with modal focus and backdrop dismissal.",
    demo: `<bwc-modal id="demo-modal" data-testid="demo-modal" class="flex flex-wrap items-center gap-2">
  <button slot="trigger" id="demo-modal-trigger" data-testid="demo-modal-trigger">Open dialog</button>
  <dialog slot="popup" id="demo-modal-popup" data-testid="demo-modal-popup">
    <header data-modal-header id="demo-modal-header" data-testid="demo-modal-header">
      <h2 data-title id="demo-modal-title" data-testid="demo-modal-title">Confirm changes?</h2>
      <button data-close id="demo-modal-close" data-testid="demo-modal-close" title="Close">×</button>
    </header>
    <div data-modal-content id="demo-modal-content" data-testid="demo-modal-content">
      <p data-description id="demo-modal-description" data-testid="demo-modal-description">Backdrop click or Escape also closes.</p>
    </div>
    <div data-modal-actions id="demo-modal-actions" data-testid="demo-modal-actions">
      <button data-close id="demo-modal-cancel" data-testid="demo-modal-cancel">Cancel</button>
      <button data-action data-close id="demo-modal-confirm" data-testid="demo-modal-confirm">Confirm</button>
    </div>
  </dialog>
</bwc-modal>`,
  },
  {
    slug: "popover",
    category: "Popper",
    title: "Popover",
    tag: "bwc-popover",
    subpath: "basic-web-components/popover",
    blurb: "Non-modal floating panel on the native popover API.",
    demo: `<div class="${POPUP_STAGE}">
  <bwc-popover id="demo-popover" data-testid="demo-popover" side="bottom" side-offset="8" class="inline-flex">
  <button slot="trigger" id="demo-popover-trigger" data-testid="demo-popover-trigger">Options</button>
  <div slot="popup" id="demo-popover-popup" data-testid="demo-popover-popup">
    <p>Popover content</p>
    <button data-close id="demo-popover-close" data-testid="demo-popover-close">Close</button>
  </div>
  </bwc-popover>
</div>`,
  },
  {
    slug: "tooltip",
    category: "Popper",
    title: "Tooltip",
    tag: "bwc-tooltip",
    subpath: "basic-web-components/tooltip",
    blurb: "Non-modal hover tooltip with open/close delays.",
    demo: `<div class="${POPUP_STAGE}">
  <bwc-tooltip id="demo-tooltip" data-testid="demo-tooltip" side="top" align="center" side-offset="8" delay="300" close-delay="150" close-on-click="false" class="inline-flex">
    <button slot="trigger" id="demo-tooltip-trigger" data-testid="demo-tooltip-trigger">Save</button>
    <div slot="popup" id="demo-tooltip-popup" data-testid="demo-tooltip-popup">Saves the current file<span data-arrow></span></div>
  </bwc-tooltip>
</div>`,
  },
  {
    slug: "preview-card",
    category: "Popper",
    title: "Preview card",
    tag: "bwc-preview-card",
    subpath: "basic-web-components/preview-card",
    blurb: "Link preview card that opens on hover or focus.",
    demo: `<div class="${POPUP_STAGE}">
  <bwc-preview-card id="demo-preview-card" data-testid="demo-preview-card" side="bottom" align="start" side-offset="8" delay="300" close-delay="150" class="inline-flex">
    <a slot="trigger" id="demo-preview-card-trigger" data-testid="demo-preview-card-trigger" href="./popover.html">Popover docs</a>
    <div slot="popup" id="demo-preview-card-popup" data-testid="demo-preview-card-popup">Floating panels without focus traps.<span data-arrow></span></div>
  </bwc-preview-card>
</div>`,
  },
  {
    slug: "menu",
    category: "Popper",
    title: "Menu",
    tag: "bwc-menu",
    subpath: "basic-web-components/menu",
    blurb: "Floating action menu anchored to a trigger button.",
    demo: `<div class="${POPUP_STAGE_LIST}">
  <bwc-menu id="demo-menu" data-testid="demo-menu" side="bottom" align="start" side-offset="8" align-offset="0" class="inline-flex">
    <button slot="trigger" id="demo-menu-trigger" data-testid="demo-menu-trigger">Options</button>
    <div slot="popup" id="demo-menu-popup" data-testid="demo-menu-popup">
      <button data-menu-item id="demo-menu-edit" data-testid="demo-menu-edit">Edit</button>
      <button data-menu-item id="demo-menu-delete" data-testid="demo-menu-delete">Delete</button>
      <button data-menu-item data-disabled id="demo-menu-archive" data-testid="demo-menu-archive">Archive</button>
      <span data-arrow></span>
    </div>
  </bwc-menu>
</div>`,
  },
  {
    slug: "context-menu",
    category: "Popper",
    title: "Context menu",
    tag: "bwc-context-menu",
    subpath: "basic-web-components/context-menu",
    blurb: "Floating menu that opens on right-click, anchored at the pointer.",
    demo: `<div class="${POPUP_STAGE_LIST}">
  <bwc-context-menu id="demo-context-menu" data-testid="demo-context-menu" side="bottom" align="start" side-offset="8" class="inline-flex">
    <div slot="trigger" id="demo-context-menu-trigger" data-testid="demo-context-menu-trigger">Right-click me</div>
    <div slot="popup" id="demo-context-menu-popup" data-testid="demo-context-menu-popup">
      <button data-menu-item id="demo-context-menu-copy" data-testid="demo-context-menu-copy">Copy</button>
      <button data-menu-item id="demo-context-menu-paste" data-testid="demo-context-menu-paste">Paste</button>
      <span data-arrow></span>
    </div>
  </bwc-context-menu>
</div>`,
  },
  {
    slug: "select",
    category: "Popper",
    title: "Select",
    tag: "bwc-select",
    subpath: "basic-web-components/select",
    blurb: "Single-value select with a floating listbox and form participation.",
    demo: `<div class="${POPUP_STAGE_LIST}">
  <bwc-select id="demo-select" data-testid="demo-select" placeholder="Pick a fruit" side="bottom" align="start" side-offset="8" match-trigger-width class="inline-flex">
    <button slot="trigger" id="demo-select-trigger" data-testid="demo-select-trigger"><span data-value></span> <span data-icon>▾</span></button>
    <div slot="popup" id="demo-select-popup" data-testid="demo-select-popup">
      <div data-option data-value="apple" id="demo-select-apple" data-testid="demo-select-apple">Apple</div>
      <div data-option data-value="banana" id="demo-select-banana" data-testid="demo-select-banana">Banana</div>
      <div data-option data-value="cherry" data-disabled id="demo-select-cherry" data-testid="demo-select-cherry">Cherry</div>
      <span data-arrow></span>
    </div>
  </bwc-select>
</div>`,
    readoutEvent: "value-change",
    readoutKey: "value",
    readoutInitial: "—",
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
    category: "Overlay",
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
  },
  {
    slug: "alert-dialog",
    category: "Overlay",
    title: "Alert dialog",
    tag: "bwc-alert-dialog",
    subpath: "basic-web-components/alert-dialog",
    blurb: "Confirmation dialog with modal backdrop and focus management.",
    demo: `<bwc-alert-dialog id="demo-alert-dialog" data-testid="demo-alert-dialog" class="flex flex-wrap items-center gap-2">
  <button slot="trigger" id="demo-alert-dialog-trigger" data-testid="demo-alert-dialog-trigger">Discard draft</button>
  <div slot="popup" id="demo-alert-dialog-popup" data-testid="demo-alert-dialog-popup">
    <header data-alert-header id="demo-alert-dialog-header" data-testid="demo-alert-dialog-header">
      <h2 data-title id="demo-alert-dialog-title" data-testid="demo-alert-dialog-title">Discard draft?</h2>
      <button data-close id="demo-alert-dialog-header-close" data-testid="demo-alert-dialog-header-close" title="Close">×</button>
    </header>
    <div data-alert-content id="demo-alert-dialog-content" data-testid="demo-alert-dialog-content">
      <p data-description id="demo-alert-dialog-description" data-testid="demo-alert-dialog-description">You can't undo this action.</p>
    </div>
    <div data-alert-actions id="demo-alert-dialog-actions" data-testid="demo-alert-dialog-actions">
      <button data-cancel id="demo-alert-dialog-cancel" data-testid="demo-alert-dialog-cancel">Cancel</button>
      <button data-action id="demo-alert-dialog-action" data-testid="demo-alert-dialog-action">Discard</button>
    </div>
  </div>
</bwc-alert-dialog>`,
  },
  {
    slug: "toast",
    category: "Overlay",
    title: "Toast",
    tag: "bwc-toast-region",
    subpath: "basic-web-components/toast",
    blurb: "Toast notifications with auto-dismiss, limits, and types.",
    demo: `<div class="flex flex-col gap-3">
  <div data-demo-source-only="toast-launchers" class="flex flex-wrap items-center gap-2">
    <button type="button" id="demo-toast-success" data-testid="demo-toast-success" class="demo-toggle" onclick="document.getElementById('demo-toast').showToast({ title: 'Saved', description: 'Your changes are live.', type: 'success' })">Success</button>
    <button type="button" id="demo-toast-error" data-testid="demo-toast-error" class="demo-toggle" onclick="document.getElementById('demo-toast').showToast({ title: 'Failed', description: 'Something went wrong.', type: 'error' })">Error</button>
    <button type="button" id="demo-toast-info" data-testid="demo-toast-info" class="demo-toggle" onclick="document.getElementById('demo-toast').showToast({ title: 'Note', description: 'For your information.', type: 'info' })">Info</button>
    <button type="button" id="demo-toast-warning" data-testid="demo-toast-warning" class="demo-toggle" onclick="document.getElementById('demo-toast').showToast({ title: 'Heads up', description: 'Review this change.', type: 'warning', actionLabel: 'Undo' })">Warning</button>
  </div>
  <bwc-toast-region id="demo-toast" data-testid="demo-toast" position="bottom-right" limit="3" duration="5000">
    <bwc-toast type="success" default-open id="demo-toast-toast" data-testid="demo-toast-toast">
      <header data-toast-header id="demo-toast-header" data-testid="demo-toast-header">
        <div data-title id="demo-toast-title" data-testid="demo-toast-title">Saved</div>
        <button data-close id="demo-toast-dismiss" data-testid="demo-toast-dismiss" title="Close">×</button>
      </header>
      <div data-description id="demo-toast-description" data-testid="demo-toast-description">Your changes are live.</div>
    </bwc-toast>
  </bwc-toast-region>
</div>`,
  },
  {
    slug: "menubar",
    category: "Popper",
    title: "Menubar",
    tag: "bwc-menubar",
    subpath: "basic-web-components/menubar",
    blurb: "Coordinated menu bar with hover switching and a single-open invariant.",
    demo: `<bwc-menubar id="demo-menubar" data-testid="demo-menubar" class="flex flex-wrap items-center gap-2">
  <bwc-menu id="demo-menubar-file" data-testid="demo-menubar-file" side-offset="8">
    <button slot="trigger" id="demo-menubar-file-trigger" data-testid="demo-menubar-file-trigger">File</button>
    <div slot="popup" id="demo-menubar-file-popup" data-testid="demo-menubar-file-popup">
      <button data-menu-item id="demo-menubar-new" data-testid="demo-menubar-new">New</button>
      <button data-menu-item id="demo-menubar-open" data-testid="demo-menubar-open">Open</button>
    </div>
  </bwc-menu>
  <bwc-menu id="demo-menubar-edit" data-testid="demo-menubar-edit" side-offset="8">
    <button slot="trigger" id="demo-menubar-edit-trigger" data-testid="demo-menubar-edit-trigger">Edit</button>
    <div slot="popup" id="demo-menubar-edit-popup" data-testid="demo-menubar-edit-popup">
      <button data-menu-item id="demo-menubar-undo" data-testid="demo-menubar-undo">Undo</button>
    </div>
  </bwc-menu>
</bwc-menubar>`,
  },
  {
    slug: "navigation-menu",
    category: "Popper",
    title: "Navigation menu",
    tag: "bwc-navigation-menu",
    subpath: "basic-web-components/navigation-menu",
    blurb: "Site navigation with hover-driven content panels and delays.",
    demo: `<bwc-navigation-menu id="demo-navigation-menu" data-testid="demo-navigation-menu" delay="200" close-delay="150" side-offset="8">
  <button data-nav-trigger data-value="overview" id="demo-navigation-menu-overview-trigger" data-testid="demo-navigation-menu-overview-trigger">Overview</button>
  <div data-nav-panel data-value="overview" id="demo-navigation-menu-overview-panel" data-testid="demo-navigation-menu-overview-panel">
    <a href="./accordion.html" id="demo-navigation-menu-quick-start" data-testid="demo-navigation-menu-quick-start">Quick start<span>Build accessible disclosure groups.</span></a>
    <a href="./modal.html" id="demo-navigation-menu-accessibility" data-testid="demo-navigation-menu-accessibility">Accessibility<span>Review focus and dismissal behavior.</span></a>
    <span data-arrow></span>
  </div>
  <button data-nav-trigger data-value="handbook" id="demo-navigation-menu-handbook-trigger" data-testid="demo-navigation-menu-handbook-trigger">Handbook</button>
  <div data-nav-panel data-value="handbook" id="demo-navigation-menu-handbook-panel" data-testid="demo-navigation-menu-handbook-panel">
    <a href="./styling.html" id="demo-navigation-menu-styling" data-testid="demo-navigation-menu-styling">Styling<span>Theme every component with ten variables.</span></a>
    <span data-arrow></span>
  </div>
</bwc-navigation-menu>`,
  },
];
