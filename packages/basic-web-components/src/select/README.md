# bwc-select

A single-value select with a floating listbox, built on the shared floating
core (`src/floating`). The trigger shows the selected label; options live in
the popup.

```js
import "basic-web-components/select";
```

## Usage

Uncontrolled with a placeholder:

```html
<bwc-select placeholder="Pick a fruit">
  <button slot="trigger"><span data-value></span></button>
  <div slot="popup">
    <div data-option data-value="apple">Apple</div>
    <div data-option data-value="banana" data-label="Banana!">Banana</div>
  </div>
</bwc-select>
```

Controlled with form participation:

```html
<bwc-select id="s" name="fruit" value="apple">
  <button slot="trigger"><span data-value></span> <span data-icon>▾</span></button>
  <div slot="popup">
    <div data-option data-value="apple">Apple</div>
    <div data-option data-value="banana">Banana</div>
  </div>
</bwc-select>
<script>
  const s = document.getElementById("s");
  s.onValueChange = (value) => s.setAttribute("value", value);
</script>
```

Trigger clicks toggle; selecting an option sets the value and closes (in
`multiple` mode options toggle instead and the popup stays open).

## API

| Property            | Attribute             | Type                                     | Default    | Notes                                                             |
| ------------------- | --------------------- | ---------------------------------------- | ---------- | ----------------------------------------------------------------- |
| `open`              | `open`                | `boolean`                                | `false`    | Present (or assigned) → controlled mode. Reflects to `open`.      |
| `defaultOpen`       | `default-open`        | `boolean`                                | `false`    | Seed for uncontrolled mode.                                       |
| `value`             | `value`               | `string`                                 | `""`       | Present (or assigned) → controlled mode.                          |
| `defaultValue`      | `default-value`       | `string`                                 | `""`       | Seed for uncontrolled mode.                                       |
| `values`            | `values`              | `string[]` (JSON array attribute)        | `[]`       | Multi-select values; present (or assigned) → controlled mode.     |
| `defaultValues`     | `default-values`      | `string[]` (JSON array attribute)        | `[]`       | Seed for uncontrolled multi-select.                               |
| `multiple`          | `multiple`            | `boolean`                                | `false`    | Options toggle without closing; display joins labels with `", "`. |
| `name`              | `name`                | `string`                                 | `""`       | Reflected into hidden input(s) for native form participation.     |
| `form`              | `form`                | `string`                                 | `""`       | Passed to hidden input(s) to associate with a form by id.         |
| `required`          | `required`            | `boolean`                                | `false`    | Forwarded to the hidden input(s).                                 |
| `readonly`          | `readonly`            | `boolean`                                | `false`    | Opens, but selection changes are ignored.                         |
| `disabled`          | `disabled`            | `boolean`                                | `false`    | Disables the trigger; open/selection requests are ignored.        |
| `modal`             | `modal`               | `boolean`                                | `true`     | Locks body scroll while open; light-dismiss always applies.       |
| `loopFocus`         | `loop-focus`          | `boolean`                                | `true`     | Wrap highlight past the first/last option.                        |
| `placeholder`       | `placeholder`         | `string`                                 | `""`       | Display text when no value is selected.                           |
| `matchTriggerWidth` | `match-trigger-width` | `boolean`                                | `true`     | Size the popup to at least the trigger width while open.          |
| `side`              | `side`                | `"top" \| "right" \| "bottom" \| "left"` | `"bottom"` | Preferred side; flips when it overflows. Invalid values throw.    |
| `align`             | `align`               | `"start" \| "center" \| "end"`           | `"center"` | Cross-axis alignment. Invalid values throw.                       |
| `sideOffset`        | `side-offset`         | `number`                                 | `0`        | Gap in px. Non-finite values throw.                               |
| `alignOffset`       | `align-offset`        | `number`                                 | `0`        | Cross-axis shift in px. Non-finite values throw.                  |
| `strategy`          | `strategy`            | `"absolute" \| "fixed"`                  | `"fixed"`  | Positioning strategy. Invalid values throw.                       |
| `anchor`            | `anchor`              | `Element \| string \| null`              | `null`     | Override anchor (element or selector); `null` anchors to trigger. |
| `triggerClass`      | `trigger-class`       | `string`                                 | `""`       | Extra classes for the trigger.                                    |
| `popupClass`        | `popup-class`         | `string`                                 | `""`       | Extra classes for the popup.                                      |
| `onOpenChange`      | — (property only)     | `((open: boolean) => void) \| null`      | `null`     | Must be a function or null.                                       |
| `onValueChange`     | — (property only)     | `((value: string) => void) \| null`      | `null`     | Must be a function or null.                                       |
| `onValuesChange`    | — (property only)     | `((values: string[]) => void) \| null`   | `null`     | Must be a function or null.                                       |

