import { html, LitElement } from "lit";
import { LIT_COUNTER_MINUS_TAG } from "./counter";

/** Light-DOM decrement control with its host class forwarded to the button. */
export class LitCounterMinusElement extends LitElement {
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
      ? `counter-minus-button ${this.hostClass}`
      : "counter-minus-button";
    // oxfmt-ignore
    return html`<button type="button" aria-label="Decrement count" data-testid=${LIT_COUNTER_MINUS_TAG} class=${className} style="cursor: pointer; user-select: none">−</button>`;
  }
}

if (!customElements.get(LIT_COUNTER_MINUS_TAG)) {
  customElements.define(LIT_COUNTER_MINUS_TAG, LitCounterMinusElement);
}
