export const PREACT_COUNTER_TAG = "preact-counter";
export const PREACT_COUNTER_MINUS_TAG = "preact-counter-minus-button";
export const PREACT_COUNTER_LABEL_TAG = "preact-counter-label";
export const PREACT_COUNTER_PLUS_TAG = "preact-counter-plus-button";

/** Lenient numeric coercion: non-finite and non-numeric inputs become 0. */
export function parseCounterValue(raw: unknown): number {
  const number =
    typeof raw === "number" ? raw : Number(typeof raw === "string" ? raw.trim() : Number.NaN);

  return Number.isFinite(number) ? Math.trunc(number) : 0;
}

/** Light-DOM controller for the three composed counter children. */
export class PreactCounterElement extends HTMLElement {
  static observedAttributes = ["value"];

  onChange: ((value: number) => void) | null = null;

  #count = 0;
  #controlled = false;
  #assignedValue: number | undefined;
  #assignedDefault: number | undefined;
  #observer: MutationObserver | null = null;

  get defaultValue(): number {
    return this.#assignedDefault ?? parseCounterValue(this.getAttribute("default-value"));
  }

  set defaultValue(next: number) {
    // Defaults are initial state: changing one affects the next connection only.
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

  connectedCallback(): void {
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
    // Parser-created children can connect after their parent, so additions retry label sync.
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
    const origin = target?.closest?.(`${PREACT_COUNTER_MINUS_TAG},${PREACT_COUNTER_PLUS_TAG}`);

    if (!origin || !this.contains(origin)) {
      return;
    }

    const delta = origin.tagName.toLowerCase() === PREACT_COUNTER_PLUS_TAG ? 1 : -1;
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
    // Re-query because a label can be inserted or upgraded after the controller.
    this.querySelector(PREACT_COUNTER_LABEL_TAG)?.setAttribute("value", String(this.#count));
  }
}

if (!customElements.get(PREACT_COUNTER_TAG)) {
  customElements.define(PREACT_COUNTER_TAG, PreactCounterElement);
}
