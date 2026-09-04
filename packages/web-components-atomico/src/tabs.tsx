import { type ChangeCallback } from "./shared";
import { nextId, boolAttr, emit, enumValue, DeferredElement, ControlLeaf } from "./shared";

export const ATOMICO_TABS_TAG = "atomico-tabs";
export const ATOMICO_TABS_LIST_TAG = "atomico-tabs-list";
export const ATOMICO_TAB_TAG = "atomico-tab";
export const ATOMICO_TAB_PANEL_TAG = "atomico-tab-panel";
export class AtomicoTabsListElement extends HTMLElement {}
export class AtomicoTabElement extends ControlLeaf {
  static override marker = "tab";
  get value(): string {
    return this.getAttribute("value") ?? "";
  }
  set value(value: string) {
    if (!value) throw new TypeError("tab value must be nonempty");
    this.setAttribute("value", value);
  }
}
export class AtomicoTabPanelElement extends HTMLElement {
  get value(): string {
    return this.getAttribute("value") ?? "";
  }
  set value(value: string) {
    if (!value) throw new TypeError("tab panel value must be nonempty");
    this.setAttribute("value", value);
  }
}
export class AtomicoTabsElement extends DeferredElement {
  static observedAttributes = [
    "value",
    "default-value",
    "orientation",
    "activation-mode",
    "disabled",
  ];
  onValueChange: ChangeCallback<string> = null;
  #value = "";
  #controlled = false;
  #initialized = false;
  get value(): string {
    return this.#value;
  }
  set value(value: string) {
    if (!value) throw new TypeError("tabs value must be nonempty");
    this.#controlled = true;
    this.setAttribute("value", value);
  }
  get defaultValue(): string {
    return this.getAttribute("default-value") ?? "";
  }
  set defaultValue(value: string) {
    this.setAttribute("default-value", value);
  }
  get orientation(): "horizontal" | "vertical" {
    return enumValue(
      this.getAttribute("orientation"),
      ["horizontal", "vertical"] as const,
      "horizontal",
      "orientation",
    );
  }
  set orientation(value: "horizontal" | "vertical") {
    enumValue(value, ["horizontal", "vertical"] as const, "horizontal", "orientation");
    this.setAttribute("orientation", value);
  }
  get activationMode(): "automatic" | "manual" {
    return enumValue(
      this.getAttribute("activation-mode"),
      ["automatic", "manual"] as const,
      "automatic",
      "activationMode",
    );
  }
  set activationMode(value: "automatic" | "manual") {
    enumValue(value, ["automatic", "manual"] as const, "automatic", "activationMode");
    this.setAttribute("activation-mode", value);
  }
  override connectedCallback(): void {
    super.connectedCallback();
    this.addEventListener("click", this.#onClick);
    this.addEventListener("keydown", this.#onKey);
    this.addEventListener("focusin", this.#onFocus);
  }
  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.removeEventListener("click", this.#onClick);
    this.removeEventListener("keydown", this.#onKey);
    this.removeEventListener("focusin", this.#onFocus);
  }
  attributeChangedCallback(name: string): void {
    if (name === "value") {
      this.#controlled = true;
      this.#value = this.getAttribute("value") ?? "";
    }
    this.deferSync();
  }
  #select(tab: AtomicoTabElement): void {
    if (boolAttr(this, "disabled") || tab.hasAttribute("disabled")) return;
    emit(this, this.onValueChange, "value-change", "value", tab.value);
    if (!this.#controlled) {
      this.#value = tab.value;
      this.sync();
    }
  }
  #onClick = (event: Event) => {
    const button = (event.target as Element).closest(`${ATOMICO_TAB_TAG} > button`);
    const tab = button?.parentElement;
    if (tab instanceof AtomicoTabElement) this.#select(tab);
  };
  #onFocus = (event: FocusEvent) => {
    const tab = (event.target as Element).closest(ATOMICO_TAB_TAG);
    if (tab instanceof AtomicoTabElement && this.activationMode === "automatic") this.#select(tab);
  };
  #onKey = (event: KeyboardEvent) => {
    const tab = (event.target as Element).closest(ATOMICO_TAB_TAG);
    if (!(tab instanceof AtomicoTabElement)) return;
    const tabs = [...this.querySelectorAll<AtomicoTabElement>(ATOMICO_TAB_TAG)].filter(
      (item) => !item.hasAttribute("disabled"),
    );
    const index = tabs.indexOf(tab);
    let next: AtomicoTabElement | undefined;
    const previousKey = this.orientation === "horizontal" ? "ArrowLeft" : "ArrowUp";
    const nextKey = this.orientation === "horizontal" ? "ArrowRight" : "ArrowDown";
    if (event.key === previousKey) next = tabs[(index - 1 + tabs.length) % tabs.length];
    if (event.key === nextKey) next = tabs[(index + 1) % tabs.length];
    if (event.key === "Home") next = tabs[0];
    if (event.key === "End") next = tabs.at(-1);
    if (next) {
      event.preventDefault();
      next.querySelector("button")?.focus();
    }
    if (this.activationMode === "manual" && (event.key === "Enter" || event.key === " ")) {
      event.preventDefault();
      this.#select(tab);
    }
  };
  protected sync(): void {
    const tabs = [...this.querySelectorAll<AtomicoTabElement>(ATOMICO_TAB_TAG)];
    const panels = [...this.querySelectorAll<AtomicoTabPanelElement>(ATOMICO_TAB_PANEL_TAG)];
    const values = tabs.map((tab) => tab.value);
    const panelValues = panels.map((panel) => panel.value);
    if (
      values.some((value) => !value) ||
      new Set(values).size !== values.length ||
      panelValues.some((value) => !value) ||
      new Set(panelValues).size !== panelValues.length
    )
      throw new TypeError("tab and panel values must be unique and nonempty");
    if (!this.#initialized) {
      this.#initialized = true;
      if (!this.#controlled)
        this.#value =
          this.defaultValue || tabs.find((tab) => !tab.hasAttribute("disabled"))?.value || "";
    }
    const list = this.querySelector(ATOMICO_TABS_LIST_TAG);
    list?.setAttribute("role", "tablist");
    list?.setAttribute("aria-orientation", this.orientation);
    for (const tab of tabs) {
      const button = tab.querySelector("button");
      const panel = panels.find((candidate) => candidate.value === tab.value);
      if (!button || !panel) continue;
      const active = tab.value === this.#value;
      button.id ||= nextId(`${ATOMICO_TAB_TAG}-button`);
      panel.id ||= nextId(ATOMICO_TAB_PANEL_TAG);
      button.setAttribute("role", "tab");
      button.setAttribute("aria-selected", String(active));
      button.setAttribute("aria-controls", panel.id);
      button.tabIndex = active ? 0 : -1;
      button.toggleAttribute(
        "disabled",
        boolAttr(this, "disabled") || tab.hasAttribute("disabled"),
      );
      button.style.cursor = button.disabled ? "not-allowed" : "pointer";
      panel.setAttribute("role", "tabpanel");
      panel.setAttribute("aria-labelledby", button.id);
      panel.hidden = !active;
      for (const node of [tab, button, panel]) {
        node.toggleAttribute("data-active", active);
        node.toggleAttribute("data-inactive", !active);
        node.toggleAttribute("data-disabled", button.disabled);
      }
    }
  }
}

export const tabsDefinitions: ReadonlyArray<readonly [string, CustomElementConstructor]> = [
  [ATOMICO_TABS_TAG, AtomicoTabsElement],
  [ATOMICO_TABS_LIST_TAG, AtomicoTabsListElement],
  [ATOMICO_TAB_TAG, AtomicoTabElement],
  [ATOMICO_TAB_PANEL_TAG, AtomicoTabPanelElement],
];
