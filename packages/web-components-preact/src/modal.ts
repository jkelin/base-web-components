import { P, nextId, markerClass, define, TextButton, OpenRoot } from "./shared";

export class PreactModalElement extends OpenRoot {
  override rootClick = (event: Event) => {
    const node = (event.target as Element).closest(`${P}-modal-trigger,${P}-modal-close`);
    if (!node || !this.contains(node)) return;
    this.request(node.localName.endsWith("trigger"));
  };
  override sync() {
    const trigger = this.querySelector(`${P}-modal-trigger`);
    const popup = this.querySelector(`${P}-modal-popup`) as PreactModalPopupElement | null;
    if (!trigger || !popup) return;
    const control = trigger.querySelector("button") ?? trigger;
    control.id ||= nextId(trigger as HTMLElement, `${P}-modal-trigger-button`, "button");
    popup.id ||= nextId(popup, `${P}-modal-popup`, "popup");
    control.setAttribute("aria-haspopup", "dialog");
    control.setAttribute("aria-expanded", String(this.isOpen));
    control.setAttribute("aria-controls", popup.id);
    popup.syncDialog(this.isOpen, control as HTMLElement, () => this.request(false));
    this.toggleAttribute("data-open", this.isOpen);
    this.toggleAttribute("data-closed", !this.isOpen);
  }
}
export class PreactModalTriggerElement extends TextButton {
  override marker = "modal-trigger";
}
export class PreactModalCloseElement extends TextButton {
  override marker = "modal-close";
}
export class PreactModalPopupElement extends HTMLElement {
  dialog?: HTMLDialogElement;
  closeRequest: (() => void) | undefined;
  connectedCallback() {
    const children = [...this.childNodes];
    const dialog = document.createElement("dialog");
    dialog.className = markerClass(this, "modal-popup");
    dialog.dataset.testid = this.localName;
    dialog.setAttribute("role", "dialog");
    dialog.addEventListener("cancel", (event) => {
      event.preventDefault();
      this.closeRequest?.();
    });
    dialog.addEventListener("click", (event) => {
      if (event.target === dialog) this.closeRequest?.();
    });
    dialog.append(...children);
    this.append(dialog);
    this.dialog = dialog;
  }
  syncDialog(open: boolean, trigger: HTMLElement, close: () => void) {
    this.closeRequest = close;
    if (!this.dialog) return;
    if (open && !this.dialog.open) {
      try {
        this.dialog.showModal();
      } catch {
        this.dialog.setAttribute("open", "");
      }
    } else if (!open && this.dialog.open) {
      this.dialog.close();
      trigger.focus();
    }
    this.toggleAttribute("data-open", open);
    this.toggleAttribute("data-closed", !open);
  }
}

const definitions: [string, CustomElementConstructor][] = [
  ["preact-modal", PreactModalElement],
  ["preact-modal-trigger", PreactModalTriggerElement],
  ["preact-modal-popup", PreactModalPopupElement],
  ["preact-modal-close", PreactModalCloseElement],
];
for (const [tag, ctor] of definitions) define(tag, ctor);
