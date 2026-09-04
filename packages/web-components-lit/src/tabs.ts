import { P, LightLitElement, nextId, bool, emit, define, ObservedRoot, TextButton } from "./shared";

export class LitTabsElement extends ObservedRoot {
  static override observedAttributes = ["value", "orientation", "activation-mode", "disabled"];
  #value = "";
  #controlled = false;
  #initialized = false;
  get value() {
    return this.#value;
  }
  set value(next: string) {
    this.#controlled = true;
    this.#value = String(next);
    this.setAttribute("value", this.#value);
    this.sync();
  }
  get defaultValue() {
    return this.getAttribute("default-value") ?? "";
  }
  set defaultValue(next: string) {
    this.setAttribute("default-value", next);
  }
  override connectedCallback() {
    if (!this.#initialized) {
      this.#controlled = this.hasAttribute("value");
      this.#value = this.getAttribute(this.#controlled ? "value" : "default-value") ?? "";
      this.#initialized = true;
    }
    super.connectedCallback();
  }
  override attributeChangedCallback(name: string) {
    if (name === "value" && this.isConnected) {
      this.#controlled = true;
      this.#value = this.getAttribute("value") ?? "";
    }
    this.sync();
  }
  select(value: string) {
    if (!this.#controlled) this.#value = value;
    emit(this, "value-change", { value });
    this.sync();
  }
  override rootClick = (event: Event) => {
    const tab = (event.target as Element).closest(`${P}-tab`) as HTMLElement | null;
    if (tab && this.contains(tab) && !bool(this, "disabled") && !bool(tab, "disabled"))
      this.select(tab.getAttribute("value")!);
  };
  override rootKey = (event: KeyboardEvent) => {
    const current = (event.target as Element).closest(`${P}-tab`) as HTMLElement | null;
    if (!current) return;
    const orientation = this.getAttribute("orientation") ?? "horizontal";
    if (!["horizontal", "vertical"].includes(orientation))
      throw new TypeError("tabs orientation must be horizontal or vertical");
    const mode = this.getAttribute("activation-mode") ?? "automatic";
    if (!["automatic", "manual"].includes(mode))
      throw new TypeError("tabs activationMode must be automatic or manual");
    const tabs = this.tabs();
    let index = tabs.indexOf(current);
    const previous = orientation === "horizontal" ? "ArrowLeft" : "ArrowUp";
    const next = orientation === "horizontal" ? "ArrowRight" : "ArrowDown";
    if (event.key === previous) index = (index - 1 + tabs.length) % tabs.length;
    else if (event.key === next) index = (index + 1) % tabs.length;
    else if (event.key === "Home") index = 0;
    else if (event.key === "End") index = tabs.length - 1;
    else if (mode === "manual" && ["Enter", " "].includes(event.key)) {
      this.select(current.getAttribute("value")!);
      return;
    } else return;
    event.preventDefault();
    tabs[index]?.focus();
    if (mode === "automatic") this.select(tabs[index]!.getAttribute("value")!);
  };
  tabs() {
    return [...this.querySelectorAll(`${P}-tab`)].filter(
      (tab) => !bool(tab, "disabled"),
    ) as HTMLElement[];
  }
  override sync() {
    const orientation = this.getAttribute("orientation") ?? "horizontal";
    if (!["horizontal", "vertical"].includes(orientation))
      throw new TypeError("tabs orientation must be horizontal or vertical");
    const list = this.querySelector(`${P}-tabs-list`);
    list?.setAttribute("role", "tablist");
    list?.setAttribute("aria-orientation", orientation);
    const tabs = [...this.querySelectorAll(`${P}-tab`)] as HTMLElement[];
    const panels = [...this.querySelectorAll(`${P}-tab-panel`)] as HTMLElement[];
    const values = tabs.map((tab) => tab.getAttribute("value")?.trim());
    if (values.some((value) => !value)) throw new TypeError("tab value must be nonempty");
    if (new Set(values).size !== values.length) throw new TypeError("tab values must be unique");
    if (!this.#value) this.#value = this.tabs()[0]?.getAttribute("value") ?? "";
    for (const tab of tabs) {
      const control = tab.querySelector("button") ?? tab;
      const value = tab.getAttribute("value")!;
      const panel = panels.find((entry) => entry.getAttribute("value") === value);
      control.id ||= nextId(tab, `${P}-tab-button`, "button");
      if (panel) {
        panel.id ||= nextId(panel, `${P}-tab-panel`, "panel");
        control.setAttribute("aria-controls", panel.id);
        panel.setAttribute("aria-labelledby", control.id);
      }
      const active = value === this.#value;
      control.setAttribute("role", "tab");
      control.setAttribute("aria-selected", String(active));
      control.tabIndex = active ? 0 : -1;
      control.toggleAttribute("data-active", active);
      control.toggleAttribute("data-inactive", !active);
      panel?.setAttribute("role", "tabpanel");
      panel?.toggleAttribute("hidden", !active);
      panel?.toggleAttribute("data-active", active);
      panel?.toggleAttribute("data-inactive", !active);
    }
  }
}
export class LitTabsListElement extends LightLitElement {}
export class LitTabElement extends TextButton {
  override marker = "tab";
}
export class LitTabPanelElement extends LightLitElement {}

const definitions: [string, CustomElementConstructor][] = [
  ["lit-tabs", LitTabsElement],
  ["lit-tabs-list", LitTabsListElement],
  ["lit-tab", LitTabElement],
  ["lit-tab-panel", LitTabPanelElement],
];
for (const [tag, ctor] of definitions) define(tag, ctor);
