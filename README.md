# basic-web-components

One microfw-backed library of web components (prefix `bwc`): one custom
root per family — a counter plus six suites (accordion, modal, popover,
switch, OTP, tabs). Each root owns a shadow root projecting light-DOM
native slots. Importing an entry self-registers its elements.

## Entries

| Subpath                          | Children                                                                                      |
| -------------------------------- | --------------------------------------------------------------------------------------------- |
| `basic-web-components/counter`   | `<button slot="decrement">`, `<output slot="value">`, `<button slot="increment">`             |
| `basic-web-components/accordion` | `<details slot="item" data-value="…">` with `<summary>` title plus panel `<div>`              |
| `basic-web-components/modal`     | `<button slot="trigger">`, `<dialog slot="popup">`, inner `<button data-close>`               |
| `basic-web-components/popover`   | `<button slot="trigger">`, `<div slot="popup">`, inner `<button data-close>`                  |
| `basic-web-components/switch`    | generated `button slot="control"` + thumb `span` + hidden `input` (never author them)         |
| `basic-web-components/otp`       | `length`-generated native `input slot="field"` fields plus hidden `input slot="form-control"` |
| `basic-web-components/tabs`      | `<div slot="list">` of `<button value="…">` plus `<section slot="panel" data-value="…">`      |

Children are plain native elements projected through slots — never custom
child tags, never `is=` (customized built-ins are gone). `bwc-switch` and
`bwc-otp` generate their parts; every other family takes author children.
Parent API: `default-value` attribute / `defaultValue` property is the
uncontrolled initial count; `value` switches to controlled mode (interactions
notify via the `onChange` property and a bubbling, composed `change` event with
`detail: { value }`, but only an external `value` set re-renders).

`bwc-switch` renders a `role="switch"` track button, thumb, and a native
form input from `button-class`, `thumb-class`, and `input-class` part props
(`checked` / `default-checked`, `disabled`, `readonly`, `required`, `name`,
`value`, `form`, `aria-label`; `checked-change` event + `onCheckedChange`).
`bwc-otp` generates `length` native `input` fields plus one hidden form input;
shared visuals ride `field-class`, the joined value rides the hidden input
(`hidden-input-class`). `bwc-modal` styles its leaves through
`trigger-class`, `popup-class`, and `close-class`. Part props are plain
space-separated Tailwind strings picked up by the scanner; generated parts
keep stable `id`/`data-testid` values (`bwc-switch-button`, `bwc-switch-thumb`,
`bwc-switch-input`, `bwc-otp-input`, `bwc-otp-hidden-input`).

## Workspace layout

- `packages/microfw` — reactive runtime (`defineComponent`, `html`,
  `useProp`, bundled `signal`).
- `packages/basic-web-components` — the seven family entries.
- `smoke/` — Vite harness importing entries by subpath from source.
  Breaking cutover: custom child tags and `is=` customized built-ins are
  gone. Children are plain native elements with `slot` attributes (see
  Entries); update markup accordingly — e.g. `<button is="bwc-tab">`
  becomes a plain `<button value="…">` inside `<div slot="list">`.

## Styling

Two options: the optional variable-driven default CSS
(`basic-web-components/theme.css`, themed with zero classes) or direct styling
with Tailwind/any CSS on slotted children and part props. See
[`docs/styling.md`](docs/styling.md) for both, with examples.

## Commands

```sh
bun install
bun run typecheck
bun run test
bun run build
```

## Build optimization

Static `html` templates are lowered at build (`build/static-html.ts`,
`staticHtmlPlugin`, build only) to a `staticHtml("...")` helper from a
virtual module; dynamic, non-tag, re-exported, `eval`, colliding, and
invalid-escape uses stay on the full runtime path unchanged. With
dependency-scoped component effects, the seven entries plus `shared.js` total
38,888 / 16,303 / 14,489 raw/gzip-9/brotli-11; standalone `microfw.js` remains
11,257 / 4,309 / 3,914. The static-template-only baseline was
35,675 / 14,653 / 12,989. Generated native parts (switch control, OTP
fields) come from existing `html` templates with per-mount bind/dispose
(38,902 / 16,304 / 14,490 pre-format, +722 / +292 / +260 over the 3-way
winner below; final oxfmt −14 bytes). The static-compiler fast path is
preserved; readability and structural markup improved while bytes and mount
allocations grow — no size-reduction claim for this follow-up.

Runtime updates are split by topology, content, ARIA/state, forms, classes, and
geometry. Slotted families resolve validated targets only when light-DOM
topology changes; state effects consume the resulting target signal, and
delegated listeners stay mount-owned. This adds 3,213 / 1,650 / 1,500 bytes
over the static-template baseline but removes unrelated DOM reconciliation on
ordinary updates. There is no public interface change or dependency. The
build-only compiler still costs about 300 ms and retains one TS-internal AST
flag (`templateFlags` invalid-escape bit); re-check it on TypeScript upgrades
(see `optimization-size-report.md`).

## Smoke

`smoke/` is a Vite project that imports all seven entries by package name and
resolves them to TypeScript source (`source` + `development` conditions), so no
library prebuild is needed:

```sh
bun run dev
```

Then open `http://127.0.0.1:5173`. The page visibly exercises the counter
(including controlled mode) plus all six suites — switch track/thumb, generated
OTP fields, modal/switch/OTP part-class styling — and reports `PASS`/`FAIL`
in `#smoke-result`, rethrowing the real error on failure. Styling is Tailwind
through the package (`tailwindcss` + `@tailwindcss/vite`, utilities in markup
and part-class attributes scanned at build); `smoke/src/style.css` keeps only
what Tailwind cannot express (dialog `::backdrop`). No CDN dependency.

## Usage

```html
<script type="module">
  import "basic-web-components/counter";
  import "basic-web-components/tabs";
</script>

<bwc-counter default-value="3">
  <button slot="decrement">−</button>
  <output slot="value"></output>
  <button slot="increment">+</button>
</bwc-counter>

<bwc-switch
  aria-label="Notifications"
  button-class="flex h-7 w-12 items-center rounded-full border px-0.5 data-[checked]:bg-emerald-600"
  thumb-class="size-5 rounded-full bg-stone-400 data-[checked]:translate-x-[22px] data-[checked]:bg-white"
></bwc-switch>

<bwc-otp
  length="4"
  name="code"
  validation-type="numeric"
  default-value="1234"
  field-class="h-11 w-11 text-center font-mono"
></bwc-otp>

<bwc-tabs default-value="overview">
  <div slot="list">
    <button value="overview">Overview</button>
    <button value="details">Details</button>
  </div>
  <section slot="panel" data-value="overview">Overview panel</section>
  <section slot="panel" data-value="details">Details panel</section>
</bwc-tabs>
```

See `ASGENTS.md` for implementation policies.
