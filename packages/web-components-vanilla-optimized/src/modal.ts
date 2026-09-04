import { nextId, ControlLeaf, OpenController } from "./shared";

export const O_MODAL_TAG = "o-modal";
export const O_MODAL_TRIGGER_TAG = "o-modal-trigger";
export const O_MODAL_POPUP_TAG = "o-modal-popup";
export const O_MODAL_CLOSE_TAG = "o-modal-close";
export class OptimizedModalTriggerElement extends ControlLeaf {
  static override marker = "modal-trigger";
}
export class OptimizedModalCloseElement extends ControlLeaf {
  static override marker = "modal-close";
}
export class OptimizedModalPopupElement extends ControlLeaf {
  static override marker = "modal-popup";
  static override kind = "dialog" as const;
  protected override syncControl(): void {
    super.syncControl();
    for (const name of ["aria-labelledby", "aria-describedby"]) {
      const value = this.getAttribute(name);
      if (value) this.control?.setAttribute(name, value);
    }
  }
}

export class OptimizedModalElement extends OpenController {
  static observedAttributes = ["open", "default-open", "disabled"];
  #restore: HTMLElement | null = null;
  #dialog: HTMLDialogElement | null = null;
  #onClick = (event: MouseEvent) => {
    const target = event.target as Element;
    if (target.closest(`${O_MODAL_TRIGGER_TAG} > button`)) {
      this.#restore = target as HTMLElement;
      this.requestOpen(true);
    }
    if (target.closest(`${O_MODAL_CLOSE_TAG} > button`)) this.requestOpen(false);
    if (target === this.#dialog) {
      const rect = this.#dialog.getBoundingClientRect();
      if (
        event.clientX < rect.left ||
        event.clientX > rect.right ||
        event.clientY < rect.top ||
        event.clientY > rect.bottom
      )
        this.requestOpen(false);
    }
  };
  #onCancel = (event: Event) => {
    event.preventDefault();
    this.requestOpen(false);
  };
  override connectedCallback(): void {
    super.connectedCallback();
    this.addEventListener("click", this.#onClick);
    this.addEventListener("cancel", this.#onCancel);
  }
  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.removeEventListener("click", this.#onClick);
    this.removeEventListener("cancel", this.#onCancel);
  }
  attributeChangedCallback(name: string): void {
    if (name === "open") {
      this.controlled = true;
      this.openState = this.hasAttribute("open");
    }
    this.deferSync();
  }
  protected sync(): void {
    this.initializeOpen();
    const trigger = this.querySelector<HTMLButtonElement>(`${O_MODAL_TRIGGER_TAG} > button`);
    const popup = this.querySelector<OptimizedModalPopupElement>(O_MODAL_POPUP_TAG);
    const dialog = popup?.querySelector("dialog") ?? null;
    if (!trigger || !popup || !dialog) return;
    this.#dialog = dialog;
    trigger.id ||= nextId(`${O_MODAL_TRIGGER_TAG}-button`);
    popup.id ||= nextId(O_MODAL_POPUP_TAG);
    trigger.setAttribute("aria-haspopup", "dialog");
    trigger.setAttribute("aria-expanded", String(this.openState));
    trigger.setAttribute("aria-controls", popup.id);
    trigger.toggleAttribute("disabled", this.disabled);
    trigger.style.cursor = this.disabled ? "not-allowed" : "pointer";
    for (const node of [trigger.parentElement!, popup, dialog]) {
      node.toggleAttribute("data-open", this.openState);
      node.toggleAttribute("data-closed", !this.openState);
      node.toggleAttribute("data-disabled", this.disabled);
    }
    if (this.openState && !dialog.open) {
      if (typeof dialog.showModal === "function") dialog.showModal();
      else dialog.setAttribute("open", "");
    }
    if (!this.openState && dialog.open) {
      if (typeof dialog.close === "function") dialog.close();
      else dialog.removeAttribute("open");
      this.#restore?.focus();
    }
  }
}

const definitions: Array<[string, CustomElementConstructor]> = [
  [O_MODAL_TAG, OptimizedModalElement],
  [O_MODAL_TRIGGER_TAG, OptimizedModalTriggerElement],
  [O_MODAL_POPUP_TAG, OptimizedModalPopupElement],
  [O_MODAL_CLOSE_TAG, OptimizedModalCloseElement],
];
for (const [tag, constructor] of definitions)
  if (!customElements.get(tag)) customElements.define(tag, constructor);
