# bwc-menubar

A horizontal bar of top-level menus, built on `bwc-menu` (`src/menu`). The
bar itself is a coordinator with no open state of its own: each child
`bwc-menu` owns its open state through its public API (`show()` / `close()`
/ `toggle()`, the `open` property, and `open-change` events), and the
menubar adds roving focus, hover/focus switching, and a single-open
invariant on top.

```js
import "basic-web-components/menu";
import "basic-web-components/menubar";
```

Both imports are needed: `menubar` does not register `bwc-menu` itself.

## Usage

```html
<bwc-menubar>
  <bwc-menu id="file">
    <button slot="trigger">File</button>
    <div slot="popup">
      <button data-menu-item>New</button>
      <button data-menu-item>Open</button>
    </div>
  </bwc-menu>
  <bwc-menu id="edit">
    <button slot="trigger">Edit</button>
    <div slot="popup">
      <button data-menu-item>Undo</button>
    </div>
  </bwc-menu>
</bwc-menubar>
<script>
  const bar = document.querySelector("bwc-menubar");
  bar.openMenu("edit"); // by child id, or by index: bar.openMenu(1)
  bar.closeAll();
</script>
```

Clicking (or `Enter` on) a trigger toggles its menu through `bwc-menu`
itself; whenever any menu opens, the bar closes the others. Once a menu is
open, hovering or focusing another trigger switches to it.

## API

| Property      | Attribute     | Type                         | Default        | Notes                                                      |
| ------------- | ------------- | ---------------------------- | -------------- | ---------------------------------------------------------- |
| `disabled`    | `disabled`    | `boolean`                    | `false`        | Blocks switching and `openMenu`; `closeAll` still works.   |
| `loopFocus`   | `loop-focus`  | `boolean`                    | `true`         | Wrap focus past the first/last trigger.                    |
| `orientation` | `orientation` | `"horizontal" \| "vertical"` | `"horizontal"` | Roving direction. Invalid values throw.                    |
| `delay`       | `delay`       | `number`                     | `100`          | Hover-switch delay in ms once a menu is open.              |
| `closeDelay`  | `close-delay` | `number`                     | `0`            | Leave-the-bar close delay in ms; `0` disables leave-close. |

There is deliberately no `open` property and no `show()` / `close()` /
`toggle()`: the bar owns no open state. Each child `bwc-menu` is
individually toggleable, and the bar coordinates through `openMenu` /
`closeAll`. There is no `trigger-class` / `onOpenChange` either: open
notifications come from the child menus' own `open-change` events, which
bubble through the bar.

### Methods

| Method                         | Notes                                                                   |
| ------------------------------ | ----------------------------------------------------------------------- |
| `openMenu(index \| id, opts?)` | Open one menu, closing the rest. `{ focus: true }` focuses its trigger. |
| `closeAll()`                   | Close every child menu.                                                 |

`openMenu` throws `RangeError` for an unknown index/id and `TypeError`
for any other argument type. It is a no-op while `disabled` or when the
target menu is itself disabled.

### Events

The bar emits none of its own. Child `bwc-menu` `open-change` events
(`{ open: boolean }`) bubble through it, so one listener on the bar
observes every menu.

### Children

Direct `bwc-menu` children only (nested submenus inside popups are
ignored). Zero child menus throws `TypeError`. The host gets
`role="menubar"`, `aria-orientation`, and `data-testid="bwc-menubar"`;
state mirrors as `data-open` / `data-closed` (any menu open) and
`data-disabled`. Triggers keep a toolbar-style roving `tabindex`
(first enabled trigger is tabbable).

- Keyboard on a trigger: `ArrowLeft`/`ArrowRight` (or `Up`/`Down` when
  vertical) roves, `Home`/`End` jumps; `Enter`/`ArrowDown` opens through
  the child menu itself. Printable characters run trigger-label
  typeahead (500ms window, repeats cycle). While a menu is open, roving
  (or focusing another trigger) switches to that menu.
- Keyboard inside an open popup: `ArrowLeft`/`ArrowRight` (or
  `Up`/`Down` when vertical) and `Home`/`End` switch to the
  neighboring menu and focus its trigger. `Escape` is the child menu's
  own (closes and refocuses its trigger).
- Hover: with every menu closed, hovering does nothing (click to open).
  With a menu open, hovering another trigger switches after `delay`.
  Leaving the bar entirely closes everything after `close-delay`
  (disabled by default).

### Form behavior

None.

### Errors

- `TypeError` for zero `bwc-menu` children, invalid `orientation`, or
  non-finite delays.
- `RangeError` from `openMenu` for an unknown index/id.
