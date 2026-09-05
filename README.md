# basic-web-components

One vanilla library of light-DOM web components (prefix `bwc`): a compound
counter plus six suites — accordion, modal, popover, switch, OTP, and tabs.
No shadow DOM. Importing an entry self-registers its elements.

## Entries

| Subpath                          | Tags                                                                                      |
| -------------------------------- | ----------------------------------------------------------------------------------------- |
| `basic-web-components/counter`   | `bwc-counter`, `bwc-counter-minus-button`, `bwc-counter-label`, `bwc-counter-plus-button` |
| `basic-web-components/accordion` | `bwc-accordion`, `bwc-accordion-item`, `bwc-accordion-trigger`, `bwc-accordion-panel`     |
| `basic-web-components/modal`     | `bwc-modal`, `bwc-modal-trigger`, `bwc-modal-popup`, `bwc-modal-close`                    |
| `basic-web-components/popover`   | `bwc-popover`, `bwc-popover-trigger`, `bwc-popover-popup`, `bwc-popover-close`            |
| `basic-web-components/switch`    | `bwc-switch` + generated `button`, `span` thumb, hidden `input`                           |
| `basic-web-components/otp`       | `bwc-otp` root + `length`-generated native `input` fields                                 |
| `basic-web-components/tabs`      | `bwc-tabs`, `bwc-tabs-list`, `bwc-tab`, `bwc-tab-panel`                                   |

Leaf controls are customized built-ins on native hosts: create them as
`<button is="bwc-counter-minus-button">`, `<span is="bwc-counter-label">`,
`<dialog is="bwc-modal-popup">`, `<div is="bwc-popover-popup">`, and so on.
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
keep stable `data-testid` values (`bwc-switch-button`, `bwc-switch-thumb`,
`bwc-switch-input`, `bwc-otp-input`, `bwc-otp-hidden-input`).

## Commands

```sh
bun install
bun run typecheck
bun run test
bun run build
```

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
  <button is="bwc-counter-minus-button"></button>
  <span is="bwc-counter-label"></span>
  <button is="bwc-counter-plus-button"></button>
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
  <bwc-tabs-list>
    <button is="bwc-tab" value="overview">Overview</button>
    <button is="bwc-tab" value="details">Details</button>
  </bwc-tabs-list>
  <bwc-tab-panel value="overview">Overview panel</bwc-tab-panel>
  <bwc-tab-panel value="details">Details panel</bwc-tab-panel>
</bwc-tabs>
```

See `ASGENTS.md` for implementation policies.
