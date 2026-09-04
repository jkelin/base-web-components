<svelte:options customElement={{ tag: "svelte-popover-trigger", shadow: "none", extend: extendElement }} />

<script module lang="ts">
  import { SveltePopoverTriggerElement } from "./popover";

  function extendElement(): CustomElementConstructor {
    return SveltePopoverTriggerElement;
  }
</script>
