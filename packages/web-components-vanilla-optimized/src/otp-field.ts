import { type ChangeCallback } from "./shared";
import { boolAttr, emit, finiteNumber, enumValue, upgradeProperties } from "./shared";

export const O_OTP_FIELD_TAG = "o-otp-field";
type ValidationType = "numeric" | "alpha" | "alphanumeric" | "none";
export class OptimizedOtpFieldElement extends HTMLElement {
  static observedAttributes = [
    "value",
    "default-value",
    "length",
    "validation-type",
    "mask",
    "disabled",
    "readonly",
    "required",
    "name",
    "form",
    "autocomplete",
    "inputmode",
  ];
  onValueChange: ChangeCallback<string> = null;
  onValueComplete: ChangeCallback<string> = null;
  #value = "";
  #controlled = false;
  #initialized = false;
  #inputs: HTMLInputElement[] = [];
  #hidden: HTMLInputElement | null = null;
  #observer: MutationObserver | null = null;
  get length(): number {
    const value = finiteNumber(this.getAttribute("length"), "length");
    if (!Number.isInteger(value) || value < 1)
      throw new TypeError("length must be a positive integer");
    return value;
  }
  set length(value: number) {
    if (!Number.isInteger(value) || value < 1)
      throw new TypeError("length must be a positive integer");
    this.setAttribute("length", String(value));
  }
  get validationType(): ValidationType {
    return enumValue(
      this.getAttribute("validation-type"),
      ["numeric", "alpha", "alphanumeric", "none"] as const,
      "numeric",
      "validationType",
    );
  }
  set validationType(value: ValidationType) {
    enumValue(
      value,
      ["numeric", "alpha", "alphanumeric", "none"] as const,
      "numeric",
      "validationType",
    );
    this.setAttribute("validation-type", value);
  }
  get value(): string {
    return this.#value;
  }
  set value(value: string) {
    this.#controlled = true;
    this.setAttribute("value", this.#normalize(value));
  }
  get defaultValue(): string {
    return this.#normalize(this.getAttribute("default-value") ?? "");
  }
  set defaultValue(value: string) {
    this.setAttribute("default-value", this.#normalize(value));
  }
  connectedCallback(): void {
    upgradeProperties(this, ["value", "defaultValue", "length", "validationType"]);
    this.#observer = new MutationObserver(() => this.#sync());
    this.#observer.observe(this, { attributes: true, attributeFilter: ["class"], childList: true });
    this.#sync();
  }
  disconnectedCallback(): void {
    this.#observer?.disconnect();
    for (const input of this.#inputs) {
      input.removeEventListener("input", this.#onInput);
      input.removeEventListener("keydown", this.#onKey);
      input.removeEventListener("paste", this.#onPaste);
    }
  }
  attributeChangedCallback(name: string): void {
    if (name === "value") {
      this.#controlled = true;
      this.#value = this.#normalize(this.getAttribute("value") ?? "");
    }
    this.#sync();
  }
  #normalize(raw: string): string {
    const pattern =
      this.validationType === "numeric"
        ? /[^0-9]/g
        : this.validationType === "alpha"
          ? /[^a-z]/gi
          : this.validationType === "alphanumeric"
            ? /[^a-z0-9]/gi
            : null;
    return (pattern ? raw.replace(pattern, "") : raw).slice(0, this.length);
  }
  #commit(next: string): void {
    next = this.#normalize(next);
    emit(this, this.onValueChange, "value-change", "value", next);
    if (next.length === this.length)
      emit(this, this.onValueComplete, "value-complete", "value", next);
    if (!this.#controlled) this.#value = next;
    this.#sync();
  }
  #onInput = (event: Event) => {
    const input = event.currentTarget as HTMLInputElement;
    const index = this.#inputs.indexOf(input);
    const chars = this.#normalize(input.value);
    const next = (this.#value.slice(0, index) + chars + this.#value.slice(index + 1)).slice(
      0,
      this.length,
    );
    this.#commit(next);
    if (chars && index < this.length - 1) this.#inputs[index + 1]?.focus();
  };
  #onKey = (event: KeyboardEvent) => {
    const input = event.currentTarget as HTMLInputElement;
    const index = this.#inputs.indexOf(input);
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      this.#inputs[(index - 1 + this.length) % this.length]?.focus();
    }
    if (event.key === "ArrowRight") {
      event.preventDefault();
      this.#inputs[(index + 1) % this.length]?.focus();
    }
    if (event.key === "Backspace") {
      event.preventDefault();
      if (this.#value[index])
        this.#commit(this.#value.slice(0, index) + this.#value.slice(index + 1));
      else {
        const previous = Math.max(0, index - 1);
        this.#commit(this.#value.slice(0, previous) + this.#value.slice(previous + 1));
        this.#inputs[previous]?.focus();
      }
    }
  };
  #onPaste = (event: ClipboardEvent) => {
    event.preventDefault();
    const input = event.currentTarget as HTMLInputElement;
    const index = this.#inputs.indexOf(input);
    const text = this.#normalize(event.clipboardData?.getData("text") ?? "");
    this.#commit(
      (this.#value.slice(0, index) + text + this.#value.slice(index + text.length)).slice(
        0,
        this.length,
      ),
    );
    this.#inputs[Math.min(this.length - 1, index + text.length)]?.focus();
  };
  #sync(): void {
    const length = this.length;
    if (!this.#initialized) {
      this.#initialized = true;
      if (!this.#controlled) this.#value = this.defaultValue;
    }
    if (this.#inputs.length !== length) {
      for (const old of this.#inputs) {
        old.removeEventListener("input", this.#onInput);
        old.removeEventListener("keydown", this.#onKey);
        old.removeEventListener("paste", this.#onPaste);
      }
      this.#inputs = Array.from({ length }, () => {
        const input = document.createElement("input");
        input.maxLength = 1;
        input.addEventListener("input", this.#onInput);
        input.addEventListener("keydown", this.#onKey);
        input.addEventListener("paste", this.#onPaste);
        input.dataset.testid = this.localName;
        return input;
      });
      this.#hidden = document.createElement("input");
      this.#hidden.type = "hidden";
      this.replaceChildren(...this.#inputs, this.#hidden);
    }
    const disabled = boolAttr(this, "disabled"),
      readOnly = boolAttr(this, "readonly"),
      mask = boolAttr(this, "mask");
    this.#inputs.forEach((input, index) => {
      input.type = mask ? "password" : "text";
      input.value = this.#value[index] ?? "";
      input.className = `otp-field-input${this.className ? ` ${this.className}` : ""}`;
      input.style.cursor = disabled ? "not-allowed" : "text";
      input.disabled = disabled;
      input.readOnly = readOnly;
      input.required = boolAttr(this, "required");
      input.setAttribute("autocomplete", this.getAttribute("autocomplete") ?? "one-time-code");
      input.inputMode =
        this.getAttribute("inputmode") ?? (this.validationType === "numeric" ? "numeric" : "text");
      input.setAttribute("aria-label", `Character ${index + 1} of ${length}`);
      input.toggleAttribute("data-complete", Boolean(this.#value[index]));
      input.toggleAttribute("data-disabled", disabled);
    });
    if (this.#hidden) {
      this.#hidden.value = this.#value;
      for (const name of ["name", "form"]) {
        const value = this.getAttribute(name);
        if (value === null) this.#hidden.removeAttribute(name);
        else this.#hidden.setAttribute(name, value);
      }
    }
    this.toggleAttribute("data-complete", this.#value.length === length);
    this.toggleAttribute("data-disabled", disabled);
  }
}

const definitions: Array<[string, CustomElementConstructor]> = [
  [O_OTP_FIELD_TAG, OptimizedOtpFieldElement],
];
for (const [tag, constructor] of definitions)
  if (!customElements.get(tag)) customElements.define(tag, constructor);
