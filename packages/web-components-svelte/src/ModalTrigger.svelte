<svelte:options customElement={{ tag: "svelte-modal-trigger", shadow: "none", extend: extendElement }} />

<script module lang="ts">
  import { SvelteModalTriggerElement } from "./modal";

  function extendElement(): CustomElementConstructor {
    return SvelteModalTriggerElement;
  }
</script>
