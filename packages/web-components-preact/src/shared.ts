import { h, render } from "preact";

export const P = "preact";
let idCounter = 0;
export function nextId(host: HTMLElement, tag: string, suffix: string): string {
  return host.id ? `${host.id}-${suffix}` : `${tag}-${++idCounter}`;
}
export const bool = (el: Element, name: string) => el.hasAttribute(name);
export const emit = (el: HTMLElement, name: string, detail: object) => {
  const callback = (el as unknown as Record<string, unknown>)[
    `on${name
      .split("-")
      .map((part) => part[0]!.toUpperCase() + part.slice(1))
      .join("")}`
  ];
  if (typeof callback === "function")
    (callback as (detail: unknown) => void)(
      (detail as Record<string, unknown>)[Object.keys(detail)[0]!],
    );
  el.dispatchEvent(new CustomEvent(name, { detail, bubbles: true, composed: true }));
};
export const markerClass = (host: HTMLElement, marker: string) =>
  [marker, ...host.classList].join(" ");
export const define = (tag: string, ctor: CustomElementConstructor) => {
  if (!customElements.get(tag)) customElements.define(tag, ctor);
};

export abstract class ObservedRoot extends HTMLElement {
  observer?: MutationObserver;
  connectedCallback() {
    this.addEventListener("click", this.rootClick);
    this.addEventListener("keydown", this.rootKey);
    this.observer = new MutationObserver(() => queueMicrotask(() => this.sync()));
    this.observer.observe(this, { childList: true, subtree: true });
    queueMicrotask(() => this.sync());
  }
  disconnectedCallback() {
    this.removeEventListener("click", this.rootClick);
    this.removeEventListener("keydown", this.rootKey);
    this.observer?.disconnect();
  }
  rootClick = (_event: Event) => {};
  rootKey = (_event: KeyboardEvent) => {};
  abstract sync(): void;
}
export class TextButton extends HTMLElement {
  static observedAttributes = ["class", "disabled"];
  marker = "component-button";
  type: "button" | "submit" = "button";
  attributeChangedCallback() {
    if (!this.isConnected) return;
    const button = this.querySelector(":scope > button") as HTMLButtonElement | null;
    if (!button) {
      this.renderButton();
      return;
    }
    button.className = markerClass(this, this.marker);
    button.disabled = this.hasAttribute("disabled");
    button.style.cursor = button.disabled ? "not-allowed" : "pointer";
  }
  renderButton() {
    const text = this.textContent ?? "";
    this.replaceChildren();
    render(
      h(
        "button",
        {
          type: this.type,
          id: this.id ? `${this.id}-button` : undefined,
          class: markerClass(this, this.marker),
          "data-testid": this.localName,
          style: {
            cursor: this.hasAttribute("disabled") ? "not-allowed" : "pointer",
            userSelect: "none",
          },
          disabled: this.hasAttribute("disabled"),
        },
        text,
      ),
      this,
    );
  }
  connectedCallback() {
    this.renderButton();
  }
}
export abstract class OpenRoot extends ObservedRoot {
  #open = false;
  #controlled = false;
  #initialized = false;
  static observedAttributes = ["open", "disabled"];
  get open() {
    return this.#open;
  }
  set open(next: boolean) {
    this.#controlled = true;
    this.#open = Boolean(next);
    this.toggleAttribute("open", this.#open);
    this.sync();
  }
  get defaultOpen() {
    return bool(this, "default-open");
  }
  set defaultOpen(next: boolean) {
    this.toggleAttribute("default-open", Boolean(next));
  }
  override connectedCallback() {
    if (!this.#initialized) {
      this.#controlled = this.hasAttribute("open");
      this.#open = this.#controlled ? bool(this, "open") : bool(this, "default-open");
      this.#initialized = true;
    }
    super.connectedCallback();
  }
  attributeChangedCallback(name: string) {
    if (name === "open" && this.isConnected) {
      this.#controlled = true;
      this.#open = bool(this, "open");
    }
    this.sync();
  }
  request(next: boolean) {
    if (bool(this, "disabled")) return;
    if (!this.#controlled) this.#open = next;
    emit(this, "open-change", { open: next });
    this.sync();
  }
  get isOpen() {
    return this.#open;
  }
}

export { h, render };
