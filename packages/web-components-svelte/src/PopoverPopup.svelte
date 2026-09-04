<svelte:options customElement={{ tag: "svelte-popover-popup", shadow: "none", extend: extendElement }} />

<script module lang="ts">
  import { SveltePopoverPopupElement } from "./popover";

  function extendElement(): CustomElementConstructor {
    return SveltePopoverPopupElement;
  }
</script>
