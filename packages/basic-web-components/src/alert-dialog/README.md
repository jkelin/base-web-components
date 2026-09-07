# bwc-alert-dialog

A centered confirmation dialog: a trigger button opens a `role="alertdialog"`
popup. Use it when the user must confirm or dismiss before proceeding.

```js
import "basic-web-components/alert-dialog";
```

## Usage

Uncontrolled:

```html
<bwc-alert-dialog>
  <button slot="trigger">Discard draft</button>
  <div slot="popup">
    <h2 data-title>Discard draft?</h2>
    <p data-description>You can't undo this action.</p>
    <button data-cancel>Cancel</button>
    <button data-action>Discard</button>
  </div>
</bwc-alert-dialog>
```

Controlled:

```html
<bwc-alert-dialog id="d" open>
  <button slot="trigger">Discard draft</button>
  <div slot="popup">
    <h2 data-title>Discard draft?</h2>
    <button data-cancel>Cancel</button>
    <button data-action>Discard</button>
  </div>
</bwc-alert-dialog>
<script>
  const d = document.getElementById("d");
  d.onOpenChange = (open) => {
    open ? d.setAttribute("open", "") : d.removeAttribute("open");
  };
</script>
```

## API

### Properties / attributes

| Property           | Attribute           | Type                                | Default | Notes                                                      |
| ------------------ | ------------------- | ----------------------------------- | ------- | ---------------------------------------------------------- |
| `open`             | `open`              | `boolean`                           | `false` | Present (or assigned) → controlled mode.                   |
| `defaultOpen`      | `default-open`      | `boolean`                           | `false` | Seed for uncontrolled mode.                                |
| `disabled`         | `disabled`          | `boolean`                           | `false` | Disables the trigger; open/close requests are ignored.     |
| `modal`            | `modal`             | `boolean`                           | `true`  | Backdrop + shared scroll-lock; `modal="false"` opts out.   |
| `initialFocus`     | `initial-focus`     | `Element \| string \| null`         | `null`  | Element or selector focused on open; defaults to popup.    |
| `finalFocus`       | `final-focus`       | `Element \| string \| null`         | `null`  | Element or selector focused on close; defaults to trigger. |
| `triggerClass`     | `trigger-class`     | `string`                            | `""`    | Extra classes for the trigger.                             |
| `popupClass`       | `popup-class`       | `string`                            | `""`    | Extra classes for the popup.                               |
| `actionClass`      | `action-class`      | `string`                            | `""`    | Extra classes for each `data-action` button.               |
| `cancelClass`      | `cancel-class`      | `string`                            | `""`    | Extra classes for each `data-cancel` button.               |
| `closeClass`       | `close-class`       | `string`                            | `""`    | Extra classes for each `data-close` button.                |
| `backdropClass`    | `backdrop-class`    | `string`                            | `""`    | Extra classes for the backdrop.                            |
| `titleClass`       | `title-class`       | `string`                            | `""`    | Extra classes for the `data-title` element.                |
| `descriptionClass` | `description-class` | `string`                            | `""`    | Extra classes for the `data-description` element.          |
| `onOpenChange`     | — (property only)   | `((open: boolean) => void) \| null` | `null`  | Must be a function or null.                                |

Methods: `show()`, `close()`, `toggle(force?)`. There is no `open()` method:
`open` is the boolean state property, mirroring `HTMLDialogElement`.

### Events

| Name          | Detail              | Bubbles / composed |
| ------------- | ------------------- | ------------------ |
| `open-change` | `{ open: boolean }` | yes / yes          |

Emitted for trigger clicks, `data-action` / `data-cancel` / `data-close`
clicks, backdrop clicks, and Escape. In controlled mode state only changes
when you update `open`.

### Slots

| Slot      | Required element     |
| --------- | -------------------- |
| `trigger` | exactly one `button` |
| `popup`   | exactly one `div`    |

Part buttons are any `<button data-action>` (confirm; closes by default,
`data-keep-open` opts out), `<button data-cancel>`, or `<button data-close>`
inside the popup. Wrong count or wrong element type throws `TypeError` on
connect. Dialogs are centered viewports: there is no `side`/`align`.

### Accessibility

- Popup gets `role="alertdialog"`, `aria-modal`, and `aria-labelledby` /
  `aria-describedby` from the `[data-title]` / `[data-description]` parts; ids
  and `data-testid="bwc-alert-dialog-popup"` are auto-assigned.
- Parts carry `alert-dialog-*` marker classes plus stable testids; author
  classes are preserved.
- Open/closed/disabled/modal state mirrors as `data-open` / `data-closed` /
  `data-disabled` / `data-modal` on trigger and popup.
- On open, focus moves to `initial-focus` or the popup; Tab wraps inside the
  popup while open; Escape requests close; on close, focus returns to
  `final-focus` or the trigger.
- Enter/exit animations use `data-starting-style` / `data-ending-style` like
  `bwc-popover`.

### Scroll-lock

Modal dialogs lock `document.documentElement` scroll through the shared
`acquireScrollLock` / `releaseScrollLock` helper (`src/floating/scroll-lock.ts`),
so overlapping overlays (dialog + menu, two dialogs) keep scroll locked until
all of them close.

### Errors

- `TypeError` when the trigger/popup topology is invalid.
- `TypeError` when `onOpenChange`, `initial-focus`, or `final-focus` has an
  invalid value.

### State ownership

Without `open`, interactions update internal state seeded by `default-open`.
Assigning `open` permanently enters controlled mode. Property assignments and
`show()` / `close()` / `toggle()` apply immediately and emit `open-change`
when the effective state changes; other interactions only request changes in
controlled mode.
