# bwc-context-menu

A floating menu that opens on `contextmenu` (right-click / long-press),
anchored at the pointer by default. Built on the shared floating core
(`src/floating`) with the same item model as `bwc-menu`.

```js
import "basic-web-components/context-menu";
```

## Usage

Uncontrolled, anchored at the pointer:

```html
<bwc-context-menu>
  <div slot="trigger">Right-click me</div>
  <div slot="popup">
    <button data-menu-item>Copy</button>
    <button data-menu-item>Paste</button>
  </div>
</bwc-context-menu>
```

Anchored at the trigger region instead:

```html
<bwc-context-menu anchor-mode="trigger" side="bottom" align="start">
  <div slot="trigger">Right-click me</div>
  <div slot="popup">
    <button data-menu-item>Copy</button>
  </div>
</bwc-context-menu>
```

Right-clicking the trigger opens the menu; item clicks close unless
`data-close-on-click="false"` is set. Checkbox/radio items stay open by
default (opt into closing with `data-close-on-click="true"`).
`Shift+F10` / the context-menu key opens anchored at the trigger center.

## API

| Property       | Attribute         | Type                                     | Default      | Notes                                                             |
| -------------- | ----------------- | ---------------------------------------- | ------------ | ----------------------------------------------------------------- |
| `open`         | `open`            | `boolean`                                | `false`      | Present (or assigned) → controlled mode. Reflects to `open`.      |
| `defaultOpen`  | `default-open`    | `boolean`                                | `false`      | Seed for uncontrolled mode.                                       |
| `disabled`     | `disabled`        | `boolean`                                | `false`      | Blocks `contextmenu` opens and `show()`.                          |
| `modal`        | `modal`           | `boolean`                                | `true`       | Locks body scroll while open; light-dismiss always applies.       |
| `loopFocus`    | `loop-focus`      | `boolean`                                | `true`       | Wrap highlight past the first/last item.                          |
| `orientation`  | `orientation`     | `"vertical" \| "horizontal"`             | `"vertical"` | Arrow keys follow the orientation. Invalid values throw.          |
| `side`         | `side`            | `"top" \| "right" \| "bottom" \| "left"` | `"bottom"`   | Preferred side; flips when it overflows. Invalid values throw.    |
| `align`        | `align`           | `"start" \| "center" \| "end"`           | `"start"`    | Cross-axis alignment. Invalid values throw.                       |
| `sideOffset`   | `side-offset`     | `number`                                 | `0`          | Gap in px. Non-finite values throw.                               |
| `alignOffset`  | `align-offset`    | `number`                                 | `0`          | Cross-axis shift in px. Non-finite values throw.                  |
| `strategy`     | `strategy`        | `"absolute" \| "fixed"`                  | `"fixed"`    | Positioning strategy. Invalid values throw.                       |
| `anchor`       | `anchor`          | `Element \| string \| null`              | `null`       | Explicit anchor override (element or selector).                   |
| `anchorMode`   | `anchor-mode`     | `"trigger" \| "pointer"`                 | `"pointer"`  | `pointer` anchors at the right-click point. Invalid values throw. |
| `openOnHover`  | `open-on-hover`   | `boolean`                                | `false`      | Also open on trigger/popup hover.                                 |
| `delay`        | `delay`           | `number`                                 | `0`          | Hover-open delay in ms.                                           |
| `closeDelay`   | `close-delay`     | `number`                                 | `0`          | Hover-close delay in ms.                                          |
| `triggerClass` | `trigger-class`   | `string`                                 | `""`         | Extra classes for the trigger.                                    |
| `popupClass`   | `popup-class`     | `string`                                 | `""`         | Extra classes for the popup.                                      |
| `onOpenChange` | — (property only) | `((open: boolean) => void) \| null`      | `null`       | Must be a function or null.                                       |

### Methods

| Method           | Notes                                  |
| ---------------- | -------------------------------------- |
| `show()`         | Imperative open (respects `disabled`). |
| `close()`        | Imperative close.                      |
| `toggle(force?)` | Toggle, or force with a boolean.       |

`open` is the boolean state property, so imperative open is `show()` —
same split as `HTMLDialogElement` (`open` + `show()`/`close()`).

### Events

| Name             | Detail                                | Bubbles / composed |
| ---------------- | ------------------------------------- | ------------------ |
| `open-change`    | `{ open: boolean }`                   | yes / yes          |
| `checked-change` | `{ checked: boolean; value: string }` | yes / yes          |
| `radio-change`   | `{ value: string; group: string }`    | yes / yes          |

### Slots

| Slot      | Required element              |
| --------- | ----------------------------- |
| `trigger` | exactly one element (any tag) |
| `popup`   | exactly one `div`             |

Menu items are `[data-menu-item]` (or `[role="menuitem"]`) elements inside
the popup. Disabled items carry `[data-disabled]` (or `disabled` /
`aria-disabled="true"`) and are skipped by keyboard navigation. Wrong slot
count or type throws `TypeError`. The popup gets `role="menu"` and
`data-testid="bwc-context-menu-popup"`; parts keep author classes plus
`context-menu-trigger` / `context-menu-popup` marker classes and stable
testids.

- Trigger gets `aria-haspopup="menu"`, `aria-controls` → popup id, and
  `aria-expanded`; state mirrors as `data-open` / `data-closed` /
  `data-disabled` / `data-modal` on trigger and popup. Disabled trigger
  uses the `not-allowed` cursor.
- Keyboard: `ArrowDown`/`ArrowUp` (or `Left`/`Right` when horizontal),
  `Home`/`End`, `Enter`/`Space` activates the highlighted item,
  `Escape` closes and returns focus to the trigger. Printable characters
  run label typeahead over enabled items (500ms window, repeats cycle).
  Highlight mirrors as `data-highlighted` with roving `tabindex`.
- Checkbox items (`[data-menu-item][data-checkbox-item]`) toggle
  `data-checked` (+ `aria-checked`, `role="menuitemcheckbox"`) and fire
  `checked-change` without closing; radio items
  (`[data-menu-item][data-radio-item][data-value]` inside
  `[data-radio-group]`, optional `data-name`) select their group value
  (`role="menuitemradio"`) and fire `radio-change` without closing. Set
  `data-close-on-click="true"` to close on either.
- `[data-separator]` gets `role="separator"`; `[data-group]` gets
  `role="group"` (linked to its `[data-group-label]` via
  `aria-labelledby`). Both are skipped by keyboard navigation and
  typeahead.
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
  on the cross axis automatically.

### Form behavior

None.

### Errors

- `TypeError` for invalid slot topology, invalid `side`/`anchor-mode`,
  non-finite offsets, or non-function `onOpenChange`.

### State ownership

Without `open`, interactions update internal state seeded by `default-open`.
Assigning `open` permanently enters controlled mode. Property assignments and
`show()` / `close()` / `toggle()` apply immediately and emit `open-change`
when the effective state changes; other interactions only request changes in
controlled mode.
