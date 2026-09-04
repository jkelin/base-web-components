<svelte:options customElement={{ tag: "svelte-tab-panel", shadow: "none", extend: extendElement }} />

<script module lang="ts">
  import { SvelteTabPanelElement } from "./tabs";

  function extendElement(): CustomElementConstructor {
    return SvelteTabPanelElement;
  }
</script>
