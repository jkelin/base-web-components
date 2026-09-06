# bwc-otp

A one-time-code input: `length` single-character fields plus one hidden input
so the code submits with native forms. Like switch it takes no author
children — fields are generated. Use it for verification / 2FA codes.

```js
import "basic-web-components/otp";
```

## Usage

Uncontrolled 6-digit code inside a form:

```html
<form>
  <bwc-otp length="6" name="code"></bwc-otp>
</form>
```

Controlled with completion handling:

```html
<bwc-otp id="otp" length="4"></bwc-otp>
<script>
  const otp = document.getElementById("otp");
  otp.onValueChange = (v) => {
    otp.setAttribute("value", v);
  };
  otp.onValueComplete = (v) => submitCode(v);
</script>
```

Typing filters per `validation-type`, overflows into following fields, and
moves focus forward; `Backspace`/`Delete` clear and move back; pasting fills
from the focused field; `ArrowLeft`/`ArrowRight` move between fields.

## API

### Properties / attributes

| Property           | Attribute            | Type                                               | Default                                  | Notes                                                                         |
| ------------------ | -------------------- | -------------------------------------------------- | ---------------------------------------- | ----------------------------------------------------------------------------- |
| `length`           | `length`             | `number`                                           | (required)                               | Positive integer; field count. Missing or invalid throws.                     |
| `validationType`   | `validation-type`    | `"numeric" \| "alpha" \| "alphanumeric" \| "none"` | `"numeric"`                              | Invalid values throw.                                                         |
| `value`            | `value`              | `string`                                           | `""`                                     | Nonempty (or assigned) → controlled mode. Normalized + truncated to `length`. |
| `defaultValue`     | `default-value`      | `string`                                           | `""`                                     | Seed for uncontrolled mode.                                                   |
| `mask`             | `mask`               | `boolean`                                          | `false`                                  | Renders fields as `type="password"`.                                          |
| `disabled`         | `disabled`           | `boolean`                                          | `false`                                  | Disables fields and hidden input; input is rejected.                          |
| `readOnly`         | `readonly`           | `boolean`                                          | `false`                                  | Rejects input without disabling.                                              |
| `required`         | `required`           | `boolean`                                          | `false`                                  | Mirrored to fields.                                                           |
| `name`             | `name`               | `string`                                           | `""`                                     | Form field name (hidden input).                                               |
| `form`             | `form`               | `string`                                           | `""`                                     | Associates fields + hidden input with a form by id.                           |
| `autocomplete`     | `autocomplete`       | `string`                                           | `"one-time-code"`                        | Written to every field.                                                       |
| `inputMode`        | `inputmode`          | `string`                                           | `"numeric"` for `numeric`, else `"text"` | Empty falls back per `validation-type`.                                       |
| `fieldClass`       | `field-class`        | `string`                                           | `""`                                     | Extra Tailwind classes per field.                                             |
| `hiddenInputClass` | `hidden-input-class` | `string`                                           | `""`                                     | Extra Tailwind classes for the hidden input.                                  |
| `onValueChange`    | — (property only)    | `((value: string) => void) \| null`                | `null`                                   | Fires on every committed edit.                                                |
| `onValueComplete`  | — (property only)    | `((value: string) => void) \| null`                | `null`                                   | Fires when the value reaches `length`.                                        |

Filtering: `numeric` strips non-`0-9`, `alpha` non-`a-z` (either case),
`alphanumeric` non-`a-z0-9`, `none` keeps everything; the result is sliced to
`length`. `length` must be a positive integer (`"<name> must be a positive
integer"`).

### Events

| Name             | Detail              | Bubbles / composed |
| ---------------- | ------------------- | ------------------ |
| `value-change`   | `{ value: string }` | yes / yes          |
| `value-complete` | `{ value: string }` | yes / yes          |

Callbacks fire before their events. In controlled mode the rendered fields
repaint without adopting the edit until you update `value`.

### Slots / parts (all generated, none authored)

| Slot           | Generated elements                                                                             |
| -------------- | ---------------------------------------------------------------------------------------------- |
| `field`        | Exactly `length` native `input`s (`maxlength="1"`, `data-testid="bwc-otp-input"`, stable ids). |
| `form-control` | One `input type="hidden"` (`data-testid="bwc-otp-hidden-input"`).                              |

No custom field tag. Surviving fields keep ids, focus, selection, and author
classes when `length` changes; marker class `otp-field` / `otp-hidden-input`
merges after author classes.

### Accessibility

- Each field has `aria-label="Character N of M"` and uses the `text` cursor
  (`not-allowed` when disabled); state mirrors as `data-complete` /
  `data-disabled` / `data-readonly` / `data-required` on fields and host.

### Form behavior

- The hidden input carries the full value plus `name` / `form` / `disabled`;
  its `defaultValue` tracks `default-value` (uncontrolled) or the current
  value (controlled).
- Form `reset` restores `default-value` in uncontrolled mode; controlled
  codes ignore reset.

### Errors

- `TypeError` when `length` is missing, zero, negative, or non-integer.
- `TypeError` for invalid `validation-type` or non-function callbacks.
