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
Set `open-on-hover` to also open on trigger hover (with `delay` /
`close-delay`); the pointer may rest on the popup without closing it. Set
`modal` for a backdrop with scroll-lock and focus management.

While open, the trigger's native `title` is suppressed so only the custom
popover shows; it is restored on close.

The popup carries `data-starting-style` during the opening frames and
`data-ending-style` while closing, for author-driven enter/exit transitions:

```css
bwc-popover > [slot="popup"] {
  transition: opacity 100ms ease-out;
}
bwc-popover > [slot="popup"][data-starting-style],
bwc-popover > [slot="popup"][data-ending-style] {
  opacity: 0;
}
```

Closing waits for the popup's transition (duration + delay) before hiding
through the popover API; without a transition it hides synchronously.
Positioning also writes `--transform-origin` (the anchor point on the popup
edge) for scale/fade origins.

A `[data-title]` child labels the popup (`aria-labelledby`) and a
`[data-description]` child describes it (`aria-describedby`).

## API

| Property                | Attribute                 | Type                                     | Default    | Notes                                                                                                                       |
| ----------------------- | ------------------------- | ---------------------------------------- | ---------- | --------------------------------------------------------------------------------------------------------------------------- |
| `open`                  | `open`                    | `boolean`                                | `false`    | Present (or assigned) → controlled mode. Reflects to `open`.                                                                |
| `defaultOpen`           | `default-open`            | `boolean`                                | `false`    | Seed for uncontrolled mode.                                                                                                 |
| `disabled`              | `disabled`                | `boolean`                                | `false`    | Disables the trigger; toggle requests are ignored.                                                                          |
| `openOnHover`           | `open-on-hover`           | `boolean`                                | `false`    | Open on trigger hover; click toggles regardless.                                                                            |
| `delay`                 | `delay`                   | `number`                                 | `0`        | Hover-open delay in ms. Non-finite values throw.                                                                            |
| `closeDelay`            | `close-delay`             | `number`                                 | `0`        | Hover-close delay in ms. Non-finite values throw.                                                                           |
| `modal`                 | `modal`                   | `boolean`                                | `false`    | Backdrop + scroll-lock; focuses the popup unless `initial-focus` is set.                                                    |
| `collisionPadding`      | `collision-padding`       | `number`                                 | `0`        | Keep this much space between popup and viewport edge, in px. Non-finite values throw.                                       |
| `arrowPadding`          | `arrow-padding`           | `number`                                 | `0`        | Minimum distance between the arrow and popup edges, in px (never looser than `collision-padding`). Non-finite values throw. |
| `disableAnchorTracking` | `disable-anchor-tracking` | `boolean`                                | `false`    | Skip repositioning on scroll/resize/layout shifts while open.                                                               |
| `initialFocus`          | `initial-focus`           | `Element \| string \| null`              | `null`     | Element or selector focused on open. Non-element values throw.                                                              |
| `finalFocus`            | `final-focus`             | `Element \| string \| null`              | `null`     | Element or selector focused on close; defaults to the trigger. Non-element values throw.                                    |
| `side`                  | `side`                    | `"top" \| "right" \| "bottom" \| "left"` | `"bottom"` | Preferred side; flips when it overflows. Invalid values throw.                                                              |
| `align`                 | `align`                   | `"start" \| "center" \| "end"`           | `"center"` | Cross-axis alignment. Invalid values throw.                                                                                 |
| `sideOffset`            | `side-offset`             | `number`                                 | `0`        | Gap in px. Non-finite values throw.                                                                                         |
| `alignOffset`           | `align-offset`            | `number`                                 | `0`        | Cross-axis shift in px. Non-finite values throw.                                                                            |
| `strategy`              | `strategy`                | `"absolute" \| "fixed"`                  | `"fixed"`  | Positioning strategy. Invalid values throw.                                                                                 |
| `anchor`                | `anchor`                  | `Element \| string \| null`              | `null`     | Override anchor (element or selector); `null` anchors to the trigger.                                                       |
| `triggerClass`          | `trigger-class`           | `string`                                 | `""`       | Extra classes for the trigger.                                                                                              |
| `popupClass`            | `popup-class`             | `string`                                 | `""`       | Extra classes for the popup.                                                                                                |
| `closeClass`            | `close-class`             | `string`                                 | `""`       | Extra classes for each `data-close` button.                                                                                 |
| `backdropClass`         | `backdrop-class`          | `string`                                 | `""`       | Extra classes for the modal backdrop.                                                                                       |
| `titleClass`            | `title-class`             | `string`                                 | `""`       | Extra classes for the `data-title` element.                                                                                 |
| `descriptionClass`      | `description-class`       | `string`                                 | `""`       | Extra classes for the `data-description` element.                                                                           |
| `onOpenChange`          | — (property only)         | `((open: boolean) => void) \| null`      | `null`     | Must be a function or null.                                                                                                 |

### Methods

| Method           | Notes                                                                                    |
| ---------------- | ---------------------------------------------------------------------------------------- |
| `show()`         | Imperative open (needs no trigger click); anchors to the trigger unless `anchor` is set. |
| `close()`        | Imperative close.                                                                        |
| `toggle(force?)` | Toggle, or force with a boolean.                                                         |

`open` is the boolean state property, so imperative open is `show()` —
same split as `HTMLDialogElement` (`open` + `show()`/`close()`).

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

Close buttons are any `<button data-close>` inside the popup. A `[data-title]`
child labels the popup and a `[data-description]` child describes it. Wrong
count or type throws `TypeError`. The popup gets `popover="auto"`,
`role="dialog"`, and `data-testid="bwc-popover-popup"`; parts keep author
classes plus `popover-trigger` / `popover-popup` / `popover-close` /
`popover-title` / `popover-description` marker classes and stable testids.
The modal backdrop gets `popover-backdrop` plus `backdrop-class` and
`data-testid="bwc-popover-backdrop"`.

- Trigger gets `aria-haspopup="dialog"`, `aria-controls` → popup id, and
  `aria-expanded`; state mirrors as `data-open` / `data-closed` /
  `data-disabled` on trigger and popup. Disabled trigger uses the
  `not-allowed` cursor.
- Positioning runs through the shared floating core (`src/floating`):
  JS measures the anchor and writes `left`/`top` plus `data-side`
  (placed side, after flip) / `data-align`; scroll/resize/layout changes
  reposition while open. A `[data-arrow]` child of the popup is centered
  on the cross axis automatically.

### Form behavior

None.

### Errors

- `TypeError` for invalid slot topology, invalid `side`, non-finite
  `side-offset`, or non-function `onOpenChange`.

### State ownership

Without `open`, interactions update internal state seeded by `default-open`.
Assigning `open` permanently enters controlled mode. Property assignments and
`show()` / `close()` / `toggle()` apply immediately and emit `open-change`
when the effective state changes; other interactions only request changes in
controlled mode.
