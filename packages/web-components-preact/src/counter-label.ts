import { h, render } from "preact";
import {
  PREACT_COUNTER_LABEL_TAG,
  PREACT_COUNTER_TAG,
  PreactCounterElement,
  parseCounterValue,
} from "./counter";

/** Light-DOM count label with parent and value-attribute synchronization. */
export class PreactCounterLabelElement extends HTMLElement {
  static observedAttributes = ["value", "class"];

  #value = 0;

  get value(): number {
    return this.#value;
  }

  set value(next: number) {
    this.setAttribute("value", String(parseCounterValue(next)));
  }

  connectedCallback(): void {
    // An upgraded parent owns the value; otherwise a later parent syncs the attribute.
    const owner = this.closest(PREACT_COUNTER_TAG);
    this.#value =
      owner instanceof PreactCounterElement
        ? owner.value
        : parseCounterValue(this.getAttribute("value"));
    this.#render();
  }

  attributeChangedCallback(name: string): void {
    if (!this.isConnected) {
      return;
    }

    if (name === "value") {
      this.#value = parseCounterValue(this.getAttribute("value"));
    }
    this.#render();
  }

  #render(): void {
    const forwarded = this.getAttribute("class") ?? "";
    const className = forwarded ? `counter-label ${forwarded}` : "counter-label";

    render(
      h(
        "span",
        {
          "aria-live": "polite",
          "data-testid": PREACT_COUNTER_LABEL_TAG,
          class: className,
        },
        String(this.#value),
      ),
      this,
    );
  }
}

if (!customElements.get(PREACT_COUNTER_LABEL_TAG)) {
  customElements.define(PREACT_COUNTER_LABEL_TAG, PreactCounterLabelElement);
}
