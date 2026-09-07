# bwc-preview-card

A non-modal link preview card anchored to an `a[href]` trigger, built on the
shared floating core (`src/floating`). Hovering or focusing the link opens
the card; leaving both surfaces, blurring, pressing Escape, or clicking the
link closes it. The card stays open while the pointer rests on it
(always hoverable).

```js
import "basic-web-components/preview-card";
```

## Usage

Uncontrolled:

```html
<bwc-preview-card>
  <a slot="trigger" href="/docs">Documentation</a>
  <div slot="popup">Short preview of the docs page.</div>
</bwc-preview-card>
```

Controlled, opening on top:

```html
<bwc-preview-card id="c" side="top">
  <a slot="trigger" href="/docs">Documentation</a>
  <div slot="popup">Short preview of the docs page.</div>
</bwc-preview-card>
<script>
  const c = document.getElementById("c");
  c.onOpenChange = (open) => {
    open ? c.setAttribute("open", "") : c.removeAttribute("open");
  };
</script>
```

Hover/focus opens; blur, pointer leave, Escape, outside pointerdown, and
trigger click close. `track-cursor` is intentionally unsupported (there is no
Base UI preview-card provider to group with, and cursor-anchoring a link
preview would detach it from the link it describes).

While open, the trigger's native `title` is suppressed so only the custom
card shows; it is restored on close.

The popup carries `data-starting-style` during the opening frames and
`data-ending-style` while closing, for author-driven enter/exit transitions:

```css
bwc-preview-card > [slot="popup"] {
  transition: opacity 100ms ease-out;
}
bwc-preview-card > [slot="popup"][data-starting-style],
bwc-preview-card > [slot="popup"][data-ending-style] {
  opacity: 0;
}
```

Closing waits for the popup's transition (duration + delay) before hiding;
without a transition it hides synchronously. Positioning also writes
`--transform-origin` (the anchor point on the popup edge) for scale/fade
origins.

## API

| Property                | Attribute                 | Type                                     | Default    | Notes                                                                                                                       |
| ----------------------- | ------------------------- | ---------------------------------------- | ---------- | --------------------------------------------------------------------------------------------------------------------------- |
| `open`                  | `open`                    | `boolean`                                | `false`    | Present (or assigned) → controlled mode. Reflects to `open`.                                                                |
| `defaultOpen`           | `default-open`            | `boolean`                                | `false`    | Seed for uncontrolled mode.                                                                                                 |
| `disabled`              | `disabled`                | `boolean`                                | `false`    | Blocks hover/focus/programmatic opens; trigger shows `aria-disabled`.                                                       |
| `delay`                 | `delay`                   | `number`                                 | `600`      | Hover-open delay in ms. Non-finite values throw.                                                                            |
| `closeDelay`            | `close-delay`             | `number`                                 | `300`      | Hover-close delay in ms. Non-finite values throw.                                                                           |
| `closeOnClick`          | `close-on-click`          | `boolean`                                | `true`     | Trigger click closes. Set `close-on-click="false"` to disable.                                                              |
| `collisionPadding`      | `collision-padding`       | `number`                                 | `0`        | Keep this much space between popup and viewport edge, in px. Non-finite values throw.                                       |
| `arrowPadding`          | `arrow-padding`           | `number`                                 | `0`        | Minimum distance between the arrow and popup edges, in px (never looser than `collision-padding`). Non-finite values throw. |
| `disableAnchorTracking` | `disable-anchor-tracking` | `boolean`                                | `false`    | Skip repositioning on scroll/resize/layout shifts while open.                                                               |
| `side`                  | `side`                    | `"top" \| "right" \| "bottom" \| "left"` | `"bottom"` | Preferred side; flips when it overflows. Invalid values throw.                                                              |
| `align`                 | `align`                   | `"start" \| "center" \| "end"`           | `"center"` | Cross-axis alignment. Invalid values throw.                                                                                 |
| `sideOffset`            | `side-offset`             | `number`                                 | `0`        | Gap in px. Non-finite values throw.                                                                                         |
| `alignOffset`           | `align-offset`            | `number`                                 | `0`        | Cross-axis shift in px. Non-finite values throw.                                                                            |
| `strategy`              | `strategy`                | `"absolute" \| "fixed"`                  | `"fixed"`  | Positioning strategy. Invalid values throw.                                                                                 |
| `anchor`                | `anchor`                  | `Element \| string \| null`              | `null`     | Override anchor (element or selector); `null` anchors to the trigger.                                                       |
| `triggerClass`          | `trigger-class`           | `string`                                 | `""`       | Extra classes for the trigger.                                                                                              |
| `popupClass`            | `popup-class`             | `string`                                 | `""`       | Extra classes for the popup.                                                                                                |
| `onOpenChange`          | — (property only)         | `((open: boolean) => void) \| null`      | `null`     | Must be a function or null.                                                                                                 |

The card is always hoverable: the pointer may move trigger → card without
closing it. There is no `hoverable` property.

### Methods

| Method           | Notes                                                                            |
| ---------------- | -------------------------------------------------------------------------------- |
| `show()`         | Imperative open (needs no hover); anchors to the trigger unless `anchor` is set. |
| `close()`        | Imperative close.                                                                |
| `toggle(force?)` | Toggle, or force with a boolean.                                                 |

`open` is the boolean state property, so imperative open is `show()` —
same split as `HTMLDialogElement` (`open` + `show()`/`close()`). There is no
`open()` method.

### Events

| Name          | Detail              | Bubbles / composed |
| ------------- | ------------------- | ------------------ |
| `open-change` | `{ open: boolean }` | yes / yes          |

### Slots

| Slot      | Required element      |
| --------- | --------------------- |
| `trigger` | exactly one `a[href]` |
| `popup`   | exactly one `div`     |

Wrong count, a non-anchor trigger, or an anchor without `href` throws
`TypeError`. The popup gets `role="dialog"` and
`data-testid="bwc-preview-card-popup"`; parts keep author classes plus
`preview-card-trigger` / `preview-card-popup` marker classes and stable
testids.

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

- `TypeError` for invalid slot topology (including an `href`-less trigger),
  invalid `side`, non-finite `delay`, or non-function `onOpenChange`.

### State ownership

Without `open`, interactions update internal state seeded by `default-open`.
Assigning `open` permanently enters controlled mode. Property assignments and
`show()` / `close()` / `toggle()` apply immediately and emit `open-change`
when the effective state changes; other interactions only request changes in
controlled mode.
