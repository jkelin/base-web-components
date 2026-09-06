# bwc-popover

A non-modal floating panel anchored to a trigger button, built on the native
`popover` API. Use it for menus, tooltips with actions, or filters — anything
that floats without trapping focus or locking scroll.

```js
import "basic-web-components/popover";
```

## Usage

Uncontrolled:

```html
<bwc-popover>
  <button slot="trigger">Options</button>
  <div slot="popup">
    <button data-close>Close</button>
  </div>
</bwc-popover>
```

Controlled, opening on top with an offset:

```html
<bwc-popover id="p" side="top" side-offset="8">
  <button slot="trigger">Options</button>
  <div slot="popup">
    <button data-close>Close</button>
  </div>
</bwc-popover>
<script>
  const p = document.getElementById("p");
  p.onOpenChange = (open) => {
    open ? p.setAttribute("open", "") : p.removeAttribute("open");
  };
</script>
```

Trigger clicks toggle; `data-close` clicks and native light-dismiss close.

## API

### Properties / attributes

| Property       | Attribute         | Type                                     | Default    | Notes                                                                     |
| -------------- | ----------------- | ---------------------------------------- | ---------- | ------------------------------------------------------------------------- |
| `open`         | `open`            | `boolean`                                | `false`    | Present (or assigned) → controlled mode.                                  |
| `defaultOpen`  | `default-open`    | `boolean`                                | `false`    | Seed for uncontrolled mode.                                               |
| `disabled`     | `disabled`        | `boolean`                                | `false`    | Disables the trigger; toggle requests are ignored.                        |
| `side`         | `side`            | `"top" \| "right" \| "bottom" \| "left"` | `"bottom"` | Invalid values throw; reflected to `data-side` on the popup.              |
| `sideOffset`   | `side-offset`     | `number`                                 | `0`        | Pixels, written to `--side-offset` on the popup. Non-finite values throw. |
| `triggerClass` | `trigger-class`   | `string`                                 | `""`       | Extra Tailwind classes for the trigger.                                   |
| `popupClass`   | `popup-class`     | `string`                                 | `""`       | Extra Tailwind classes for the popup.                                     |
| `closeClass`   | `close-class`     | `string`                                 | `""`       | Extra Tailwind classes for each `data-close` button.                      |
| `onOpenChange` | — (property only) | `((open: boolean) => void) \| null`      | `null`     | Must be a function or null.                                               |

### Events

| Name          | Detail              | Bubbles / composed |
| ------------- | ------------------- | ------------------ |
| `open-change` | `{ open: boolean }` | yes / yes          |

In controlled mode native dismissals re-assert state on the next microtask
until you update `open`.

### Slots

| Slot      | Required element     |
| --------- | -------------------- |
| `trigger` | exactly one `button` |
| `popup`   | exactly one `div`    |

Close buttons are any `<button data-close>` inside the popup. Wrong count or
type throws `TypeError`. The popup gets `popover="auto"`, `role="dialog"`,
and `data-testid="bwc-popover-popup"`; parts keep author classes plus
`popover-trigger` / `popover-popup` / `popover-close` marker classes and
stable testids.

### Accessibility

- Trigger gets `aria-haspopup="dialog"`, `aria-controls` → popup id, and
  `aria-expanded`; state mirrors as `data-open` / `data-closed` /
  `data-disabled` on trigger and popup. Disabled trigger uses the
  `not-allowed` cursor.
- Positioning is pure CSS (`data-side` + `--side-offset`, see
  `popover.css`); JS performs no geometry reads or writes.

### Form behavior

None.

### Errors

- `TypeError` for invalid slot topology, invalid `side`, non-finite
  `side-offset`, or non-function `onOpenChange`.
