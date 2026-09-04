import { c, useEffect, useHost, useState } from "atomico";

export const ATOMICO_COUNTER_TAG = "atomico-counter";
export const ATOMICO_COUNTER_MINUS_TAG = "atomico-counter-minus-button";
export const ATOMICO_COUNTER_LABEL_TAG = "atomico-counter-label";
export const ATOMICO_COUNTER_PLUS_TAG = "atomico-counter-plus-button";

type CountSetter = (next: number | ((current: number) => number)) => void;

/** Empty strings become 0; non-finite and non-numeric inputs also become 0. */
export function parseCounterValue(raw: unknown): number {
  const value =
    typeof raw === "number" ? raw : Number(typeof raw === "string" ? raw.trim() : Number.NaN);
  return Number.isFinite(value) ? Math.trunc(value) : 0;
}

// The empty host preserves author-composed children; all controller work is imperative.
function Counter() {
  const host = useHost<AtomicoCounterElement>();
  const [count, setCount] = useState(() => host.current.initialCount());

  host.current.bindCount(count, setCount);

  // Reconnection replaces the observer and listener instead of duplicating either.
  useEffect(() => host.current.connectCounter(), []);
  useEffect(() => host.current.syncLabel(), [count]);

  return <host />;
}

const AtomicoCounterBase = c(Counter);

/** Functional Atomico controller with the public compound-counter properties. */
export class AtomicoCounterElement extends AtomicoCounterBase {
  static get observedAttributes(): string[] {
    return ["value"];
  }

  onChange: ((value: number) => void) | null = null;

  #assignedDefault: number | undefined;
  #assignedValue: number | undefined;
  #controlled = false;
  #count = 0;
  #observer: MutationObserver | null = null;
  #setCount: CountSetter | null = null;

  get defaultValue(): number {
    return this.#assignedDefault ?? parseCounterValue(this.getAttribute("default-value"));
  }

  set defaultValue(next: number) {
    // Defaults are read on connection; changing one does not reset a live counter.
    this.#assignedDefault = parseCounterValue(next);
  }

  get value(): number {
    return this.#count;
  }

  set value(next: number) {
    this.#controlled = true;
    this.#assignedValue = parseCounterValue(next);
    this.setAttribute("value", String(this.#assignedValue));
  }

  // Before the first Atomico cycle, attributes and pre-upgrade properties are authoritative.
  initialCount(): number {
    if (this.hasAttribute("value")) {
      this.#controlled = true;
      this.#count = parseCounterValue(this.getAttribute("value"));
    } else if (this.#assignedValue !== undefined) {
      this.#controlled = true;
      this.#count = this.#assignedValue;
      this.setAttribute("value", String(this.#count));
    } else {
      this.#count = this.defaultValue;
    }

    return this.#count;
  }

  // Rendering refreshes this bridge so delegated clicks never close over stale state.
  bindCount(count: number, setCount: CountSetter): void {
    this.#count = count;
    this.#setCount = setCount;
  }

  // Parser insertion can attach children after this component's first render.
  connectCounter(): () => void {
    const connectedCount = this.initialCount();
    this.#setCount?.(connectedCount);

    this.addEventListener("click", this.#onClick);
    this.#observer?.disconnect();
    this.#observer = new MutationObserver(() => this.syncLabel());
    this.#observer.observe(this, { childList: true, subtree: true });
    this.syncLabel();

    return () => {
      this.removeEventListener("click", this.#onClick);
      this.#observer?.disconnect();
      this.#observer = null;
    };
  }

  // The label is re-queried because it may arrive or upgrade after the parent.
  syncLabel(): void {
    this.querySelector(ATOMICO_COUNTER_LABEL_TAG)?.setAttribute("value", String(this.#count));
  }

  attributeChangedCallback(name: string, _oldValue: string | null, nextValue: string | null): void {
    // External writes are render-only: they never emit callback or DOM events.
    if (name !== "value" || !this.isConnected) {
      return;
    }

    this.#controlled = true;
    this.#count = parseCounterValue(nextValue);
    this.#setCount?.(this.#count);
  }

  #onClick = (event: Event): void => {
    const target = event.target as HTMLElement | null;
    const origin = target?.closest?.(`${ATOMICO_COUNTER_MINUS_TAG},${ATOMICO_COUNTER_PLUS_TAG}`);
    if (!origin || !this.contains(origin)) {
      return;
    }

    const delta = origin.tagName.toLowerCase() === ATOMICO_COUNTER_PLUS_TAG ? 1 : -1;
    this.#commit(this.#count + delta);
  };

  #commit(next: number): void {
    if (!this.#controlled) {
      this.#count = next;
      this.#setCount?.(next);
    }

    this.onChange?.(next);
    this.dispatchEvent(
      new CustomEvent("change", {
        bubbles: true,
        composed: true,
        detail: { value: next },
      }),
    );
  }
}
