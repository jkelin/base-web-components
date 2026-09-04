<svelte:options customElement={{ tag: "svelte-toggle-checkbox", shadow: "none", extend: extendElement }} />

<script module lang="ts">
  import { SvelteToggleCheckboxElement } from "./toggle-checkbox";

  function extendElement(): CustomElementConstructor {
    return SvelteToggleCheckboxElement;
  }
</script>
