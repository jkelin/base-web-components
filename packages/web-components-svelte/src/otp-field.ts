import { h, render, LightElement, bool, emit, markerClass } from "./shared";

export class SvelteOtpFieldElement extends LightElement {
  static observedAttributes = [
    "value",
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
    "class",
  ];
  #value = "";
  #controlled = false;
  #initialized = false;
  get value() {
    return this.#value;
  }
  set value(next: string) {
    this.#controlled = true;
    this.#value = this.clean(String(next));
    this.setAttribute("value", this.#value);
    this.sync();
  }
  get defaultValue() {
    return this.getAttribute("default-value") ?? "";
  }
  set defaultValue(next: string) {
    this.setAttribute("default-value", next);
  }
  get length() {
    const n = Number(this.getAttribute("length"));
    if (!Number.isInteger(n) || n < 1 || !Number.isFinite(n))
      throw new TypeError("OTP length must be a positive finite integer");
    return n;
  }
  connectedCallback() {
    if (!this.#initialized) {
      this.#controlled = this.hasAttribute("value");
      this.#value = this.clean(
        this.getAttribute(this.#controlled ? "value" : "default-value") ?? "",
      );
      this.#initialized = true;
    }
    this.sync();
  }
  attributeChangedCallback(name: string) {
    if (name === "value" && this.isConnected) {
      this.#controlled = true;
      this.#value = this.clean(this.getAttribute("value") ?? "");
    }
    this.sync();
  }
  clean(raw: string) {
    const type = this.getAttribute("validation-type") ?? "none";
    const regex =
      type === "numeric"
        ? /\d/g
        : type === "alpha"
          ? /[a-z]/gi
          : type === "alphanumeric"
            ? /[a-z\d]/gi
            : type === "none"
              ? /[\s\S]/g
              : null;
    if (!regex)
      throw new TypeError("OTP validationType must be numeric, alpha, alphanumeric, or none");
    return (raw.match(regex) ?? []).join("").slice(0, this.length);
  }
  commit(next: string) {
    next = this.clean(next);
    if (!this.#controlled) this.#value = next;
    emit(this, "value-change", { value: next });
    if (next.length === this.length) emit(this, "value-complete", { value: next });
    this.sync();
  }
  sync() {
    const length = this.length;
    const disabled = bool(this, "disabled");
    const readonly = bool(this, "readonly");
    const children = Array.from({ length }, (_, index) =>
      h("input", {
        type: this.hasAttribute("mask") ? "password" : "text",
        inputMode: this.getAttribute("inputmode") ?? undefined,
        autoComplete: index === 0 ? (this.getAttribute("autocomplete") ?? "one-time-code") : "off",
        maxLength: 1,
        value: this.#value[index] ?? "",
        disabled,
        readOnly: readonly,
        class: markerClass(this, "otp-input"),
        "data-testid": this.localName,
        "aria-label": `Character ${index + 1} of ${length}`,
        style: { cursor: disabled ? "not-allowed" : "text" },
        onInput: (event: InputEvent) => {
          const input = event.currentTarget as HTMLInputElement;
          const chars = this.#value.padEnd(length).split("");
          chars[index] = input.value;
          this.commit(chars.join("").trimEnd());
          if (input.value) (input.nextElementSibling as HTMLElement | null)?.focus();
        },
        onKeyDown: (event: KeyboardEvent) => {
          const input = event.currentTarget as HTMLInputElement;
          if (event.key === "Backspace") {
            event.preventDefault();
            const chars = this.#value.split("");
            if (chars[index]) chars[index] = "";
            else (input.previousElementSibling as HTMLElement | null)?.focus();
            this.commit(chars.join(""));
          }
          if (event.key === "ArrowLeft")
            (input.previousElementSibling as HTMLElement | null)?.focus();
          if (event.key === "ArrowRight") (input.nextElementSibling as HTMLElement | null)?.focus();
        },
        onPaste: (event: ClipboardEvent) => {
          event.preventDefault();
          const pasted = event.clipboardData?.getData("text") ?? "";
          this.commit(this.#value.slice(0, index) + pasted);
        },
      }),
    );
    children.push(
      h("input", {
        type: "hidden",
        name: this.getAttribute("name") ?? undefined,
        value: this.#value,
        form: this.getAttribute("form") ?? undefined,
        required: bool(this, "required"),
      }),
    );
    render(h("div", { class: "otp-field", "data-testid": this.localName }, children), this);
    this.toggleAttribute("data-complete", this.#value.length === length);
    this.toggleAttribute("data-disabled", disabled);
  }
}
