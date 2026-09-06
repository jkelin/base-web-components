# bwc-slide-out

Non-modal drawer panel sliding in from the viewport edge, with a shadow-DOM
dismiss overlay, Escape dismissal, and focus management. Built for navigation
menus and side panels that must not trap focus like a modal dialog.

```html
<bwc-slide-out id="menu" data-testid="menu">
  <button slot="trigger" id="menu-button" data-testid="menu-button">Menu</button>
  <nav slot="panel" id="menu-panel" data-testid="menu-panel">
    <a href="./counter.html">Counter</a>
    <a href="./modal.html">Modal</a>
    <button data-close id="menu-close" data-testid="menu-close">Close</button>
  </nav>
</bwc-slide-out>
```

```js
import "basic-web-components/slide-out";

const menu = document.getElementById("menu");
menu.onOpenChange = (open) => console.log("open:", open);
```

## Behavior

- The trigger toggles the panel; any `button[data-close]` inside the panel
  closes it. Clicking the dimmed overlay or pressing Escape also closes.
- Opening moves focus to the first focusable element in the panel (or the
  panel itself); closing restores focus to the trigger.
- The panel is a non-modal `role="dialog"` (`aria-modal="false"`), so page
  content stays reachable by assistive technology while open.
- `side="left"` docks the panel to the left edge; the default `"right"`
  docks it to the right. The slide transition honors
  `prefers-reduced-motion`.
- `disabled` disables the trigger (`not-allowed` cursor) and blocks
  open/close requests.

## Controlled vs uncontrolled

Uncontrolled by default (`default-open` sets the initial state). The `open`
attribute/property makes it controlled: interactions emit `open-change`
(and call `onOpenChange`) without changing state until the attribute
changes.

```html
<bwc-slide-out open side="left">
  <button slot="trigger">Menu</button>
  <nav slot="panel">
    <a href="./">Overview</a>
    <button data-close>Close</button>
  </nav>
</bwc-slide-out>
```

## API

### Props

| Prop           | Attribute       | Type                                | Default   | Description                              |
| -------------- | --------------- | ----------------------------------- | --------- | ---------------------------------------- |
| `open`         | `open`          | `boolean`                           | `false`   | Controlled open state.                   |
| `defaultOpen`  | `default-open`  | `boolean`                           | `false`   | Initial state when uncontrolled.         |
| `disabled`     | `disabled`      | `boolean`                           | `false`   | Blocks trigger and open/close requests.  |
| `side`         | `side`          | `"left" \| "right"`                 | `"right"` | Viewport edge the panel docks to.        |
| `triggerClass` | `trigger-class` | `string`                            | `""`      | Classes merged after the trigger marker. |
| `panelClass`   | `panel-class`   | `string`                            | `""`      | Classes merged after the panel marker.   |
| `closeClass`   | `close-class`   | `string`                            | `""`      | Classes merged after the close marker.   |
| `onOpenChange` | —               | `((open: boolean) => void) \| null` | `null`    | Callback for every open/close request.   |

Invalid `side` values throw at the boundary; they never fall back silently.

### Events

| Event         | Detail              | Description                        |
| ------------- | ------------------- | ---------------------------------- |
| `open-change` | `{ open: boolean }` | Fired on every open/close request. |

### Slots

| Slot      | Element                         | Description                                             |
| --------- | ------------------------------- | ------------------------------------------------------- |
| `trigger` | `button` (exactly one)          | Toggles the panel.                                      |
| `panel`   | any `HTMLElement` (exactly one) | Drawer panel; holds nav links and `button[data-close]`. |

Exactly one trigger button and one panel are required; the component throws
otherwise. Missing `id`/`data-testid` values are generated
(`bwc-slide-out-trigger`, `bwc-slide-out-panel`, `bwc-slide-out-close`,
`bwc-slide-out-overlay`); author values survive upgrades.
