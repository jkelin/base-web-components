# bwc-accordion

A collapsible section list built on native `<details>` elements. Use it for
FAQs, settings groups, or any stacked disclosures where at most one (or, with
`multiple`, several) panels stay open.

```js
import "basic-web-components/accordion";
```

## Usage

Uncontrolled single-open, seeded by `default-value` (a JSON string array):

```html
<bwc-accordion default-value='["two"]'>
  <details slot="item" data-value="one">
    <summary>One</summary>
    <div>One content</div>
  </details>
  <details slot="item" data-value="two">
    <summary>Two</summary>
    <div>Two content</div>
  </details>
</bwc-accordion>
```

Controlled multi-open:

```html
<bwc-accordion id="acc" multiple>
  <details slot="item" data-value="one">
    <summary>One</summary>
    <div>One content</div>
  </details>
  <details slot="item" data-value="two">
    <summary>Two</summary>
    <div>Two content</div>
  </details>
</bwc-accordion>
<script>
  const acc = document.getElementById("acc");
  acc.value = ["one"];
  acc.onValueChange = (next) => {
    acc.value = next;
  };
</script>
```

## API

### Properties / attributes

| Property        | Attribute         | Type                                  | Default | Notes                       |
| --------------- | ----------------- | ------------------------------------- | ------- | --------------------------- |
| `value`         | `value`           | `string[]` (JSON in attribute)        | `[]`    | Present → controlled mode.  |
| `defaultValue`  | `default-value`   | `string[]` (JSON in attribute)        | `[]`    | Seed for uncontrolled mode. |
| `multiple`      | `multiple`        | `boolean`                             | `false` | Allow several open panels.  |
| `disabled`      | `disabled`        | `boolean`                             | `false` | Locks every item.           |
| `onValueChange` | — (property only) | `((value: string[]) => void) \| null` | `null`  | Must be a function or null. |

Setting `value` to more than one entry without `multiple` throws
`TypeError`. Malformed JSON or non-string/empty array entries throw
`TypeError` (`"<name> must be a JSON string array"`).

### Events

| Name           | Detail                | Bubbles / composed |
| -------------- | --------------------- | ------------------ |
| `value-change` | `{ value: string[] }` | yes / yes          |

Callback fires before the event. In controlled mode the clicked panel's open
state is reverted until you apply the new `value`.

### Slots

| Slot   | Required element        | Item contract                                                                                                                  |
| ------ | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `item` | `details` (one or more) | Each needs a unique, nonempty `data-value`, one direct `<summary>` child (the title) and one direct `<div>` child (the panel). |

Violations throw `TypeError`: `accordion item values must be unique and
nonempty`, or `accordion items require a direct summary and div`.

### Accessibility

- Each summary gets `aria-controls` → panel id; each panel gets `role="region"`
  and `aria-labelledby` → summary id (ids auto-generated when missing).
- Summaries carry `aria-disabled`; open/closed/disabled state is mirrored as
  `data-open` / `data-closed` / `data-disabled` on details, summary, and panel
  (plus `data-disabled` on the host). Disabled summaries use the
  `not-allowed` cursor, otherwise `pointer`.
- A per-item `disabled` attribute on a `<details>` disables that item only.

### Form behavior

None.

### Errors

- `TypeError` for duplicate/empty item values, missing summary/div, or
  multiple values in single mode.
- `TypeError` for malformed `value` / `default-value` JSON.
