import { nextId, finiteNumber, enumValue, ControlLeaf, OpenController } from "./shared";

export const VANILLA_POPOVER_TAG = "vanilla-popover";
export const VANILLA_POPOVER_TRIGGER_TAG = "vanilla-popover-trigger";
export const VANILLA_POPOVER_POPUP_TAG = "vanilla-popover-popup";
export const VANILLA_POPOVER_CLOSE_TAG = "vanilla-popover-close";
export class VanillaPopoverTriggerElement extends ControlLeaf {
  static override marker = "popover-trigger";
}
export class VanillaPopoverCloseElement extends ControlLeaf {
  static override marker = "popover-close";
}
export class VanillaPopoverPopupElement extends ControlLeaf {
  static override marker = "popover-popup";
  static override kind = "div" as const;
}

export class VanillaPopoverElement extends OpenController {
  static observedAttributes = ["open", "default-open", "disabled", "side", "side-offset"];
  #trigger: HTMLButtonElement | null = null;
  #popup: HTMLElement | null = null;
  #toggleTarget: HTMLElement | null = null;
  #onClick = (event: Event) => {
    const target = event.target as Element;
    if (target.closest(`${VANILLA_POPOVER_TRIGGER_TAG} > button`))
      this.requestOpen(!this.openState);
    if (target.closest(`${VANILLA_POPOVER_CLOSE_TAG} > button`)) this.requestOpen(false);
  };
  #onToggle = (event: Event) => {
    const toggle = event as ToggleEvent;
    if (toggle.newState === "closed" && this.openState) {
      this.requestOpen(false);
      if (this.controlled) this.deferSync();
    }
  };
  #position = () => {
    if (!this.#trigger || !this.#popup || !this.openState) return;
    const rect = this.#trigger.getBoundingClientRect();
    const popup = this.#popup;
    const offset = this.sideOffset;
    popup.style.setProperty("--anchor-left", `${rect.left}px`);
    popup.style.setProperty("--anchor-top", `${rect.top}px`);
    popup.style.setProperty("--anchor-width", `${rect.width}px`);
    popup.style.setProperty("--anchor-height", `${rect.height}px`);
    popup.style.position = "fixed";
    if (this.side === "bottom") {
      popup.style.left = `${rect.left}px`;
      popup.style.top = `${rect.bottom + offset}px`;
    }
    if (this.side === "top") {
      popup.style.left = `${rect.left}px`;
      popup.style.top = `${rect.top - popup.offsetHeight - offset}px`;
    }
    if (this.side === "right") {
      popup.style.left = `${rect.right + offset}px`;
      popup.style.top = `${rect.top}px`;
    }
    if (this.side === "left") {
      popup.style.left = `${rect.left - popup.offsetWidth - offset}px`;
      popup.style.top = `${rect.top}px`;
    }
  };
  get side(): "top" | "right" | "bottom" | "left" {
    return enumValue(
      this.getAttribute("side"),
      ["top", "right", "bottom", "left"] as const,
      "bottom",
      "side",
    );
  }
  set side(value: "top" | "right" | "bottom" | "left") {
    enumValue(value, ["top", "right", "bottom", "left"] as const, "bottom", "side");
    this.setAttribute("side", value);
  }
  get sideOffset(): number {
    return this.hasAttribute("side-offset")
      ? finiteNumber(this.getAttribute("side-offset"), "sideOffset")
      : 0;
  }
  set sideOffset(value: number) {
    this.setAttribute("side-offset", String(finiteNumber(value, "sideOffset")));
  }
  override connectedCallback(): void {
    super.connectedCallback();
    this.addEventListener("click", this.#onClick);
    this.addEventListener("toggle", this.#onToggle);
    addEventListener("resize", this.#position);
    addEventListener("scroll", this.#position, true);
  }
  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.removeEventListener("click", this.#onClick);
    this.removeEventListener("toggle", this.#onToggle);
    removeEventListener("resize", this.#position);
    removeEventListener("scroll", this.#position, true);
    this.#toggleTarget?.removeEventListener("toggle", this.#onToggle);
    this.#toggleTarget = null;
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
    this.#trigger = this.querySelector(`${VANILLA_POPOVER_TRIGGER_TAG} > button`);
    this.#popup = this.querySelector(`${VANILLA_POPOVER_POPUP_TAG} > div`);
    if (!this.#trigger || !this.#popup) return;
    if (this.#toggleTarget !== this.#popup) {
      this.#toggleTarget?.removeEventListener("toggle", this.#onToggle);
      this.#toggleTarget = this.#popup;
      this.#toggleTarget.addEventListener("toggle", this.#onToggle);
    }
    const triggerHost = this.#trigger.parentElement!;
    const popupHost = this.#popup.parentElement!;
    popupHost.id ||= nextId(VANILLA_POPOVER_POPUP_TAG);
    this.#popup.setAttribute("popover", "auto");
    this.#popup.setAttribute("role", "dialog");
    this.#trigger.setAttribute("aria-haspopup", "dialog");
    this.#trigger.setAttribute("aria-expanded", String(this.openState));
    this.#trigger.setAttribute("aria-controls", popupHost.id);
    this.#trigger.toggleAttribute("disabled", this.disabled);
    this.#trigger.style.cursor = this.disabled ? "not-allowed" : "pointer";
    for (const node of [triggerHost, popupHost, this.#popup]) {
      node.toggleAttribute("data-open", this.openState);
      node.toggleAttribute("data-closed", !this.openState);
      node.toggleAttribute("data-disabled", this.disabled);
    }
    popupHost.dataset.side = this.side;
    this.#popup.dataset.side = this.side;
    const shown = this.#popup.matches(":popover-open");
    if (this.openState && !shown) {
      if (typeof this.#popup.showPopover === "function") this.#popup.showPopover();
      else this.#popup.removeAttribute("hidden");
    }
    if (!this.openState && shown) this.#popup.hidePopover();
    if (!this.openState && typeof this.#popup.showPopover !== "function") this.#popup.hidden = true;
    if (this.openState && typeof this.#popup.showPopover !== "function") this.#popup.hidden = false;
    this.#position();
  }
}

const definitions: Array<[string, CustomElementConstructor]> = [
  [VANILLA_POPOVER_TAG, VanillaPopoverElement],
  [VANILLA_POPOVER_TRIGGER_TAG, VanillaPopoverTriggerElement],
  [VANILLA_POPOVER_POPUP_TAG, VanillaPopoverPopupElement],
  [VANILLA_POPOVER_CLOSE_TAG, VanillaPopoverCloseElement],
];
for (const [tag, constructor] of definitions)
  if (!customElements.get(tag)) customElements.define(tag, constructor);
