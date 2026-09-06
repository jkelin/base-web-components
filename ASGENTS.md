# ASGENTS.md — basic-web-components

Single library (`basic-web-components`, prefix `bwc`): one custom root per
family, microfw-backed — shadow roots project light-DOM native slots.
No CDN in the repo: smoke CSS is local.

## Toolchain

- Bun only: `bun install`, `bun run <script>`. Never npm/pnpm/yarn/node.
- Focused validation: run the script for the touched workspace only
  (`bun run --filter <name> <script>`). Never full-project sweeps for a local change.
- Lint then format, once, at the end: `lint` (oxlint), then `format` (oxfmt).
  No repeated lint/format loops during implementation.

## Library layout

- One folder per component under `src/`: `counter/`, `accordion/`, `modal/`,
  `popover/`, `slide-out/`, `switch/`, `otp/`, `tabs/`. Shared code lives
  only in `src/shared/index.ts`; never cross-import between component folders.
- Each folder owns colocated behavioral tests (`*.test.ts` next to the source).
  Tests assert observable behavior (rendered state, events, ARIA), never wiring.

## Component rules

- Props are typed `useProp(name, options)` declarations from `microfw`
  (overloaded; attribute-backed or callback-only per the family contract).
  Render setup uses `useHost`, `onMount` (returning cleanup), and `effect`;
  shared codecs and slot helpers import directly from `src/shared`. Mount
  effects, listeners, and observers are disposed on unmount and re-created
  on remount. `onclick`-style author handlers are never clobbered.
- Part-class props (`button-class`, `thumb-class`, `input-class`;
  `trigger-class`, `popup-class`, `panel-class`, `close-class`; `field-class`,
  `hidden-input-class`) carry plain space-separated Tailwind strings merged
  after the stable marker class by part controllers. `bwc-switch` generates
  its `button slot="control"` (with thumb `span` and hidden `input`; never
  author them); `bwc-otp` generates exactly `length` native `input`
  `slot="field"` fields plus one hidden form input `slot="form-control"`
  (no custom field tag; generated fields carry
  `data-testid="bwc-otp-input"`). Validate at the boundary and throw clear
  errors: invalid enum values, duplicate or empty item values. Never coerce
  silently, never fall back silently.

## Native slots

- Children are plain native elements assigned by `slot`, never custom child
  tags and never `is=`: counter takes `button slot="decrement"`,
  `output slot="value"`, `button slot="increment"`; accordion takes
  `details slot="item" data-value="<id>"` holding a `<summary>` title plus a
  panel `<div>`; modal/popover take `slot="trigger"` buttons, a `slot="popup"`
  `dialog`/`div`, and an inner `<button data-close>`; slide-out takes a
  `slot="trigger"` button, a `slot="panel"` element, and an inner
  `<button data-close>`; tabs takes a
  `div slot="list"` of `<button value="<id>">` plus
  `section slot="panel" data-value="<id>"`. `bwc-switch` and `bwc-otp` take
  no author children — their parts are generated (see above).
- Every interactive element keeps a stable `id` and `data-testid`, and exposes
  the correct cursor (`pointer` for click targets, `text` for inputs,
  `not-allowed` when disabled). Author classes/ids survive upgrades.

## Documentation

- Each component folder owns a colocated `README.md` (intro, usage examples,
  full API). Whenever adding, changing, or removing component props/events/
  slots/parts, behavior, form participation, or errors, MUST update that
  folder's `README.md` in the same change.
- README examples MUST use native slot markup exactly as implemented (never
  invent slot names) and MUST be validated against the colocated
  `*.test.ts` before finishing.
- README and website demo examples MUST NOT include `aria-*` attributes —
  components own ARIA at runtime (roles, labels, states); examples show only
  author markup, ids, `data-testid`, and styling hooks.

## Output contract

- Eight entries, no aggregate root runtime: `counter`, `accordion`, `modal`,
  `popover`, `slide-out`, `switch`, `otp`, `tabs` → `dist/<name>.js`
  (native-minified ES modules, ES2022) plus one `shared.js` chunk carrying
  shared helpers and the single microfw/alien runtime copy.
  `sideEffects` preserves self-registration.
- Build-only lowering: `build/static-html.ts` (`staticHtmlPlugin`, apply
  build) compiles static `html` templates to a virtual `staticHtml` helper;
  anything dynamic stays on the runtime path unchanged. Re-check the pinned
  TS-internal invalid-escape flag value on TypeScript upgrades.

## Smoke imports

- `smoke/` imports only by package subpath (`basic-web-components/counter`, …).
  Never relative imports into the library, never dist paths.
- `smoke/vite.config.ts` keeps `resolve.conditions` starting with
  `["source", "development", …]` and `optimizeDeps.exclude` for the library
  and `microfw` (one source copy, never prebundled apart).
- Smoke visibly exercises the counter plus all six suites, shows PASS/FAIL in
  `#smoke-result`, and rethrows the real error on failure.
- Tailwind utilities live in markup `class` and part-class attributes
  (`button-class`, `field-class`, …); the scanner reads both. `style.css`
  keeps only what Tailwind cannot express (dialog `::backdrop`).
