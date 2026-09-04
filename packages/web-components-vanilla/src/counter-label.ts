import {
  VANILLA_COUNTER_LABEL_TAG,
  VANILLA_COUNTER_TAG,
  VanillaCounterElement,
  parseCounterValue,
} from "./counter";

/**
 * Light-DOM label: renders `<span>` as a direct child so page stylesheets
 * (e.g. Tailwind utilities) apply without shadow piercing. The host `class`
 * is forwarded to the span after a stable `counter-label` marker class.
 * Syncs from the `value` attribute, which the parent sets.
 */
export class VanillaCounterLabelElement extends HTMLElement {
  static observedAttributes = ["value", "class"];

  #value = 0;

  get value(): number {
    return this.#value;
  }

  set value(next: number) {
    this.setAttribute("value", String(parseCounterValue(next)));
  }

  get #span(): HTMLSpanElement | null {
    return this.querySelector(":scope > span");
  }

  connectedCallback(): void {
    if (!this.#span) {
      const span = document.createElement("span");
      span.setAttribute("aria-live", "polite");
      span.dataset.testid = VANILLA_COUNTER_LABEL_TAG;
      this.append(span);
    }
    // Fast path: an already-connected parent owns the count (it connects first).
    // Otherwise render from the attribute, which a later parent sync will set.
    const owner = this.closest(VANILLA_COUNTER_TAG);
    this.#sync(
      owner instanceof VanillaCounterElement
        ? owner.value
        : parseCounterValue(this.getAttribute("value")),
    );
    this.#syncClass();
  }

  attributeChangedCallback(name: string): void {
    if (name === "class") {
      this.#syncClass();
    } else {
      this.#sync(parseCounterValue(this.getAttribute("value")));
    }
  }

  #sync(next: number): void {
    this.#value = next;
    const span = this.#span;
    if (span && span.textContent !== String(next)) {
      span.textContent = String(next);
    }
  }

  #syncClass(): void {
    const span = this.#span;
    if (!span) {
      return;
    }
    const forwarded = this.getAttribute("class") ?? "";
    span.className = forwarded ? `counter-label ${forwarded}` : "counter-label";
  }
}

if (!customElements.get(VANILLA_COUNTER_LABEL_TAG)) {
  customElements.define(VANILLA_COUNTER_LABEL_TAG, VanillaCounterLabelElement);
}
