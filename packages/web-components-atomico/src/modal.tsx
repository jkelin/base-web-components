import { nextId, ControlLeaf, OpenController } from "./shared";

export const ATOMICO_MODAL_TAG = "atomico-modal";
export const ATOMICO_MODAL_TRIGGER_TAG = "atomico-modal-trigger";
export const ATOMICO_MODAL_POPUP_TAG = "atomico-modal-popup";
export const ATOMICO_MODAL_CLOSE_TAG = "atomico-modal-close";
export class AtomicoModalTriggerElement extends ControlLeaf {
  static override marker = "modal-trigger";
}
export class AtomicoModalCloseElement extends ControlLeaf {
  static override marker = "modal-close";
}
export class AtomicoModalPopupElement extends ControlLeaf {
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

export class AtomicoModalElement extends OpenController {
  static observedAttributes = ["open", "default-open", "disabled"];
  #restore: HTMLElement | null = null;
  #dialog: HTMLDialogElement | null = null;
  #onClick = (event: MouseEvent) => {
    const target = event.target as Element;
    if (target.closest(`${ATOMICO_MODAL_TRIGGER_TAG} > button`)) {
      this.#restore = target as HTMLElement;
      this.requestOpen(true);
    }
    if (target.closest(`${ATOMICO_MODAL_CLOSE_TAG} > button`)) this.requestOpen(false);
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
    const trigger = this.querySelector<HTMLButtonElement>(`${ATOMICO_MODAL_TRIGGER_TAG} > button`);
    const popup = this.querySelector<AtomicoModalPopupElement>(ATOMICO_MODAL_POPUP_TAG);
    const dialog = popup?.querySelector("dialog") ?? null;
    if (!trigger || !popup || !dialog) return;
    this.#dialog = dialog;
    trigger.id ||= nextId(`${ATOMICO_MODAL_TRIGGER_TAG}-button`);
    popup.id ||= nextId(ATOMICO_MODAL_POPUP_TAG);
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

export const modalDefinitions: ReadonlyArray<readonly [string, CustomElementConstructor]> = [
  [ATOMICO_MODAL_TAG, AtomicoModalElement],
  [ATOMICO_MODAL_TRIGGER_TAG, AtomicoModalTriggerElement],
  [ATOMICO_MODAL_POPUP_TAG, AtomicoModalPopupElement],
  [ATOMICO_MODAL_CLOSE_TAG, AtomicoModalCloseElement],
];
