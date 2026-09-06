# bwc-counter

A numeric stepper: two buttons around a live readout. Use it wherever a
small integer is adjusted in place (quantity pickers, settings) instead of
hand-wiring two buttons and a label.

```js
import "basic-web-components/counter";
```

## Usage

Uncontrolled (component owns the count, seeded by `default-value`):

```html
<bwc-counter default-value="2">
  <button slot="decrement">−</button>
  <output slot="value"></output>
  <button slot="increment">+</button>
</bwc-counter>
```

Controlled (you own the count via `value` + `change`):

```html
<bwc-counter id="qty" value="2">
  <button slot="decrement">−</button>
  <output slot="value"></output>
  <button slot="increment">+</button>
</bwc-counter>
<script>
  const qty = document.getElementById("qty");
  qty.onChange = (next) => qty.setAttribute("value", String(next));
</script>
```

In controlled mode clicks emit `change` but do not mutate state; removing
the `value` attribute resets the count to `0`. Non-finite values parse to
`0`; fractional values are truncated.

## API

### Properties / attributes

| Property       | Attribute         | Type                                | Default | Notes                       |
| -------------- | ----------------- | ----------------------------------- | ------- | --------------------------- |
| `value`        | `value`           | `number`                            | `0`     | Present → controlled mode.  |
| `defaultValue` | `default-value`   | `number`                            | `0`     | Seed for uncontrolled mode. |
| `onChange`     | — (property only) | `((value: number) => void) \| null` | `null`  | Must be a function or null. |

### Events

| Name     | Detail              | Bubbles / composed |
| -------- | ------------------- | ------------------ |
| `change` | `{ value: number }` | yes / yes          |

The `onChange` callback fires first, then the `change` event, on every
increment/decrement click.

### Slots (all required, exactly one each)

| Slot        | Required element |
| ----------- | ---------------- |
| `decrement` | `button`         |
| `value`     | `output`         |
| `increment` | `button`         |

Missing, duplicated, wrong-type, or wrapper-nested-only children throw
`TypeError` on connect. The component sets `aria-label="Decrement count"` /
`"Increment count"` on the buttons, `aria-live="polite"` on the output, and
writes the count as the output's text. Author `class` values are preserved;
the output gains a `counter-label` marker class and buttons gain
`counter-minus-button` / `counter-plus-button` marker classes plus stable
`data-testid`s (`bwc-counter-minus-button`, `bwc-counter-label`,
`bwc-counter-plus-button`). A disabled authored button keeps the
`not-allowed` cursor.

### Accessibility

- Buttons carry `aria-label`s; the readout is a polite live region.
- Replacing a slotted control rebinds automatically; the old listener is
  dropped.

### Form behavior

None — the value is not submitted with forms.

### Errors

- `TypeError` when slot topology is invalid (missing/duplicate/wrong-type).
- `TypeError` when `onChange` is set to a non-function, non-null value.
