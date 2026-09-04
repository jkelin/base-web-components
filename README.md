# Web component bundle comparison

Eight packages retain their existing compound counters. Seven implementations
also register six unstyled, light-DOM suites: accordion, modal, popover,
toggle-checkbox, OTP field, and tabs. The suite prefixes are `vanilla`, `o`,
`solid`, `atomico`, `preact`, `lit`, and `svelte`. Importing a bundle
self-registers its elements.

## Protocol

- No shadow DOM anywhere: each child host renders a plain inner control as a
  direct child (`button` for the two buttons, `span` with `aria-live="polite"`
  for the label), so page stylesheets (e.g. Tailwind utilities on the host
  `class`) reach the controls without shadow piercing.
- Host `class` is forwarded onto the inner control after a stable marker
  class: `counter-minus-button` / `counter-label` / `counter-plus-button`.
- Inner controls carry `data-testid` equal to the child tag
  (e.g. `vanilla-counter-label`) and no `id`s.
- Parent API: `default-value` attribute / `defaultValue` property is the
  uncontrolled initial count; `value` attribute / property switches to
  controlled mode (clicks notify but only an external `value` set re-renders).
  `onChange` property plus a bubbling, composed `change` event with
  `detail: { value }` notify on every step.
- Lenient numeric coercion shared by all packages: numbers pass through
  (truncated), strings are trimmed then converted, anything non-finite
  becomes `0`.

### Additive suite contract

- Leaf hosts render one native interactive control as their direct child. The
  stable marker class precedes live host classes; controls expose stable
  `data-testid` values and native cursor affordances.
- `value`, `open`, and `checked` are controlled once assigned. Interactions
  report the requested next state through callbacks and bubbling, composed
  `*-change` events without changing controlled rendering.
- State is mirrored through Base UI-style `data-*` attributes and ARIA.
  Invalid OTP lengths, enum values, and duplicate or empty item values throw
  clear errors.
- Modal popups use native `<dialog>`; popovers use the native Popover API.
  Both retain light DOM. Parser-order synchronization is deferred and
  observers/listeners are removed on disconnect.
- Generated ARIA IDs are deterministic per bundle. An authored host `id`
  becomes the inner-control prefix; otherwise a stable tag counter is used.

### Anatomy

```html
<P-accordion default-value='["shipping"]'>
  <P-accordion-item value="shipping">
    <P-accordion-trigger>Shipping</P-accordion-trigger>
    <P-accordion-panel>Selectable content</P-accordion-panel>
  </P-accordion-item>
</P-accordion>

<P-modal>
  <P-modal-trigger>Open</P-modal-trigger>
  <P-modal-popup>Content <P-modal-close>Close</P-modal-close></P-modal-popup>
</P-modal>

<P-popover side="bottom" side-offset="8">
  <P-popover-trigger>Open</P-popover-trigger>
  <P-popover-popup>Content</P-popover-popup>
</P-popover>

<P-toggle-checkbox name="enabled" aria-label="Enabled"></P-toggle-checkbox>
<P-otp-field length="6" validation-type="numeric" name="code"></P-otp-field>

<P-tabs default-value="overview">
  <P-tabs-list>
    <P-tab value="overview">Overview</P-tab>
    <P-tab value="details">Details</P-tab>
  </P-tabs-list>
  <P-tab-panel value="overview">Overview panel</P-tab-panel>
  <P-tab-panel value="details">Details panel</P-tab-panel>
</P-tabs>
```

Replace `P` with `vanilla`, `o`, `solid`, `atomico`, `preact`, `lit`, or
`svelte`. The optimized suite uses readable short-prefix tags such as
`o-accordion`, `o-modal`, and `o-tabs`; only its legacy counter uses
`o-c` / `o-m` / `o-l` / `o-p`. Properties use camelCase (`defaultValue`,
`defaultOpen`, `defaultChecked`, `sideOffset`, `validationType`,
`activationMode`); attributes use kebab-case.

## Commands

```sh
bun install
bun run typecheck
bun run test
bun run build
bun run size
```

After building, run `bunx vite --host 127.0.0.1 --port 4173` and open
`http://127.0.0.1:4173/smoke.html` for the framework-free browser smoke
scenario.

## Usage

`smoke.html` imports all seven suite bundles, exercises each counter, and
mounts all 42 additive suites (`6 × 7`). It verifies accordion, checkbox, and
tabs interaction in every implementation. The visible fixtures apply consumer
Tailwind classes while component modules remain unstyled. A controlled
`<vanilla-counter value="5">` demonstrates consumer-authoritative updates.

Direct browser scripts:

