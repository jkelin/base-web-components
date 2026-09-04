<svelte:options customElement={{ tag: "svelte-accordion", shadow: "none", extend: extendElement }} />

<script module lang="ts">
  import { SvelteAccordionElement } from "./accordion";

  function extendElement(): CustomElementConstructor {
    return SvelteAccordionElement;
  }
</script>
