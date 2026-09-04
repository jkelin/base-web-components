<svelte:options customElement={{ tag: "svelte-modal", shadow: "none", extend: extendElement }} />

<script module lang="ts">
  import { SvelteModalElement } from "./modal";

  function extendElement(): CustomElementConstructor {
    return SvelteModalElement;
  }
</script>
