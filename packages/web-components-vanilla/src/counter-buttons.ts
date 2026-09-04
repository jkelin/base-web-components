import { VANILLA_COUNTER_MINUS_TAG, VANILLA_COUNTER_PLUS_TAG } from "./counter";

function defineCounterButton(
  tag: string,
  label: string,
  text: string,
  marker: string,
): CustomElementConstructor {
  class CounterButtonElement extends HTMLElement {
    static observedAttributes = ["class"];

    get #button(): HTMLButtonElement | null {
      return this.querySelector(":scope > button");
    }

    connectedCallback(): void {
      if (!this.#button) {
        const button = document.createElement("button");
        button.type = "button";
        button.setAttribute("aria-label", label);
        button.dataset.testid = tag;
        button.textContent = text;
        this.append(button);
      }
      this.#syncClass();
    }

    attributeChangedCallback(name: string): void {
      if (name === "class") {
        this.#syncClass();
      }
    }

    #syncClass(): void {
      const button = this.#button;
      if (!button) {
        return;
      }
      const forwarded = this.getAttribute("class") ?? "";
      button.className = forwarded ? `${marker} ${forwarded}` : marker;
    }
  }

  if (!customElements.get(tag)) {
    customElements.define(tag, CounterButtonElement);
  }

  return CounterButtonElement;
}

// Light-DOM buttons so page stylesheets apply; host `class` is forwarded
// after a stable marker class. Clicks bubble to the parent controller.
export const VanillaCounterMinusElement = defineCounterButton(
  VANILLA_COUNTER_MINUS_TAG,
  "Decrement count",
  "−",
  "counter-minus-button",
);
export const VanillaCounterPlusElement = defineCounterButton(
  VANILLA_COUNTER_PLUS_TAG,
  "Increment count",
  "+",
  "counter-plus-button",
);
