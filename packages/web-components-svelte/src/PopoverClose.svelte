<svelte:options customElement={{ tag: "svelte-popover-close", shadow: "none", extend: extendElement }} />

<script module lang="ts">
  import { SveltePopoverCloseElement } from "./popover";

  function extendElement(): CustomElementConstructor {
    return SveltePopoverCloseElement;
  }
</script>
