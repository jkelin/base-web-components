import { type ChangeCallback } from "./shared";
import { nextId, boolAttr, emit, parseJsonStrings, DeferredElement, ControlLeaf } from "./shared";

export const O_ACCORDION_TAG = "o-accordion";
export const O_ACCORDION_ITEM_TAG = "o-accordion-item";
export const O_ACCORDION_TRIGGER_TAG = "o-accordion-trigger";
export const O_ACCORDION_PANEL_TAG = "o-accordion-panel";

export class OptimizedAccordionItemElement extends HTMLElement {
  get value(): string {
    return this.getAttribute("value") ?? "";
  }
  set value(value: string) {
    if (!value) throw new TypeError("accordion item value must be nonempty");
    this.setAttribute("value", value);
  }
}
export class OptimizedAccordionTriggerElement extends ControlLeaf {
  static override marker = "accordion-trigger";
}
export class OptimizedAccordionPanelElement extends HTMLElement {}

export class OptimizedAccordionElement extends DeferredElement {
  static observedAttributes = ["value", "default-value", "multiple", "disabled"];
  onValueChange: ChangeCallback<string[]> = null;
  #value: string[] = [];
  #controlled = false;
  #initialized = false;
  #onClick = (event: Event) => {
    const button = (event.target as Element).closest(`${O_ACCORDION_TRIGGER_TAG} > button`);
    if (!button || !this.contains(button) || this.disabled) return;
    const item = button.parentElement?.parentElement;
    if (!(item instanceof OptimizedAccordionItemElement) || item.hasAttribute("disabled")) return;
    const current = this.#value;
    const next = current.includes(item.value)
      ? current.filter((value) => value !== item.value)
      : this.multiple
        ? [...current, item.value]
        : [item.value];
    emit(this, this.onValueChange, "value-change", "value", next);
    if (!this.#controlled) {
      this.#value = next;
      this.sync();
    }
  };
  get multiple(): boolean {
    return boolAttr(this, "multiple");
  }
  set multiple(value: boolean) {
    this.toggleAttribute("multiple", value);
  }
  get disabled(): boolean {
    return boolAttr(this, "disabled");
  }
  set disabled(value: boolean) {
    this.toggleAttribute("disabled", value);
  }
  get value(): string[] {
    return [...this.#value];
  }
  set value(value: string[]) {
    this.#controlled = true;
    this.setAttribute("value", JSON.stringify(parseJsonStrings(JSON.stringify(value), "value")));
  }
  get defaultValue(): string[] {
    return parseJsonStrings(this.getAttribute("default-value"), "defaultValue");
  }
  set defaultValue(value: string[]) {
    this.setAttribute(
      "default-value",
      JSON.stringify(parseJsonStrings(JSON.stringify(value), "defaultValue")),
    );
  }
  override connectedCallback(): void {
    super.connectedCallback();
    this.addEventListener("click", this.#onClick);
  }
  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.removeEventListener("click", this.#onClick);
  }
  attributeChangedCallback(name: string): void {
    if (name === "value") {
      this.#controlled = true;
      this.#value = parseJsonStrings(this.getAttribute("value"), "value");
    }
    this.deferSync();
  }
  protected sync(): void {
    const items = [...this.querySelectorAll<OptimizedAccordionItemElement>(O_ACCORDION_ITEM_TAG)];
    const values = items.map((item) => item.value);
    if (values.some((value) => !value) || new Set(values).size !== values.length)
      throw new TypeError("accordion item values must be unique and nonempty");
    if (!this.#initialized) {
      this.#initialized = true;
      if (!this.#controlled) this.#value = this.defaultValue;
    }
    if (!this.multiple && this.#value.length > 1)
      throw new TypeError("single accordion accepts at most one value");
    for (const item of items) {
      const trigger = item.querySelector<OptimizedAccordionTriggerElement>(
        `:scope > ${O_ACCORDION_TRIGGER_TAG}`,
      );
      const panel = item.querySelector<OptimizedAccordionPanelElement>(
        `:scope > ${O_ACCORDION_PANEL_TAG}`,
      );
      const button = trigger?.querySelector("button");
      if (!trigger || !panel || !button) continue;
      const open = this.#value.includes(item.value);
      button.id ||= nextId(`${O_ACCORDION_TRIGGER_TAG}-button`);
      panel.id ||= nextId(O_ACCORDION_PANEL_TAG);
      button.setAttribute("aria-expanded", String(open));
      button.setAttribute("aria-controls", panel.id);
      button.toggleAttribute("disabled", this.disabled || item.hasAttribute("disabled"));
      button.style.cursor = button.hasAttribute("disabled") ? "not-allowed" : "pointer";
      panel.setAttribute("role", "region");
      panel.setAttribute("aria-labelledby", button.id);
      panel.hidden = !open;
      item.toggleAttribute("data-open", open);
      item.toggleAttribute("data-closed", !open);
      trigger.toggleAttribute("data-open", open);
      trigger.toggleAttribute("data-closed", !open);
      panel.toggleAttribute("data-open", open);
      panel.toggleAttribute("data-closed", !open);
      for (const node of [item, trigger, panel]) {
        node.toggleAttribute("data-disabled", this.disabled || item.hasAttribute("disabled"));
      }
    }
  }
}

const definitions: Array<[string, CustomElementConstructor]> = [
  [O_ACCORDION_TAG, OptimizedAccordionElement],
  [O_ACCORDION_ITEM_TAG, OptimizedAccordionItemElement],
  [O_ACCORDION_TRIGGER_TAG, OptimizedAccordionTriggerElement],
  [O_ACCORDION_PANEL_TAG, OptimizedAccordionPanelElement],
];
for (const [tag, constructor] of definitions)
  if (!customElements.get(tag)) customElements.define(tag, constructor);
