# bwc-navigation-menu

Site navigation with hover/focus-driven content panels, built on the
shared floating core (`src/floating`). Triggers and panels are light-DOM
pairs linked by `data-value`; at most one panel is open at a time.

```js
import "basic-web-components/navigation-menu";
```

## Usage

Uncontrolled:

```html
<bwc-navigation-menu>
  <button data-nav-trigger data-value="overview">Overview</button>
  <div data-nav-panel data-value="overview">
    <a href="/quick-start">Quick start</a>
    <a href="/accessibility">Accessibility</a>
  </div>
  <button data-nav-trigger data-value="handbook">Handbook</button>
  <div data-nav-panel data-value="handbook">
    <a href="/styling">Styling</a>
  </div>
  <a href="https://example.com">Plain link</a>
</bwc-navigation-menu>
```

Controlled:

```html
<bwc-navigation-menu id="nav" value="overview">
  <!-- same triggers/panels -->
</bwc-navigation-menu>
<script>
  const nav = document.getElementById("nav");
  nav.onValueChange = (value) => {
    value ? nav.setAttribute("value", value) : nav.removeAttribute("value");
  };
</script>
```

Triggers without a panel (like the plain link above, or a
`button[data-nav-trigger]` with no matching panel) behave as plain links:
roving focus skips nothing, but opening them is a no-op.

## API

| Property        | Attribute         | Type                                     | Default        | Notes                                                                     |
| --------------- | ----------------- | ---------------------------------------- | -------------- | ------------------------------------------------------------------------- |
| `value`         | `value`           | `string`                                 | `""`           | Id of the open panel (`""` = closed). Present (or assigned) → controlled. |
| `defaultValue`  | `default-value`   | `string`                                 | `""`           | Seed for uncontrolled mode.                                               |
| `disabled`      | `disabled`        | `boolean`                                | `false`        | Open requests are ignored.                                                |
| `loopFocus`     | `loop-focus`      | `boolean`                                | `true`         | Wrap focus past the first/last trigger.                                   |
| `orientation`   | `orientation`     | `"horizontal" \| "vertical"`             | `"horizontal"` | Roving direction. Invalid values throw.                                   |
| `delay`         | `delay`           | `number`                                 | `200`          | Hover-open delay in ms.                                                   |
| `closeDelay`    | `close-delay`     | `number`                                 | `150`          | Hover-close delay in ms.                                                  |
| `side`          | `side`            | `"top" \| "right" \| "bottom" \| "left"` | `"bottom"`     | Preferred side; flips when it overflows. Invalid values throw.            |
| `align`         | `align`           | `"start" \| "center" \| "end"`           | `"start"`      | Cross-axis alignment. Invalid values throw.                               |
| `sideOffset`    | `side-offset`     | `number`                                 | `0`            | Gap in px. Non-finite values throw.                                       |
| `alignOffset`   | `align-offset`    | `number`                                 | `0`            | Cross-axis shift in px. Non-finite values throw.                          |
| `strategy`      | `strategy`        | `"absolute" \| "fixed"`                  | `"fixed"`      | Positioning strategy. Invalid values throw.                               |
| `triggerClass`  | `trigger-class`   | `string`                                 | `""`           | Extra classes for every trigger.                                          |
| `panelClass`    | `panel-class`     | `string`                                 | `""`           | Extra classes for every panel.                                            |
| `onValueChange` | — (property only) | `((value: string) => void) \| null`      | `null`         | Must be a function or null.                                               |
| `onOpenChange`  | — (property only) | `((open: boolean) => void) \| null`      | `null`         | Must be a function or null.                                               |

### Methods

| Method           | Notes                                             |
| ---------------- | ------------------------------------------------- |
| `show(value)`    | Open a panel by value (respects `disabled`).      |
| `close()`        | Close the open panel.                             |
| `toggle(value?)` | Toggle a panel; bare `toggle()` closes when open. |

`value` is the state property, so imperative open is `show(value)` —
same split as `HTMLDialogElement` (`open` + `show()`/`close()`). `show`
throws `TypeError` for an empty value and `RangeError` for a value with
no panel. Every panel is also individually addressable: each is a plain
light-DOM element, so authors can query `[data-nav-panel][data-value]`
directly.

### Events

| Name           | Detail              | Bubbles / composed |
| -------------- | ------------------- | ------------------ |
| `value-change` | `{ value: string }` | yes / yes          |
| `open-change`  | `{ open: boolean }` | yes / yes          |

### Structure

Triggers must be `button[data-nav-trigger]` with a non-empty
`data-value`; panels must be `div[data-nav-panel]` with a `data-value`
matching a trigger. Anything else throws `TypeError` (wrong element
kind, missing/duplicate values, panel without a trigger, zero
triggers). Triggers keep author classes plus the
`navigation-menu-trigger` marker class and
`data-testid="bwc-navigation-menu-trigger"` (panels likewise with
`navigation-menu-panel`); the host gets `role="navigation"` and
`data-testid="bwc-navigation-menu"`.

- Triggers get `aria-expanded` + `aria-controls` → panel id (panel-less
  triggers get neither); panels get `role="region"` +
  `aria-labelledby` → trigger id. State mirrors as `data-open` /
  `data-closed` on host, triggers, and panels, plus `data-disabled`.
  Triggers use roving `tabindex`; individually disabled triggers
  (`disabled` / `data-disabled` / `aria-disabled="true"`) are skipped
  by keyboard and hover.
- Keyboard on a trigger: `ArrowLeft`/`ArrowRight` (or `Up`/`Down` when
  vertical) roves, `Home`/`End` jumps; while a panel is open, roving
  (or focusing another trigger) switches to it, and a panel-less
  trigger closes. `Enter`/`Space`/`ArrowDown` opens and moves focus
  into the panel; `Escape` closes and returns focus to the trigger.
- Keyboard inside a panel: `Escape` closes and returns focus to the
  trigger. Hover uses a bridge: the pointer may travel trigger →
  panel without closing; leaving both closes after `close-delay`.
  Outside pointerdown and tabbing away close (without moving focus).
- Positioning runs through the shared floating core (`src/floating`):
  JS measures the trigger and writes `left`/`top` plus `data-side`
  (placed side, after flip) / `data-align`; scroll/resize/layout
  changes reposition while open. A `[data-arrow]` child of the panel
  is centered on the cross axis automatically.
- Enter/exit hooks: the open panel takes `data-starting-style` on open
  (removed next frame) and `data-ending-style` on close while a CSS
  transition/animation is present (hide defers until it finishes);
  without CSS the panel hides synchronously.

### Form behavior

None.

### Errors

- `TypeError` for invalid structure, invalid `side`/`orientation`,
  non-finite offsets, or non-function callbacks.
- `TypeError` / `RangeError` from `show()` for empty / unknown values.

### State ownership

Without `value`, interactions update internal state seeded by `default-value`.
Assigning `value` permanently enters controlled mode. Property assignments and
`show(value)` / `close()` / `toggle(value?)` apply immediately and emit
`value-change` plus `open-change` when effective state changes; other
interactions only request changes in controlled mode.
