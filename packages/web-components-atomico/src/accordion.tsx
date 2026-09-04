import { type ChangeCallback } from "./shared";
import { nextId, boolAttr, emit, parseJsonStrings, DeferredElement, ControlLeaf } from "./shared";

export const ATOMICO_ACCORDION_TAG = "atomico-accordion";
export const ATOMICO_ACCORDION_ITEM_TAG = "atomico-accordion-item";
export const ATOMICO_ACCORDION_TRIGGER_TAG = "atomico-accordion-trigger";
export const ATOMICO_ACCORDION_PANEL_TAG = "atomico-accordion-panel";

export class AtomicoAccordionItemElement extends HTMLElement {
  get value(): string {
    return this.getAttribute("value") ?? "";
  }
  set value(value: string) {
    if (!value) throw new TypeError("accordion item value must be nonempty");
    this.setAttribute("value", value);
  }
}
export class AtomicoAccordionTriggerElement extends ControlLeaf {
  static override marker = "accordion-trigger";
}
export class AtomicoAccordionPanelElement extends HTMLElement {}

export class AtomicoAccordionElement extends DeferredElement {
  static observedAttributes = ["value", "default-value", "multiple", "disabled"];
  onValueChange: ChangeCallback<string[]> = null;
  #value: string[] = [];
  #controlled = false;
  #initialized = false;
  #onClick = (event: Event) => {
    const button = (event.target as Element).closest(`${ATOMICO_ACCORDION_TRIGGER_TAG} > button`);
    if (!button || !this.contains(button) || this.disabled) return;
    const item = button.parentElement?.parentElement;
    if (!(item instanceof AtomicoAccordionItemElement) || item.hasAttribute("disabled")) return;
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
    const items = [
      ...this.querySelectorAll<AtomicoAccordionItemElement>(ATOMICO_ACCORDION_ITEM_TAG),
    ];
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
      const trigger = item.querySelector<AtomicoAccordionTriggerElement>(
        `:scope > ${ATOMICO_ACCORDION_TRIGGER_TAG}`,
      );
      const panel = item.querySelector<AtomicoAccordionPanelElement>(
        `:scope > ${ATOMICO_ACCORDION_PANEL_TAG}`,
      );
      const button = trigger?.querySelector("button");
      if (!trigger || !panel || !button) continue;
      const open = this.#value.includes(item.value);
      button.id ||= nextId(`${ATOMICO_ACCORDION_TRIGGER_TAG}-button`);
      panel.id ||= nextId(ATOMICO_ACCORDION_PANEL_TAG);
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

export const accordionDefinitions: ReadonlyArray<readonly [string, CustomElementConstructor]> = [
  [ATOMICO_ACCORDION_TAG, AtomicoAccordionElement],
  [ATOMICO_ACCORDION_ITEM_TAG, AtomicoAccordionItemElement],
  [ATOMICO_ACCORDION_TRIGGER_TAG, AtomicoAccordionTriggerElement],
  [ATOMICO_ACCORDION_PANEL_TAG, AtomicoAccordionPanelElement],
];
