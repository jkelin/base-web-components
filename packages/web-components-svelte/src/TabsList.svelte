<svelte:options customElement={{ tag: "svelte-tabs-list", shadow: "none", extend: extendElement }} />

<script module lang="ts">
  import { SvelteTabsListElement } from "./tabs";

  function extendElement(): CustomElementConstructor {
    return SvelteTabsListElement;
  }
</script>
