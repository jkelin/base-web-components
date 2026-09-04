import { html, LitElement } from "lit";
import {
  LIT_COUNTER_LABEL_TAG,
  LIT_COUNTER_TAG,
  LitCounterElement,
  parseCounterValue,
} from "./counter";

/** Light-DOM count output with its host class forwarded to the span. */
export class LitCounterLabelElement extends LitElement {
  static override properties = {
    value: { converter: { fromAttribute: parseCounterValue } },
    hostClass: { attribute: "class" },
  };

  declare value: number;
  declare private hostClass: string;

  constructor() {
    super();
    this.value = 0;
    this.hostClass = "";
  }

  protected override createRenderRoot(): HTMLElement | DocumentFragment {
    return this;
  }

  override connectedCallback(): void {
    super.connectedCallback();
    const owner = this.closest(LIT_COUNTER_TAG);
    if (owner instanceof LitCounterElement) {
      this.value = owner.value;
    } else {
      this.value = parseCounterValue(this.getAttribute("value"));
    }
  }

  protected override render() {
    const className = this.hostClass ? `counter-label ${this.hostClass}` : "counter-label";
    return html`<span aria-live="polite" data-testid=${LIT_COUNTER_LABEL_TAG} class=${className}
      >${this.value}</span
    >`;
  }
}

if (!customElements.get(LIT_COUNTER_LABEL_TAG)) {
  customElements.define(LIT_COUNTER_LABEL_TAG, LitCounterLabelElement);
}
