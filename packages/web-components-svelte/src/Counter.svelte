<svelte:options
  customElement={{
    tag: "svelte-counter",
    shadow: "none",
    props: {
      defaultValue: { attribute: "default-value" },
      value: { attribute: "value" },
      onChange: {},
    },
    extend: extendCounter,
  }}
/>

<script module lang="ts">
  const MINUS_TAG = "svelte-counter-minus-button";
  const LABEL_TAG = "svelte-counter-label";
  const PLUS_TAG = "svelte-counter-plus-button";
  const VALUE_INPUT_EVENT = "svelte-counter-value-input";

  function extendCounter(
    customElementConstructor: CustomElementConstructor,
  ): CustomElementConstructor {
    const valueDescriptor = Object.getOwnPropertyDescriptor(
      customElementConstructor.prototype,
      "value",
    );
    const defaultValueDescriptor = Object.getOwnPropertyDescriptor(
      customElementConstructor.prototype,
      "defaultValue",
    );
    const attributeChanged = (
      customElementConstructor.prototype as HTMLElement & {
        attributeChangedCallback(
          name: string,
          oldValue: string | null,
          newValue: string | null,
        ): void;
      }
    ).attributeChangedCallback;

    return class extends customElementConstructor {
      get defaultValue(): unknown {
        return defaultValueDescriptor?.get?.call(this);
      }

      set defaultValue(next: unknown) {
        defaultValueDescriptor?.set?.call(this, parseCounterValue(next));
      }

      get value(): unknown {
        return valueDescriptor?.get?.call(this);
      }

      set value(next: unknown) {
        const parsed = parseCounterValue(next);
        valueDescriptor?.set?.call(this, parsed);
        this.dispatchEvent(
          new CustomEvent(VALUE_INPUT_EVENT, { detail: parsed }),
        );
      }

      attributeChangedCallback(
        name: string,
        oldValue: string | null,
        newValue: string | null,
      ): void {
        attributeChanged.call(this, name, oldValue, newValue);
        if (name === "default-value") {
          defaultValueDescriptor?.set?.call(
            this,
            parseCounterValue(newValue),
          );
        } else if (name === "value") {
          const parsed = parseCounterValue(newValue);
          valueDescriptor?.set?.call(this, parsed);
          this.dispatchEvent(
            new CustomEvent(VALUE_INPUT_EVENT, { detail: parsed }),
          );
        }
      }
    };
  }

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

  type CounterProps = {
    defaultValue?: unknown;
    value?: unknown;
    onChange?: ((value: number) => void) | null;
  };

  type CounterHost = HTMLElement & {
    value: unknown;
  };

  let {
    defaultValue = 0,
    value = undefined,
    onChange = null,
  }: CounterProps = $props();

  const element = $host() as CounterHost;
  const initialValue = untrack(() => value);
  const initialDefaultValue = untrack(() => defaultValue);
  let controlled =
    element.hasAttribute("value") || initialValue !== undefined;
  const initialCount = parseCounterValue(
    controlled ? initialValue : initialDefaultValue,
  );
  let count = $state(initialCount);
  defaultValue = parseCounterValue(initialDefaultValue);

  // Keep the public getter aligned with the rendered count without reflecting an attribute.
  value = initialCount;

  function publishValue(next: number): void {
    value = next;
  }

  function syncLabel(): void {
    // Re-query because children can arrive or upgrade after their parent connects.
    element.querySelector(LABEL_TAG)?.setAttribute("value", String(count));
  }

  function commit(next: number): void {
    if (!controlled) {
      count = next;
      publishValue(next);
    }

    if (typeof onChange === "function") {
      onChange(next);
    }
    element.dispatchEvent(
      new CustomEvent("change", {
        bubbles: true,
        composed: true,
        detail: { value: next },
      }),
    );
  }

  function handleClick(event: Event): void {
    const target = event.target;
    const origin =
      target instanceof Element
        ? target.closest(`${MINUS_TAG},${PLUS_TAG}`)
        : null;
    if (!origin || !element.contains(origin)) {
      return;
    }

    const delta = origin.tagName.toLowerCase() === PLUS_TAG ? 1 : -1;
    commit(count + delta);
  }

  function handleValueInput(event: Event): void {
    controlled = true;
    count = parseCounterValue((event as CustomEvent<unknown>).detail);
    publishValue(count);
  }

  $effect(() => {
    void count;
    syncLabel();
  });

  // Attach-once wiring: runs as an effect because onMount never fires for
  // light-DOM custom elements under some DOM implementations. No reactive
  // state is read here, so this runs once with cleanup on destroy.
  $effect(() => {
    element.addEventListener("click", handleClick);
    element.addEventListener(VALUE_INPUT_EVENT, handleValueInput);

    // Parser-created children can connect after the controller, including nested content.
    const observer = new MutationObserver(syncLabel);
    observer.observe(element, { childList: true, subtree: true });
    untrack(() => syncLabel());

    return () => {
      element.removeEventListener("click", handleClick);
      element.removeEventListener(VALUE_INPUT_EVENT, handleValueInput);
      observer.disconnect();
    };
  });
</script>
