# bwc-switch

An on/off toggle. Unlike the other components it takes no author children:
it generates its own `button` (with thumb) plus a hidden checkbox so the
value submits with native forms. Use it for settings and preferences instead
of a raw checkbox.

```js
import "basic-web-components/switch";
```

## Usage

Uncontrolled (starts on; form submits `name=value` when checked):

```html
<form>
  <bwc-switch default-checked name="notifications"></bwc-switch>
</form>
```

Controlled:

```html
<bwc-switch id="s" checked></bwc-switch>
<script>
  const s = document.getElementById("s");
  s.onCheckedChange = (checked) => {
    checked ? s.setAttribute("checked", "") : s.removeAttribute("checked");
  };
</script>
```

No markup inside — the component appends a `button slot="control"` (with a
thumb `span`) and an `input slot="form-control"` itself. Never author them.

## API

### Properties / attributes

| Property          | Attribute         | Type                                   | Default | Notes                                          |
| ----------------- | ----------------- | -------------------------------------- | ------- | ---------------------------------------------- |
| `checked`         | `checked`         | `boolean`                              | `false` | Present → controlled mode.                     |
| `defaultChecked`  | `default-checked` | `boolean`                              | `false` | Seed for uncontrolled mode.                    |
| `disabled`        | `disabled`        | `boolean`                              | `false` | Blocks toggling; syncs to button and input.    |
| `readOnly`        | `readonly`        | `boolean`                              | `false` | Blocks toggling; reversible unlike `disabled`. |
| `required`        | `required`        | `boolean`                              | `false` | Mirrored to the hidden input for validation.   |
| `name`            | `name`            | `string`                               | `""`    | Form field name (hidden input).                |
| `value`           | `value`           | `string`                               | `"on"`  | Form field value (hidden input).               |
| `form`            | `form`            | `string`                               | `""`    | Associates the hidden input with a form by id. |
| `ariaLabel`       | `aria-label`      | `string`                               | `""`    | Label for the switch button.                   |
| `buttonClass`     | `button-class`    | `string`                               | `""`    | Extra classes for the button.                  |
| `thumbClass`      | `thumb-class`     | `string`                               | `""`    | Extra classes for the thumb.                   |
| `inputClass`      | `input-class`     | `string`                               | `""`    | Extra classes for the hidden input.            |
| `onCheckedChange` | — (property only) | `((checked: boolean) => void) \| null` | `null`  | Must be a function or null.                    |

### Events

| Name             | Detail                 | Bubbles / composed |
| ---------------- | ---------------------- | ------------------ |
| `checked-change` | `{ checked: boolean }` | yes / yes          |

Clicking the button (or changing the hidden checkbox) emits the requested
value. Disabled / read-only / no-op requests restore the rendered state
instead. In controlled mode state only changes when you update `checked`.

### Slots / parts (all generated, none authored)

| Slot           | Generated element                                                                                                                                                      |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `control`      | `button` (`type="button"`, `role="switch"`, `data-testid="bwc-switch-button"`), id `<host-id>-button`, containing the thumb `span` (`data-testid="bwc-switch-thumb"`). |
| `form-control` | `input type="checkbox"` (`data-testid="bwc-switch-input"`), visually hidden (`tabindex="-1"`, `aria-hidden="true"`).                                                   |

Projected through `slot[name="control"]` and `slot[name="form-control"]` in
shadow. Marker classes `switch-button` / `switch-thumb` / `switch-input`
merge after author classes.

### Accessibility

- The button is `role="switch"` with `aria-checked`, `aria-disabled`,
  `aria-readonly`, `aria-required`, and `aria-label` (removed when empty).
- State mirrors as `data-checked` / `data-unchecked` / `data-disabled` /
  `data-readonly` / `data-required` on host, button, and thumb. Disabled
  button uses the `not-allowed` cursor.

### Form behavior

- The hidden checkbox carries `name` / `value` / `form` / `disabled` /
  `required`; its `defaultChecked` tracks `defaultChecked` (uncontrolled) or
  the current value (controlled).
- Form `reset` restores `defaultChecked` in uncontrolled mode; controlled
  switches ignore reset (except via the `checked` attribute being present).

### Errors

- `TypeError` when `onCheckedChange` is a non-function, non-null value.
