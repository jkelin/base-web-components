# bwc-tooltip

A non-modal hover tooltip anchored to any focusable trigger, built on the
shared floating core (`src/floating`). Hovering or focusing the trigger opens
it; leaving both surfaces, blurring, pressing Escape, or clicking the trigger
closes it.

```js
import "basic-web-components/tooltip";
```

## Usage

Uncontrolled:

```html
<bwc-tooltip>
  <button slot="trigger">Save</button>
  <div slot="popup">Saves the current file</div>
</bwc-tooltip>
```

Controlled, opening on the right with custom delays:

```html
<bwc-tooltip id="t" side="right" delay="300" close-delay="150">
  <button slot="trigger">Save</button>
  <div slot="popup">Saves the current file</div>
</bwc-tooltip>
<script>
  const t = document.getElementById("t");
  t.onOpenChange = (open) => {
    open ? t.setAttribute("open", "") : t.removeAttribute("open");
  };
</script>
```

Hover/focus opens; blur, pointer leave, Escape, outside pointerdown, and
trigger click close.

While open, the trigger's native `title` is suppressed so only the custom
tooltip shows; it is restored on close. When the component is `disabled` it
never opens, so a native `title` stays visible as a fallback.

The popup carries `data-starting-style` during the opening frames and
`data-ending-style` while closing, for author-driven enter/exit transitions:

```css
bwc-tooltip > [slot="popup"] {
  transition: opacity 100ms ease-out;
}
bwc-tooltip > [slot="popup"][data-starting-style],
bwc-tooltip > [slot="popup"][data-ending-style] {
  opacity: 0;
}
```

Closing waits for the popup's transition (duration + delay) before hiding;
without a transition it hides synchronously. Positioning also writes
`--transform-origin` (the anchor point on the popup edge) for scale/fade
origins. Tooltips form an implicit page-wide group: hovering a trigger
within `timeout` ms of any tooltip closing skips `delay`.

## API

| Property                | Attribute                 | Type                                     | Default    | Notes                                                                                                                                        |
| ----------------------- | ------------------------- | ---------------------------------------- | ---------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `open`                  | `open`                    | `boolean`                                | `false`    | Present (or assigned) → controlled mode. Reflects to `open`.                                                                                 |
| `defaultOpen`           | `default-open`            | `boolean`                                | `false`    | Seed for uncontrolled mode.                                                                                                                  |
| `disabled`              | `disabled`                | `boolean`                                | `false`    | Blocks hover/focus/programmatic opens; trigger shows `aria-disabled`.                                                                        |
| `delay`                 | `delay`                   | `number`                                 | `600`      | Hover-open delay in ms. Non-finite values throw.                                                                                             |
| `closeDelay`            | `close-delay`             | `number`                                 | `0`        | Hover-close delay in ms. Non-finite values throw.                                                                                            |
| `hoverable`             | `hoverable`               | `boolean`                                | `true`     | Pointer may move trigger → popup. Set `hoverable="false"` to disable.                                                                        |
| `closeOnClick`          | `close-on-click`          | `boolean`                                | `true`     | Trigger click closes. Set `close-on-click="false"` to disable.                                                                               |
| `trackCursor`           | `track-cursor`            | `"none" \| "x" \| "y" \| "both"`         | `"none"`   | Anchor the popup to the pointer (`"x"`/`"y"` lock one axis to the trigger center). Overrides `anchor` while set. Invalid values throw.       |
| `timeout`               | `timeout`                 | `number`                                 | `400`      | Group window in ms: hovering a trigger within this long after any tooltip closed opens instantly, skipping `delay`. Non-finite values throw. |
| `collisionPadding`      | `collision-padding`       | `number`                                 | `0`        | Keep this much space between popup and viewport edge, in px. Non-finite values throw.                                                        |
| `arrowPadding`          | `arrow-padding`           | `number`                                 | `0`        | Minimum distance between the arrow and popup edges, in px (never looser than `collision-padding`). Non-finite values throw.                  |
| `disableAnchorTracking` | `disable-anchor-tracking` | `boolean`                                | `false`    | Skip repositioning on scroll/resize/layout shifts while open.                                                                                |
| `side`                  | `side`                    | `"top" \| "right" \| "bottom" \| "left"` | `"top"`    | Preferred side; flips when it overflows. Invalid values throw.                                                                               |
| `align`                 | `align`                   | `"start" \| "center" \| "end"`           | `"center"` | Cross-axis alignment. Invalid values throw.                                                                                                  |
| `sideOffset`            | `side-offset`             | `number`                                 | `0`        | Gap in px. Non-finite values throw.                                                                                                          |
| `alignOffset`           | `align-offset`            | `number`                                 | `0`        | Cross-axis shift in px. Non-finite values throw.                                                                                             |
| `strategy`              | `strategy`                | `"absolute" \| "fixed"`                  | `"fixed"`  | Positioning strategy. Invalid values throw.                                                                                                  |
| `anchor`                | `anchor`                  | `Element \| string \| null`              | `null`     | Override anchor (element or selector); `null` anchors to the trigger.                                                                        |
| `triggerClass`          | `trigger-class`           | `string`                                 | `""`       | Extra classes for the trigger.                                                                                                               |
| `popupClass`            | `popup-class`             | `string`                                 | `""`       | Extra classes for the popup.                                                                                                                 |
| `onOpenChange`          | — (property only)         | `((open: boolean) => void) \| null`      | `null`     | Must be a function or null.                                                                                                                  |

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

| Slot      | Required element    |
| --------- | ------------------- |
| `trigger` | exactly one element |
| `popup`   | exactly one `div`   |

Wrong count or type throws `TypeError`. The popup gets `role="tooltip"` and
`data-testid="bwc-tooltip-popup"`; parts keep author classes plus
`tooltip-trigger` / `tooltip-popup` marker classes and stable testids.

- Trigger gets `aria-describedby` → popup id; state mirrors as `data-open` /
  `data-closed` / `data-disabled` on trigger and popup. Disabled trigger uses
  the `not-allowed` cursor.
- Positioning runs through the shared floating core (`src/floating`):
  JS measures the anchor and writes `left`/`top` plus `data-side`
  (placed side, after flip) / `data-align`; scroll/resize/layout changes
  reposition while open. A `[data-arrow]` child of the popup is centered
  on the cross axis automatically.

### Form behavior

None.

### Errors

- `TypeError` for invalid slot topology, invalid `side`, non-finite
  `delay`, or non-function `onOpenChange`.

### State ownership

Without `open`, interactions update internal state seeded by `default-open`.
Assigning `open` permanently enters controlled mode. Property assignments and
`show()` / `close()` / `toggle()` apply immediately and emit `open-change`
when the effective state changes; other interactions only request changes in
controlled mode.
