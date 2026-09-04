<svelte:options customElement={{ tag: "svelte-accordion-trigger", shadow: "none", extend: extendElement }} />

<script module lang="ts">
  import { SvelteAccordionTriggerElement } from "./accordion";

  function extendElement(): CustomElementConstructor {
    return SvelteAccordionTriggerElement;
  }
</script>
