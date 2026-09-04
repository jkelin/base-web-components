<svelte:options
  customElement={{ tag: "svelte-counter-plus-button", shadow: "none" }}
/>

<script lang="ts">
  import { untrack } from "svelte";

  let { class: hostClass = "" }: { class?: string } = $props();

  const element = $host();
  // `class` arrives via props once; later host edits need an observer.
  let liveClass = $state(untrack(() => hostClass));
  const classes = $derived(
    liveClass
      ? `counter-plus-button ${liveClass}`
      : "counter-plus-button",
  );

  // Attach-once wiring: runs as an effect because onMount never fires for
  // light-DOM custom elements under some DOM implementations.
  $effect(() => {
    liveClass = element.getAttribute("class") ?? "";
    const observer = new MutationObserver(() => {
      liveClass = element.getAttribute("class") ?? "";
    });
    observer.observe(element, {
      attributes: true,
      attributeFilter: ["class"],
    });
    return () => observer.disconnect();
  });
</script>

<button
  type="button"
  aria-label="Increment count"
  data-testid="svelte-counter-plus-button"
  class={classes}
  style="cursor: pointer; user-select: none"
>+</button>
