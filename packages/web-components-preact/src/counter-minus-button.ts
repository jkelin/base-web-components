import { h, render } from "preact";
import { PREACT_COUNTER_MINUS_TAG } from "./counter";

/** Light-DOM decrement control with live host-class forwarding. */
export class PreactCounterMinusElement extends HTMLElement {
  static observedAttributes = ["class"];

  connectedCallback(): void {
    this.#render();
  }

  attributeChangedCallback(name: string): void {
    if (name === "class" && this.isConnected) {
      this.#render();
    }
  }

  #render(): void {
    const forwarded = this.getAttribute("class") ?? "";
    const className = forwarded ? `counter-minus-button ${forwarded}` : "counter-minus-button";

    render(
      h(
        "button",
        {
          type: "button",
          "aria-label": "Decrement count",
          "data-testid": PREACT_COUNTER_MINUS_TAG,
          class: className,
          style: "cursor:pointer;user-select:none",
        },
        "−",
      ),
      this,
    );
  }
}

if (!customElements.get(PREACT_COUNTER_MINUS_TAG)) {
  customElements.define(PREACT_COUNTER_MINUS_TAG, PreactCounterMinusElement);
}
