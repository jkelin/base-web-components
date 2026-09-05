# ASGENTS.md — basic-web-components

Single vanilla library (`basic-web-components`, prefix `bwc`). No shadow DOM.
No CDN in the repo: smoke CSS is local.

## Toolchain

- Bun only: `bun install`, `bun run <script>`. Never npm/pnpm/yarn/node.
- Focused validation: run the script for the touched workspace only
  (`bun run --filter <name> <script>`). Never full-project sweeps for a local change.
- Lint then format, once, at the end: `lint` (oxlint), then `format` (oxfmt).
  No repeated lint/format loops during implementation.

## Library layout

- One folder per component under `src/`: `counter/`, `accordion/`, `modal/`,
  `popover/`, `switch/`, `otp/`, `tabs/`. Shared code lives
  only in `src/shared/index.ts`; never cross-import between component folders.
- Each folder owns colocated behavioral tests (`*.test.ts` next to the source).
  Tests assert observable behavior (rendered state, events, ARIA), never wiring.

## Component rules

- Declare every public property once: attribute-backed (`"value": "value"`)
  or callback-only (`onChange: null`). Only attribute-backed declarations
  get signals, observed attributes, and attribute sync; callback-only
  properties install plain descriptors, accept function-or-null (validated,
  e.g. via `callbackValue`), and are captured/restored through setters on
  reconnect while attribute-backed state rebuilds from attributes. Missing
  or duplicate installation throws.
- Children resolve and share the parent context on connect, throwing when
  the required parent is absent; parent contexts register children on
  connect and unregister them on disconnect.
- Every effect/listener/observer created on connect is disposed on disconnect,
  and re-created on reconnect. `onclick`-style author handlers are never clobbered.
- Part-class props (`button-class`, `thumb-class`, `input-class`;
  `trigger-class`, `popup-class`, `close-class`; `field-class`,
  `hidden-input-class`) carry plain space-separated Tailwind strings merged
  after the stable marker class by part controllers. `bwc-switch` generates
  its button/thumb/input (never author them); `bwc-otp` generates exactly
  `length` native `input` fields plus one hidden form input (no `bwc-otp-field`
  tag; generated fields carry `data-testid="bwc-otp-input"`). Validate at the
  boundary and throw clear errors:
  invalid enum values, duplicate or empty item values. Never coerce silently,
  never fall back silently.

## Native hosts

- Interactive leaves are customized built-ins on native hosts (`button`, `span`,
  `dialog`, `div`): construct with `document.createElement(tag, { is: name })`
  or parse `<tag is="name">`. Customized built-ins cannot extend from an
  autonomous tag, so consumers must use the native tag with `is=`.
- Every interactive element keeps a stable `id` and `data-testid`, and exposes
  the correct cursor (`pointer` for click targets, `text` for inputs,
  `not-allowed` when disabled). Author classes/ids survive upgrades.

## Output contract

- Seven entries, no aggregate root runtime: `counter`, `accordion`, `modal`,
  `popover`, `switch`, `otp`, `tabs` → `dist/<name>.js`
  (Oxc-minified ES modules, ES2022). `sideEffects` preserves self-registration.

## Smoke imports

- `smoke/` imports only by package subpath (`basic-web-components/counter`, …).
  Never relative imports into the library, never dist paths.
- `smoke/vite.config.ts` keeps `resolve.conditions` starting with
  `["source", "development", …]` and `optimizeDeps.exclude` for the library.
- Smoke visibly exercises the counter plus all six suites, shows PASS/FAIL in
  `#smoke-result`, and rethrows the real error on failure.
- Tailwind utilities live in markup `class` and part-class attributes
  (`button-class`, `field-class`, …); the scanner reads both. `style.css`
  keeps only what Tailwind cannot express (dialog `::backdrop`).
