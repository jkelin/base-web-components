# bwc-toast-region / bwc-toast

Toast notifications: `bwc-toast-region` is the viewport that owns stacking and
queueing; `bwc-toast` is one notification with an auto-dismiss timer that
pauses on hover/focus.

```js
import "basic-web-components/toast";
```

## Usage

Declarative:

```html
<bwc-toast-region position="bottom-right" limit="3" duration="5000">
  <bwc-toast type="success" default-open>
    <header data-toast-header>
      <div data-title>Saved</div>
      <button data-close title="Close">×</button>
    </header>
    <div data-description>Your changes are live.</div>
  </bwc-toast>
</bwc-toast-region>
```

Imperative (the key JS-triggerable path):

```html
<bwc-toast-region id="toasts"></bwc-toast-region>
<script>
  const region = document.getElementById("toasts");
  const toast = region.showToast({
    title: "Saved",
    description: "Your changes are live.",
    type: "success",
    actionLabel: "Undo",
  });
  // `toast` is the `bwc-toast` element: toast.close(), toast.remove(), …
</script>
```

## API

### bwc-toast-region properties / attributes

| Property   | Attribute  | Type                                                                                              | Default          | Notes                                                                         |
| ---------- | ---------- | ------------------------------------------------------------------------------------------------- | ---------------- | ----------------------------------------------------------------------------- |
| `position` | `position` | `"top-left" \| "top-center" \| "top-right" \| "bottom-left" \| "bottom-center" \| "bottom-right"` | `"bottom-right"` | Viewport corner; mirrors `data-position`. Invalid values throw.               |
| `limit`    | `limit`    | `number`                                                                                          | `3`              | Max visible toasts; extras wait with `data-limited`. Non-finite values throw. |
| `duration` | `duration` | `number`                                                                                          | `5000`           | Default auto-dismiss ms for children; `0` = sticky. Non-finite values throw.  |

Method: `showToast({ title?, description?, type?, duration?, actionLabel? })`
builds a `bwc-toast` with a `data-toast-header` containing `data-title` and
the `data-close` dismiss button, followed by `data-description` and an
optional `data-action` button. It appends the toast uncontrolled
(`default-open`, so auto-dismiss and `close()` work without wiring) and
returns it.

### bwc-toast properties / attributes

| Property           | Attribute           | Type                                          | Default  | Notes                                                                                     |
| ------------------ | ------------------- | --------------------------------------------- | -------- | ----------------------------------------------------------------------------------------- |
| `open`             | `open`              | `boolean`                                     | `false`  | Present (or assigned) → controlled mode.                                                  |
| `defaultOpen`      | `default-open`      | `boolean`                                     | `false`  | Seed for uncontrolled mode.                                                               |
| `duration`         | `duration`          | `number`                                      | `-1`     | Auto-dismiss ms; `-1` inherits the region default; `0` = sticky. Non-finite values throw. |
| `type`             | `type`              | `"success" \| "error" \| "info" \| "warning"` | `"info"` | Mirrors `data-type`. Invalid values throw.                                                |
| `titleClass`       | `title-class`       | `string`                                      | `""`     | Extra classes for the `data-title` element.                                               |
| `descriptionClass` | `description-class` | `string`                                      | `""`     | Extra classes for the `data-description` element.                                         |
| `actionClass`      | `action-class`      | `string`                                      | `""`     | Extra classes for each `data-action` button.                                              |
| `closeClass`       | `close-class`       | `string`                                      | `""`     | Extra classes for each `data-close` button.                                               |
| `onOpenChange`     | — (property only)   | `((open: boolean) => void) \| null`           | `null`   | Must be a function or null.                                                               |

Methods: `show()`, `close()`, `toggle(force?)`. There is no `open()` method:
`open` is the boolean state property, mirroring `HTMLDialogElement`.

### Events

| Name          | Detail              | Bubbles / composed |
| ------------- | ------------------- | ------------------ |
| `open-change` | `{ open: boolean }` | yes / yes          |

The region listens for bubbled `open-change` events (plus child-list
mutations) to re-apply `limit`.

### Parts

Toast content lives in the default slot: a `[data-toast-header]` containing
`[data-title]` and `<button data-close>`, followed by `[data-description]`
and `<button data-action>` (closes by default; `data-keep-open` opts out).
Parts carry `toast-*` marker classes plus stable testids; author classes are
preserved. Open/closed state mirrors as `data-open` / `data-closed`; toasts
beyond `limit` carry `data-limited` and stay hidden until a slot frees up.

### Accessibility

- Each toast gets `role="status"`, `aria-labelledby` / `aria-describedby`
  from its title/description parts, and auto-assigned ids.
- The auto-dismiss timer pauses while the pointer hovers the toast or focus
  is inside it, and resumes with the remaining delay on leave/blur.

### Omitted Base UI features

- **Swipe-to-dismiss**: not implemented (no pointer-gesture machinery in the
  shared floating core); use the close button or `toast.close()`.
- **Expanded/stacked peek transforms** (`--toast-index`, `--toast-offset-y`,
  `data-expanded` height animation): toasts stack as a plain flex column;
  only show/hide `data-starting-style` / `data-ending-style` hooks are kept.
- **`Toast.useToastManager` promise API** (`update`, `promise`, swipe
  directions): out of scope for a web-component port; `showToast()` plus the
  returned element cover create/dismiss.

### Errors

- `TypeError` for invalid `position`, `type`, `limit`, or `duration` values,
  for non-function `onOpenChange`, and for non-object `showToast()` options.

### State ownership

Without `open`, interactions update internal state seeded by `default-open`.
Assigning `open` permanently enters controlled mode. Property assignments and
`show()` / `close()` / `toggle()` apply immediately and emit `open-change`
when the effective state changes; other interactions only request changes in
controlled mode.
