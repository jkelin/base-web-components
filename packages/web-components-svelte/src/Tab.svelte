<svelte:options customElement={{ tag: "svelte-tab", shadow: "none", extend: extendElement }} />

<script module lang="ts">
  import { SvelteTabElement } from "./tabs";

  function extendElement(): CustomElementConstructor {
    return SvelteTabElement;
  }
</script>
