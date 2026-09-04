<svelte:options customElement={{ tag: "svelte-otp-field", shadow: "none", extend: extendElement }} />

<script module lang="ts">
  import { SvelteOtpFieldElement } from "./otp-field";

  function extendElement(): CustomElementConstructor {
    return SvelteOtpFieldElement;
  }
</script>
