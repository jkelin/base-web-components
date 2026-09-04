import { P, LightElement, nextId, bool, emit, ObservedRoot, TextButton } from "./shared";

export class SvelteAccordionElement extends ObservedRoot {
  static observedAttributes = ["value", "multiple", "disabled"];
  #value: string[] = [];
  #controlled = false;
  #initialized = false;
  get value() {
    return this.#value;
  }
  set value(next: string[]) {
    if (!Array.isArray(next)) throw new TypeError("accordion value must be a string array");
    this.#controlled = true;
    this.#value = next.map(String);
    this.setAttribute("value", JSON.stringify(this.#value));
    this.sync();
  }
  get defaultValue() {
    return this.parse(this.getAttribute("default-value"));
  }
  set defaultValue(next: string[]) {
    this.setAttribute("default-value", JSON.stringify(next));
  }
  attributeChangedCallback(name: string) {
    if (name === "value" && this.isConnected) {
      this.#controlled = true;
      this.#value = this.parse(this.getAttribute("value"));
    }
    this.sync();
  }
  override connectedCallback() {
    if (!this.#initialized) {
      this.#controlled = this.hasAttribute("value");
      this.#value = this.parse(this.getAttribute(this.#controlled ? "value" : "default-value"));
      this.#initialized = true;
    }
    super.connectedCallback();
  }
  parse(raw: string | null) {
    if (!raw) return [];
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new TypeError("accordion value must be a JSON string array");
    }
    if (!Array.isArray(parsed) || parsed.some((v) => typeof v !== "string"))
      throw new TypeError("accordion value must be a JSON string array");
    return parsed;
  }
  override rootClick = (event: Event) => {
    const trigger = (event.target as Element).closest(`${P}-accordion-trigger`);
    if (!trigger || !this.contains(trigger) || bool(this, "disabled")) return;
    const item = trigger.closest(`${P}-accordion-item`) as HTMLElement | null;
    const value = item?.getAttribute("value")?.trim();
    if (!value) throw new TypeError("accordion item value must be nonempty");
    const next = this.#value.includes(value)
      ? this.#value.filter((v) => v !== value)
      : bool(this, "multiple")
        ? [...this.#value, value]
        : [value];
    if (!this.#controlled) this.#value = next;
    emit(this, "value-change", { value: next });
    this.sync();
  };
  override sync() {
    const items = [...this.querySelectorAll(`:scope > ${P}-accordion-item`)] as HTMLElement[];
    const seen = new Set<string>();
    for (const item of items) {
      const value = item.getAttribute("value")?.trim();
      if (!value) throw new TypeError("accordion item value must be nonempty");
      if (seen.has(value)) throw new TypeError(`duplicate accordion value: ${value}`);
      seen.add(value);
      const trigger = item.querySelector(`${P}-accordion-trigger`);
      const panel = item.querySelector(`${P}-accordion-panel`);
      if (!trigger || !panel) continue;
      const control = trigger.querySelector("button") ?? trigger;
      control.id ||= nextId(trigger as HTMLElement, `${P}-accordion-trigger-button`, "button");
      panel.id ||= nextId(panel as HTMLElement, `${P}-accordion-panel`, "panel");
      const open = this.#value.includes(value);
      item.toggleAttribute("data-open", open);
      item.toggleAttribute("data-closed", !open);
      control.setAttribute("data-open", open ? "" : "false");
      control.setAttribute("data-closed", open ? "false" : "");
      control.setAttribute("aria-expanded", String(open));
      control.setAttribute("aria-controls", panel.id);
      panel.setAttribute("aria-labelledby", control.id);
      panel.setAttribute("role", "region");
      panel.toggleAttribute("hidden", !open);
    }
  }
}
export class SvelteAccordionItemElement extends LightElement {}
export class SvelteAccordionTriggerElement extends TextButton {
  override marker = "accordion-trigger";
}
export class SvelteAccordionPanelElement extends LightElement {}
