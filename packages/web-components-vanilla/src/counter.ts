export const VANILLA_COUNTER_TAG = "vanilla-counter";
export const VANILLA_COUNTER_MINUS_TAG = "vanilla-counter-minus-button";
export const VANILLA_COUNTER_LABEL_TAG = "vanilla-counter-label";
export const VANILLA_COUNTER_PLUS_TAG = "vanilla-counter-plus-button";

/** Lenient numeric coercion: anything non-finite becomes 0. */
export function parseCounterValue(raw: unknown): number {
  const n =
    typeof raw === "number" ? raw : Number(typeof raw === "string" ? raw.trim() : Number.NaN);
  return Number.isFinite(n) ? Math.trunc(n) : 0;
}

/**
 * State controller with no shadow DOM and no visuals: it wires the three
 * child elements by tag name, so authors compose the visible counter.
 *
 * Uncontrolled by default (initial count from `defaultValue`); assigning the
 * `value` property or `value` attribute switches to controlled mode, where
 * clicks notify but only an external `value` set re-renders.
 */
export class VanillaCounterElement extends HTMLElement {
  static observedAttributes = ["value"];

  onChange: ((value: number) => void) | null = null;

  #count = 0;
  #controlled = false;
  #assignedValue: number | undefined;
  #assignedDefault: number | undefined;

  get defaultValue(): number {
    return this.#assignedDefault ?? parseCounterValue(this.getAttribute("default-value"));
  }

  set defaultValue(next: number) {
    // Read once at connect; later sets only affect future reconnects.
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

  get #label(): Element | null {
    // Re-queried every render: the label may upgrade or arrive after the parent.
    return this.querySelector(VANILLA_COUNTER_LABEL_TAG);
  }
  #observer: MutationObserver | null = null;

  connectedCallback(): void {
    // Children may still be unresolved (the parser connects parents first);
    // attribute-based sync keeps every upgrade order correct.
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
    this.addEventListener("click", this.#onClick);
    // Children usually attach after the parent connects, so re-render
    // whenever the subtree gains elements (attribute sets never trigger this).
    this.#observer = new MutationObserver(() => this.#render());
    this.#observer.observe(this, { childList: true, subtree: true });
    this.#render();
  }

  disconnectedCallback(): void {
    this.removeEventListener("click", this.#onClick);
    this.#observer?.disconnect();
    this.#observer = null;
  }
  attributeChangedCallback(name: string, _old: string | null, next: string | null): void {
    // External sets render without notifying, so controlled loops cannot echo.
    if (name !== "value" || !this.isConnected) {
      return;
    }
    const parsed = parseCounterValue(next);
    if (parsed !== this.#count) {
      this.#controlled = true;
      this.#count = parsed;
      this.#render();
    }
  }

  #onClick = (event: Event): void => {
    const target = event.target as HTMLElement | null;
    const origin = target?.closest?.(`${VANILLA_COUNTER_MINUS_TAG},${VANILLA_COUNTER_PLUS_TAG}`);
    if (!origin || !this.contains(origin)) {
      return;
    }
    const delta = origin.tagName.toLowerCase() === VANILLA_COUNTER_PLUS_TAG ? 1 : -1;
    this.#commit(this.#count + delta);
  };

  #commit(next: number): void {
    if (!this.#controlled) {
      this.#count = next;
      this.#render();
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

  #render(): void {
    this.#label?.setAttribute("value", String(this.#count));
  }
}

if (!customElements.get(VANILLA_COUNTER_TAG)) {
  customElements.define(VANILLA_COUNTER_TAG, VanillaCounterElement);
}