### Methods

| Method             | Notes                                                    |
| ------------------ | -------------------------------------------------------- |
| `show()`           | Imperative open (respects `disabled`).                   |
| `close()`          | Imperative close.                                        |
| `toggle(force?)`   | Toggle, or force with a boolean.                         |
| `selectValue(v)`   | Select a value (ignored when `readonly`/`disabled`).     |
| `selectValues(vs)` | Replace all values in `multiple` mode (same guards).     |
| `clear()`          | Clear the value(s) (ignored when `readonly`/`disabled`). |

`open` is the boolean state property, so imperative open is `show()` —
same split as `HTMLDialogElement` (`open` + `show()`/`close()`).

### Events

| Name            | Detail                 | Bubbles / composed |
| --------------- | ---------------------- | ------------------ |
| `open-change`   | `{ open: boolean }`    | yes / yes          |
| `value-change`  | `{ value: string }`    | yes / yes          |
| `values-change` | `{ values: string[] }` | yes / yes          |

### Slots

| Slot      | Required element                                                         |
| --------- | ------------------------------------------------------------------------ |
| `trigger` | exactly one `button` (containing `[data-value]`, optional `[data-icon]`) |
| `popup`   | exactly one `div`                                                        |

Options are `[data-option][data-value]` elements inside the popup, with an
optional `data-label` display override. Disabled options carry
`[data-disabled]` (or `disabled` / `aria-disabled="true"`) and are skipped
by keyboard navigation. Wrong slot count or type throws `TypeError`. The
popup gets `role="listbox"` and `data-testid="bwc-select-popup"`; options
get `role="option"` (when absent), `aria-selected`, and `data-selected`;
parts keep author classes plus `select-trigger` / `select-popup` marker
classes and stable testids.

- Trigger gets `aria-haspopup="listbox"`, `aria-controls` → popup id, and
  `aria-expanded`; state mirrors as `data-open` / `data-closed` /
  `data-disabled` / `data-modal` / `data-multiple` on trigger and popup,
  plus `data-placeholder` on the trigger while the placeholder shows.
  Disabled trigger uses the `not-allowed` cursor.
- Keyboard: `ArrowDown`/`ArrowUp`, `Home`/`End`, `Enter`/`Space` selects
  the highlighted option and closes, `Escape` closes and returns focus to
  the trigger. Printable characters run label typeahead over enabled
  options — from the popup it highlights, from a closed trigger it opens
  then highlights; `Enter` still selects. Highlight mirrors as
  `data-highlighted` with roving `tabindex`.
- In `multiple` mode, clicks and `Enter`/`Space` toggle options without
  closing and fire `values-change`; `value` mirrors the first selection.
- `[data-scroll-up]` / `[data-scroll-down]` buttons in the popup scroll
  the `[data-list]` container (or the popup) by a page step and disable
  themselves at the scrolled edge.
- An optional `[data-backdrop]` child of the popup mirrors `data-open` /
  `data-closed` and `hidden` for author dim overlays. While `modal` is
  open, body scroll locks (light-dismiss still applies).
- Enter/exit hooks: the popup takes `data-starting-style` on open
  (removed next frame) and `data-ending-style` on close while a CSS
  transition/animation is present (hide defers until it finishes);
  without CSS the popup hides synchronously.
- Positioning runs through the shared floating core (`src/floating`):
  JS measures the anchor and writes `left`/`top` plus `data-side`
  (placed side, after flip) / `data-align`; scroll/resize/layout changes
  reposition while open. A `[data-arrow]` child of the popup is centered
  on the cross axis automatically. `match-trigger-width` also sets the
  popup `min-width` to the trigger width while open.

### Form behavior

With `name` set, hidden input(s) carry the value so the select
participates in native form submission: one input in single mode, one per
value in `multiple` mode (nothing submits when empty). `form` associates
the input(s) with a form by id; `required` and `disabled` forward.

### Errors

- `TypeError` for invalid slot topology, invalid `side`, non-finite
  offsets, non-string `values`, or non-function callbacks.

### State ownership

`open`, `value`, and `values` are independently uncontrolled until assigned;
their `default-*` properties seed internal state. Assigning one permanently
controls it. Property assignments and imperative methods apply immediately
and emit the matching change event when effective state changes; other
interactions only request changes for controlled state.
