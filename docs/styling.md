# Styling

Style `basic-web-components` two ways: style the default theme with CSS
variables, or skip it and use Tailwind and direct styling. Pick one per
project — they compose, but you never need both.

## Option 1 — Optional default CSS with variables

Import the theme stylesheet and every component is themed — no classes
needed. Ten `--bwc-*` variables skin selectors rooted at the component
hosts; override any of them from your own CSS. Without the import the
library stays unstyled and composes with Tailwind (or anything else)
directly.

```css
/* One import: light defaults plus .dark overrides. */
@import "basic-web-components/theme.css";

:root {
  --bwc-primary: #4f46e5;
  --bwc-radius: 0.75rem;
}
```

```html
<bwc-modal>
  <button slot="trigger">Open</button>
  <dialog slot="popup">
    <p>Confirm?</p>
    <button data-close>Close</button>
  </dialog>
</bwc-modal>
<bwc-otp length="4"></bwc-otp>
<bwc-switch aria-label="Notifications"></bwc-switch>
```

| Variable                   | Default (light) | Dark      | Used by                                                           |
| -------------------------- | --------------- | --------- | ----------------------------------------------------------------- |
| `--bwc-background`         | `#ffffff`       | `#09090b` | Dialog, popup, drawer, disclosure, tab panel + field fill         |
| `--bwc-foreground`         | `#09090b`       | `#fafafa` | Default text                                                      |
| `--bwc-primary`            | `#18181b`       | `#fafafa` | Primary trigger fill, switch-on track, tab indicator, focus rings |
| `--bwc-primary-foreground` | `#fafafa`       | `#18181b` | Text on the primary fill + switch thumb when on                   |
| `--bwc-secondary`          | `#f4f4f5`       | `#27272a` | Secondary close-button fill + switch track when off               |
| `--bwc-muted`              | `#71717a`       | `#a1a1aa` | Subdued text, disclosure panels, idle tabs, thumb                 |
| `--bwc-accent`             | `#e4e4e7`       | `#3f3f46` | Hover/focus highlight                                             |
| `--bwc-border`             | `#e4e4e7`       | `#27272a` | Hairline borders                                                  |
| `--bwc-radius`             | `0.5rem`        | —         | Corner radius everywhere                                          |
| `--bwc-font-size`          | `0.875rem`      | —         | Font size everywhere                                              |

Dark mode follows the `.dark` class on `<html>` (same toggle as this
site). Sizing variables are mode-independent, so `.dark` leaves them
alone.

### Opting out with `data-bwc-unstyled`

Every theme selector skips `data-bwc-unstyled` elements, so a Tailwind-styled
page can mix the theme with its own controls: put the attribute on any themed
element to leave exactly that element alone, or on the slotted element to
skip its whole subtree rule (e.g. a slide-out panel and its links).

```html
<bwc-popover>
  <button slot="trigger" data-bwc-unstyled class="...">Custom</button>
</bwc-popover>
```

Exclusion (rather than lower-specificity selectors) is deliberate: the
theme's host+attribute selectors already beat single-class utilities, and as
unlayered CSS the theme also beats layered Tailwind output at any
specificity — only opting out is deterministic under any import order.

## Option 2 — Tailwind / direct styling

Skip the stylesheet and style the light-DOM children directly. Slotted
children are plain native elements, so any method works — Tailwind
utilities in `class`, generated part props (`button-class`,
`thumb-class`, `field-class`, `trigger-class`, `popup-class`), or your
own CSS. The examples on this site use Option 1 instead, so the theme
configurator re-skins every demo.

```html
<script type="module">
  import "basic-web-components/switch";
</script>

<bwc-switch
  aria-label="Notifications"
  button-class="flex h-7 w-12 items-center rounded-full border px-0.5 data-[checked]:bg-emerald-600"
  thumb-class="size-5 rounded-full bg-stone-400 data-[checked]:translate-x-[22px] data-[checked]:bg-white"
></bwc-switch>
```

Part-class strings are scanned at build time, so Tailwind picks up the
utilities. Prefer this option when you already have a design system —
the components bring behavior, you bring the look.
