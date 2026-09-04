<svelte:options customElement={{ tag: "svelte-tabs", shadow: "none", extend: extendElement }} />

<script module lang="ts">
  import { SvelteTabsElement } from "./tabs";

  function extendElement(): CustomElementConstructor {
    return SvelteTabsElement;
  }
</script>
