import { html, LitElement } from "lit";
import { LIT_COUNTER_PLUS_TAG } from "./counter";

/** Light-DOM increment control with its host class forwarded to the button. */
export class LitCounterPlusElement extends LitElement {
  static override properties = {
    hostClass: { attribute: "class" },
  };

  declare private hostClass: string;

  constructor() {
    super();
    this.hostClass = "";
  }

  protected override createRenderRoot(): HTMLElement | DocumentFragment {
    return this;
  }

  protected override render() {
    const className = this.hostClass
      ? `counter-plus-button ${this.hostClass}`
      : "counter-plus-button";
    return html`<button
      type="button"
      aria-label="Increment count"
      data-testid=${LIT_COUNTER_PLUS_TAG}
      class=${className}
      style="cursor: pointer; user-select: none"
    >
      +
    </button>`;
  }
}

if (!customElements.get(LIT_COUNTER_PLUS_TAG)) {
  customElements.define(LIT_COUNTER_PLUS_TAG, LitCounterPlusElement);
}
