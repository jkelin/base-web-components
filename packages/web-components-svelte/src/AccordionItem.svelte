<svelte:options customElement={{ tag: "svelte-accordion-item", shadow: "none", extend: extendElement }} />

<script module lang="ts">
  import { SvelteAccordionItemElement } from "./accordion";

  function extendElement(): CustomElementConstructor {
    return SvelteAccordionItemElement;
  }
</script>