```html
<script type="module" src="./packages/web-components-vanilla/dist/vanilla-counter.js"></script>
<script
  type="module"
  src="./packages/web-components-vanilla-optimized/dist/optimized-counter.js"
></script>
<script type="module" src="./packages/web-components-solidjs/dist/solid-counter.js"></script>
<script type="module" src="./packages/web-components-atomico/dist/atomico-counter.js"></script>
<script type="module" src="./packages/web-components-preact/dist/preact-counter.js"></script>
<script type="module" src="./packages/web-components-lit/dist/lit-counter.js"></script>
<script type="module" src="./packages/web-components-svelte/dist/svelte-counter.js"></script>

<vanilla-counter default-value="3">
  <vanilla-counter-minus-button></vanilla-counter-minus-button>
  <vanilla-counter-label></vanilla-counter-label>
  <vanilla-counter-plus-button></vanilla-counter-plus-button>
</vanilla-counter>
```

Package module imports:

```js
import "@webcomponents/vanilla-counter";
import "@webcomponents/vanilla-optimized-counter";
import "@webcomponents/solid-counter";
import "@webcomponents/atomico-counter";
import "@webcomponents/preact-counter";
import "@webcomponents/lit-counter";
import "@webcomponents/svelte-counter";
```

| Package                                    | Counter tags                       | Suite prefix | Production output                                                     |
| ------------------------------------------ | ---------------------------------- | ------------ | --------------------------------------------------------------------- |
| `@webcomponents/vanilla-counter`           | `<vanilla-counter>` family         | `vanilla-*`  | `packages/web-components-vanilla/dist/vanilla-counter.js`             |
| `@webcomponents/vanilla-optimized-counter` | `<o-c>`, `<o-m>`, `<o-l>`, `<o-p>` | `o-*`        | `packages/web-components-vanilla-optimized/dist/optimized-counter.js` |
| `@webcomponents/solid-counter`             | `<solid-counter>` family           | `solid-*`    | `packages/web-components-solidjs/dist/solid-counter.js`               |
| `@webcomponents/atomico-counter`           | `<atomico-counter>` family         | `atomico-*`  | `packages/web-components-atomico/dist/atomico-counter.js`             |
| `@webcomponents/preact-counter`            | `<preact-counter>` family          | `preact-*`   | `packages/web-components-preact/dist/preact-counter.js`               |
| `@webcomponents/lit-counter`               | `<lit-counter>` family             | `lit-*`      | `packages/web-components-lit/dist/lit-counter.js`                     |
| `@webcomponents/svelte-counter`            | `<svelte-counter>` family          | `svelte-*`   | `packages/web-components-svelte/dist/svelte-counter.js`               |

## Optimization

Vite library builds emit one Oxc-minified ES module targeting ES2022.
Framework runtimes are bundled, and explicit `sideEffects` entries preserve
self-registration during tree shaking.

Vite skips whitespace minification in ES library mode (to preserve pure
annotations for downstream tree shaking). Since these are final standalone
scripts that are never re-bundled, every Vite config opts back into full
minification via `build.rolldownOptions.output.minify: true`.

Sizes are reproducible with `bun run size` (gzip level 9, Brotli quality 11).
The Source column is the raw authored bytes under each package's `src/`.

| Bundle                   | Source (bytes) | Raw (bytes) | gzip -9 (bytes) | Brotli 11 (bytes) |
| ------------------------ | -------------: | ----------: | --------------: | ----------------: |
| Vanilla                  |          50846 |       26895 |            6450 |              5689 |
| Vanilla optimized        |          45515 |       24802 |            6168 |              5455 |
| Vanilla optimized manual |           5730 |         720 |             413 |               324 |
| SolidJS                  |          49151 |       33160 |           10358 |              9341 |
| Atomico                  |          52021 |       36087 |           10475 |              9403 |
| Preact                   |          36987 |       30538 |            9502 |              8538 |
| Lit                      |          37829 |       35149 |           10761 |              9705 |
| Svelte                   |          44345 |       56191 |           18610 |             16777 |

Vanilla optimized is a **non-comparable breaking variant** using `<o-c>`, `<o-m>`, `<o-l>`, and `<o-p>`; identical `vanilla-counter*` tags are impossible because co-loading the packages would make duplicate custom-element registration throw or require silently skipping a definition.

| Delta from Vanilla    | Vanilla optimized behavior                                                                                                                                                          |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Rendering observation | No `MutationObserver`; child-connect owner rendering covers the tested parser/upgrade orders.                                                                                       |
| Label state           | `<o-l>` exposes no `value` attribute; the parent writes its `<span>`.                                                                                                               |
| Default state         | `defaultValue` reflects to `default-value`.                                                                                                                                         |
| Controlled detection  | Follows live `value`-attribute presence, not a sticky flag.                                                                                                                         |
| Host click hook       | Listener-based click delegation is registered on connect and removed on disconnect; author host `onclick` is unaffected; the bubbling `change` event remains the notification path. |
