<svelte:options customElement={{ tag: "svelte-accordion-panel", shadow: "none", extend: extendElement }} />

<script module lang="ts">
  import { SvelteAccordionPanelElement } from "./accordion";

  function extendElement(): CustomElementConstructor {
    return SvelteAccordionPanelElement;
  }
</script>
