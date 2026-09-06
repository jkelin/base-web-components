# bwc-modal

A dialog overlay: a trigger button opens a native `<dialog>` popup with
`showModal()`. Use it for confirmations, forms, or anything needing modal
focus and backdrop dismissal.

```js
import "basic-web-components/modal";
```

## Usage

Uncontrolled:

```html
<bwc-modal>
  <button slot="trigger">Open</button>
  <dialog slot="popup">
    <p>Confirm?</p>
    <button data-close>Close</button>
  </dialog>
</bwc-modal>
```

Controlled:

```html
<bwc-modal id="m" open>
  <button slot="trigger">Open</button>
  <dialog slot="popup">
    <p>Confirm?</p>
    <button data-close>Close</button>
  </dialog>
</bwc-modal>
<script>
  const m = document.getElementById("m");
  m.onOpenChange = (open) => {
    open ? m.setAttribute("open", "") : m.removeAttribute("open");
  };
</script>
```

## API

### Properties / attributes

| Property       | Attribute         | Type                                | Default | Notes                                                  |
| -------------- | ----------------- | ----------------------------------- | ------- | ------------------------------------------------------ |
| `open`         | `open`            | `boolean`                           | `false` | Present (or assigned) → controlled mode.               |
| `defaultOpen`  | `default-open`    | `boolean`                           | `false` | Seed for uncontrolled mode.                            |
| `disabled`     | `disabled`        | `boolean`                           | `false` | Disables the trigger; open/close requests are ignored. |
| `triggerClass` | `trigger-class`   | `string`                            | `""`    | Extra Tailwind classes for the trigger.                |
| `popupClass`   | `popup-class`     | `string`                            | `""`    | Extra Tailwind classes for the dialog.                 |
| `closeClass`   | `close-class`     | `string`                            | `""`    | Extra Tailwind classes for each `data-close` button.   |
| `onOpenChange` | — (property only) | `((open: boolean) => void) \| null` | `null`  | Must be a function or null.                            |

### Events

| Name          | Detail              | Bubbles / composed |
| ------------- | ------------------- | ------------------ |
| `open-change` | `{ open: boolean }` | yes / yes          |

Emitted for trigger clicks, `data-close` clicks, backdrop clicks, and native
`cancel` (Escape) / `close` dismissal. In controlled mode state only changes
when you update `open`.

### Slots

| Slot      | Required element     |
| --------- | -------------------- |
| `trigger` | exactly one `button` |
| `popup`   | exactly one `dialog` |

Close buttons are any `<button data-close>` inside the dialog. Wrong count or
wrong element type throws `TypeError` on connect. Replacing slotted nodes
rebinds automatically (an open dialog is closed and reopened on the new node).

### Accessibility

- Trigger gets `aria-haspopup="dialog"`, `aria-controls` → dialog id, and
  `aria-expanded`; ids and `data-testid="bwc-modal-popup"` are auto-assigned.
- Parts carry `modal-trigger` / `modal-popup` / `modal-close` marker classes
  plus stable testids; author classes are preserved.
- Open/closed/disabled state mirrors as `data-open` / `data-closed` /
  `data-disabled` on trigger and dialog. Disabled trigger uses the
  `not-allowed` cursor.
- Escape requests close (native `cancel` is prevented and routed through
  `open-change`); backdrop clicks close; focus returns to the trigger on
  close; document scroll is locked while open.

### Form behavior

None (dialog content participates normally if you put a `<form>` inside).

### Errors

- `TypeError` when the trigger/popup topology is invalid.
- `TypeError` when `onOpenChange` is a non-function, non-null value.
