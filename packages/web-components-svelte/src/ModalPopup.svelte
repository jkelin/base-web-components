<svelte:options customElement={{ tag: "svelte-modal-popup", shadow: "none", extend: extendElement }} />

<script module lang="ts">
  import { SvelteModalPopupElement } from "./modal";

  function extendElement(): CustomElementConstructor {
    return SvelteModalPopupElement;
  }
</script>
