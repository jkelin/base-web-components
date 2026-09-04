import { P, LightElement, nextId, TextButton, OpenRoot } from "./shared";

export class SveltePopoverElement extends OpenRoot {
  static override observedAttributes = ["open", "disabled", "side", "side-offset"];
  #cleanup: (() => void) | undefined;
  #openedOnce = false;
  override rootClick = (event: Event) => {
    const node = (event.target as Element).closest(`${P}-popover-trigger,${P}-popover-close`);
    if (!node || !this.contains(node)) return;
    this.request(node.localName.endsWith("trigger") ? !this.isOpen : false);
  };
  override sync() {
    const side = this.getAttribute("side") ?? "bottom";
    if (!["top", "right", "bottom", "left"].includes(side))
      throw new TypeError("popover side must be top, right, bottom, or left");
    const offset = Number(this.getAttribute("side-offset") ?? 0);
    if (!Number.isFinite(offset)) throw new TypeError("popover sideOffset must be finite");
    const trigger = this.querySelector(`${P}-popover-trigger`) as HTMLElement | null;
    const popup = this.querySelector(`${P}-popover-popup`) as HTMLElement | null;
    if (!trigger || !popup) return;
    const control = trigger.querySelector("button") ?? trigger;
    control.id ||= nextId(trigger, `${P}-popover-trigger-button`, "button");
    popup.id ||= nextId(popup, `${P}-popover-popup`, "popup");
    control.setAttribute("aria-haspopup", "dialog");
    control.setAttribute("aria-expanded", String(this.isOpen));
    control.setAttribute("aria-controls", popup.id);
    popup.setAttribute("role", "dialog");
    popup.setAttribute("data-side", side);
    popup.toggleAttribute("data-open", this.isOpen);
    popup.toggleAttribute("data-closed", !this.isOpen);
    popup.toggleAttribute("popover", true);
    if (this.isOpen) {
      this.#openedOnce = true;
      try {
        (popup as HTMLElement & { showPopover(): void }).showPopover();
      } catch {
        popup.removeAttribute("hidden");
      }
      this.position(control as HTMLElement, popup, side, offset);
      this.#cleanup?.();
      const update = () => this.position(control as HTMLElement, popup, side, offset);
      addEventListener("resize", update);
      addEventListener("scroll", update, true);
      this.#cleanup = () => {
        removeEventListener("resize", update);
        removeEventListener("scroll", update, true);
      };
    } else {
      try {
        (popup as HTMLElement & { hidePopover(): void }).hidePopover();
      } catch {
        popup.setAttribute("hidden", "");
      }
      this.#cleanup?.();
      this.#cleanup = undefined;
      if (this.#openedOnce) control.focus();
    }
    popup.onbeforetoggle = (event) => {
      if ((event as ToggleEvent).newState === "closed" && this.isOpen) this.request(false);
    };
  }
  override disconnectedCallback() {
    this.#cleanup?.();
    super.disconnectedCallback();
  }
  position(trigger: HTMLElement, popup: HTMLElement, side: string, offset: number) {
    const r = trigger.getBoundingClientRect();
    let x = r.left,
      y = r.bottom + offset;
    if (side === "top") y = r.top - offset;
    if (side === "right") {
      x = r.right + offset;
      y = r.top;
    }
    if (side === "left") {
      x = r.left - offset;
      y = r.top;
    }
    popup.style.setProperty("--popover-anchor-x", `${x}px`);
    popup.style.setProperty("--popover-anchor-y", `${y}px`);
    popup.style.position = "fixed";
    popup.style.left = "var(--popover-anchor-x)";
    popup.style.top = "var(--popover-anchor-y)";
  }
}
export class SveltePopoverTriggerElement extends TextButton {
  override marker = "popover-trigger";
}
export class SveltePopoverCloseElement extends TextButton {
  override marker = "popover-close";
}
export class SveltePopoverPopupElement extends LightElement {}
