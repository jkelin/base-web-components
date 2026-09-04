<svelte:options
  customElement={{
    tag: "svelte-counter-label",
    shadow: "none",
    props: { value: { attribute: "value" } },
  }}
/>

<script module lang="ts">
  const COUNTER_TAG = "svelte-counter";

  // Empty strings coerce to zero; non-finite values and non-number objects also become zero.
  function parseCounterValue(raw: unknown): number {
    const numeric =
      typeof raw === "number"
        ? raw
        : Number(typeof raw === "string" ? raw.trim() : Number.NaN);
    return Number.isFinite(numeric) ? Math.trunc(numeric) : 0;
  }
</script>

<script lang="ts">
  import { untrack } from "svelte";

  let {
    value = 0,
    class: hostClass = "",
  }: { value?: unknown; class?: string } = $props();

  const element = $host();
  const initialValue = untrack(() => value);
  let renderedValue = $state(parseCounterValue(initialValue));
  // `class` arrives via props once; later host edits need an observer.
  let liveClass = $state(untrack(() => hostClass));
  const classes = $derived(
    liveClass ? `counter-label ${liveClass}` : "counter-label",
  );

  $effect(() => {
    renderedValue = parseCounterValue(value);
  });

  // Attach-once wiring: runs as an effect because onMount never fires for
  // light-DOM custom elements under some DOM implementations.
  $effect(() => {
    const owner = element.closest(COUNTER_TAG) as
      | (HTMLElement & { value?: unknown })
      | null;
    // An upgraded owner is authoritative; otherwise the parent's value attribute wins later.
    renderedValue = parseCounterValue(owner?.value ?? untrack(() => value));
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

<span
  aria-live="polite"
  data-testid="svelte-counter-label"
  class={classes}
>{renderedValue}</span>
