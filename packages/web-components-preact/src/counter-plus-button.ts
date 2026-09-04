import { h, render } from "preact";
import { PREACT_COUNTER_PLUS_TAG } from "./counter";

/** Light-DOM increment control with live host-class forwarding. */
export class PreactCounterPlusElement extends HTMLElement {
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
    const className = forwarded ? `counter-plus-button ${forwarded}` : "counter-plus-button";

    render(
      h(
        "button",
        {
          type: "button",
          "aria-label": "Increment count",
          "data-testid": PREACT_COUNTER_PLUS_TAG,
          class: className,
          style: "cursor:pointer;user-select:none",
        },
        "+",
      ),
      this,
    );
  }
}

if (!customElements.get(PREACT_COUNTER_PLUS_TAG)) {
  customElements.define(PREACT_COUNTER_PLUS_TAG, PreactCounterPlusElement);
}
