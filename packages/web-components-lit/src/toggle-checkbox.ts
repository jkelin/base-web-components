import { h, render, LightLitElement, bool, emit, markerClass, define } from "./shared";

export class LitToggleCheckboxElement extends LightLitElement {
  static override observedAttributes = [
    "checked",
    "disabled",
    "readonly",
    "required",
    "indeterminate",
    "name",
    "value",
    "form",
    "aria-label",
    "class",
  ];
  #checked = false;
  #controlled = false;
  input?: HTMLInputElement;
  get checked() {
    return this.#checked;
  }
  set checked(next: boolean) {
    this.#controlled = true;
    this.#checked = Boolean(next);
    this.toggleAttribute("checked", this.#checked);
    this.sync();
  }
  get defaultChecked() {
    return bool(this, "default-checked");
  }
  set defaultChecked(next: boolean) {
    this.toggleAttribute("default-checked", Boolean(next));
  }
  override connectedCallback() {
    this.#controlled = this.hasAttribute("checked");
    this.#checked = this.#controlled ? bool(this, "checked") : bool(this, "default-checked");
    this.sync();
  }
  override attributeChangedCallback(name: string) {
    if (name === "checked" && this.isConnected) {
      this.#controlled = true;
      this.#checked = bool(this, "checked");
    }
    this.sync();
  }
  sync() {
    const disabled = bool(this, "disabled");
    const attrs: Record<string, unknown> = {
      type: "checkbox",
      id: this.id || undefined,
      class: markerClass(this, "toggle-checkbox"),
      "data-testid": this.localName,
      style: { cursor: disabled ? "not-allowed" : "pointer" },
      checked: this.#checked,
      disabled,
      readOnly: bool(this, "readonly"),
      required: bool(this, "required"),
      name: this.getAttribute("name") ?? undefined,
      value: this.getAttribute("value") ?? "on",
      form: this.getAttribute("form") ?? undefined,
      "aria-label": this.getAttribute("aria-label") ?? undefined,
      onClick: (event: MouseEvent) => {
        const input = event.currentTarget as HTMLInputElement;
        if (disabled || bool(this, "readonly")) {
          event.preventDefault();
          return;
        }
        const next = input.checked;
        if (!this.#controlled) {
          this.#checked = next;
          this.sync();
        } else {
          this.sync();
        }
        emit(this, "checked-change", { checked: next });
      },
    };
    render(h("input", attrs), this);
    this.input = this.firstElementChild as HTMLInputElement;
    this.input.indeterminate = bool(this, "indeterminate");
    this.toggleAttribute("data-checked", this.#checked);
    this.toggleAttribute("data-unchecked", !this.#checked);
    this.toggleAttribute("data-disabled", disabled);
  }
}

const definitions: [string, CustomElementConstructor][] = [
  ["lit-toggle-checkbox", LitToggleCheckboxElement],
];
for (const [tag, ctor] of definitions) define(tag, ctor);
