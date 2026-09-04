<svelte:options customElement={{ tag: "svelte-modal-close", shadow: "none", extend: extendElement }} />

<script module lang="ts">
  import { SvelteModalCloseElement } from "./modal";

  function extendElement(): CustomElementConstructor {
    return SvelteModalCloseElement;
  }
</script>
