<svelte:options customElement={{ tag: "svelte-popover", shadow: "none", extend: extendElement }} />

<script module lang="ts">
  import { SveltePopoverElement } from "./popover";

  function extendElement(): CustomElementConstructor {
    return SveltePopoverElement;
  }
</script>
