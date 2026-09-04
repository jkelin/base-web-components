import { type ChangeCallback } from "./shared";
import { boolAttr, emit, upgradeProperties } from "./shared";

export const ATOMICO_TOGGLE_CHECKBOX_TAG = "atomico-toggle-checkbox";
export class AtomicoToggleCheckboxElement extends HTMLElement {
  static observedAttributes = [
    "checked",
    "default-checked",
    "indeterminate",
    "disabled",
    "readonly",
    "required",
    "name",
    "value",
    "form",
    "aria-label",
  ];
  onCheckedChange: ChangeCallback<boolean> = null;
  #input: HTMLInputElement | null = null;
  #checked = false;
  #controlled = false;
  #initialized = false;
  #observer: MutationObserver | null = null;
  get checked(): boolean {
    return this.#checked;
  }
  set checked(value: boolean) {
    this.#controlled = true;
    this.toggleAttribute("checked", value);
  }
  get defaultChecked(): boolean {
    return boolAttr(this, "default-checked");
  }
  set defaultChecked(value: boolean) {
    this.toggleAttribute("default-checked", value);
  }
  get indeterminate(): boolean {
    return boolAttr(this, "indeterminate");
  }
  set indeterminate(value: boolean) {
    this.toggleAttribute("indeterminate", value);
  }
  get disabled(): boolean {
    return boolAttr(this, "disabled");
  }
  set disabled(value: boolean) {
    this.toggleAttribute("disabled", value);
  }
  get readOnly(): boolean {
    return boolAttr(this, "readonly");
  }
  set readOnly(value: boolean) {
    this.toggleAttribute("readonly", value);
  }
  connectedCallback(): void {
    upgradeProperties(this, ["checked", "defaultChecked", "indeterminate", "disabled", "readOnly"]);
    if (!this.#input) {
      this.#input = document.createElement("input");
      this.#input.type = "checkbox";
      this.replaceChildren(this.#input);
    }
    this.#input.addEventListener("change", this.#onChange);
    this.#observer = new MutationObserver(() => this.#sync());
    this.#observer.observe(this, { attributes: true, attributeFilter: ["class"], childList: true });
    this.#sync();
  }
  disconnectedCallback(): void {
    this.#input?.removeEventListener("change", this.#onChange);
    this.#observer?.disconnect();
  }
  attributeChangedCallback(name: string): void {
    if (name === "checked") {
      this.#controlled = true;
      this.#checked = this.hasAttribute("checked");
    }
    this.#sync();
  }
  #onChange = () => {
    if (!this.#input || this.disabled || this.readOnly) {
      this.#sync();
      return;
    }
    const next = this.#input.checked;
    emit(this, this.onCheckedChange, "checked-change", "checked", next);
    if (!this.#controlled) this.#checked = next;
    this.#sync();
  };
  #sync(): void {
    if (!this.#input) return;
    if (!this.#initialized) {
      this.#initialized = true;
      if (!this.#controlled) this.#checked = this.defaultChecked;
    }
    const input = this.#input;
    input.className = `toggle-checkbox${this.className ? ` ${this.className}` : ""}`;
    input.dataset.testid = this.localName;
    input.style.cursor = this.disabled ? "not-allowed" : "pointer";
    input.checked = this.#checked;
    input.indeterminate = this.indeterminate;
    input.disabled = this.disabled;
    input.readOnly = this.readOnly;
    input.required = boolAttr(this, "required");
    for (const name of ["name", "value", "form", "aria-label"]) {
      const value = this.getAttribute(name);
      if (value === null) input.removeAttribute(name);
      else input.setAttribute(name, value);
    }
    this.toggleAttribute("data-checked", this.#checked);
    this.toggleAttribute("data-unchecked", !this.#checked);
    this.toggleAttribute("data-disabled", this.disabled);
    input.toggleAttribute("data-checked", this.#checked);
    input.toggleAttribute("data-unchecked", !this.#checked);
    input.toggleAttribute("data-disabled", this.disabled);
  }
}

export const toggleCheckboxDefinitions: ReadonlyArray<readonly [string, CustomElementConstructor]> =
  [[ATOMICO_TOGGLE_CHECKBOX_TAG, AtomicoToggleCheckboxElement]];
