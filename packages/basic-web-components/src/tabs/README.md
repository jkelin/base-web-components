# bwc-tabs

A tabbed interface: a button list plus matched panels, one visible at a
time. Use it for settings pages, multi-view panels, or wizard steps where
only one view shows.

```js
import "basic-web-components/tabs";
```

## Usage

Uncontrolled, preselecting the second tab:

```html
<bwc-tabs>
  <div slot="list">
    <button value="first">First</button>
    <button value="second">Second</button>
  </div>
  <section slot="panel" data-value="first">First panel</section>
  <section slot="panel" data-value="second">Second panel</section>
</bwc-tabs>
```

With `default-value` and manual activation (focus moves without selecting;
`Enter`/`Space` selects):

```html
<bwc-tabs id="t" activation-mode="manual" orientation="vertical">
  <div slot="list">
    <button value="first">First</button>
    <button value="second">Second</button>
  </div>
  <section slot="panel" data-value="first">First panel</section>
  <section slot="panel" data-value="second">Second panel</section>
</bwc-tabs>
<script>
  const t = document.getElementById("t");
  t.defaultValue = "second";
  t.onValueChange = (v) => {
    t.value = v;
  }; // then it is controlled
</script>
```

Uncontrolled tabs default to `default-value`, else the first enabled button.

## API

### Properties / attributes

| Property         | Attribute         | Type                                | Default        | Notes                                                                                          |
| ---------------- | ----------------- | ----------------------------------- | -------------- | ---------------------------------------------------------------------------------------------- |
| `value`          | `value`           | `string`                            | `""`           | Present (or assigned) → controlled mode. Setting empty throws.                                 |
| `defaultValue`   | `default-value`   | `string`                            | `""`           | Preferred initial tab (uncontrolled).                                                          |
| `orientation`    | `orientation`     | `"horizontal" \| "vertical"`        | `"horizontal"` | Arrow-key axis + `aria-orientation`. Invalid values throw.                                     |
| `activationMode` | `activation-mode` | `"automatic" \| "manual"`           | `"automatic"`  | `automatic` selects on focus; `manual` selects on click/`Enter`/`Space`. Invalid values throw. |
| `disabled`       | `disabled`        | `boolean`                           | `false`        | Disables every tab.                                                                            |
| `onValueChange`  | — (property only) | `((value: string) => void) \| null` | `null`         | Must be a function or null.                                                                    |

### Events

| Name           | Detail              | Bubbles / composed |
| -------------- | ------------------- | ------------------ |
| `value-change` | `{ value: string }` | yes / yes          |

Callback fires before the event. Clicking the already-selected tab (in
uncontrolled mode), or a disabled tab, emits nothing. In controlled mode the
selection only changes when you update `value`.

### Slots

| Slot    | Required element  | Contract                                                                                                     |
| ------- | ----------------- | ------------------------------------------------------------------------------------------------------------ |
| `list`  | exactly one `div` | Direct `button` children, each with a unique nonempty `value`. Per-button `disabled` disables that tab only. |
| `panel` | one per tab       | Each a `section` with unique nonempty `data-value`; button and panel values must match 1:1.                  |

Violations throw `TypeError`: `tabs panels must be section elements`, `tab
and panel values must be unique and nonempty`, or `tabs require matched
button and panel values`. Renaming a button's `value` in uncontrolled mode
follows the selection.

### Accessibility

- List gets `role="tablist"` (+ `aria-orientation`); buttons `role="tab"`,
  `type="button"`, `aria-selected`, `aria-controls` → panel id; panels
  `role="tabpanel"`, `aria-labelledby` → button id (ids auto-generated).
- Roving `tabindex` (active `0`, rest `-1`); inactive panels are `hidden`.
- Keyboard: arrows along the orientation axis move focus (skipping disabled),
  `Home`/`End` jump; `data-active` / `data-inactive` / `data-disabled` mirror
  state on buttons and panels; disabled buttons use the `not-allowed` cursor.

### Form behavior

None.

### Errors

- `TypeError` for slot/value contract violations listed above, empty
  controlled `value`, invalid `orientation` / `activation-mode`, or
  non-function `onValueChange`.
