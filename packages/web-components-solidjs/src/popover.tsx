import { createEffect, onCleanup } from "solid-js";
import { customElement } from "solid-element";
import {
  type ChangeCallback,
  booleanProp,
  classProp,
  createControl,
  emit,
  enumValue,
  finiteNumber,
  initializeBooleanProps,
  nextId,
  preserveChildren,
  reflectedProp,
  type SolidElementHost,
  useLightDom,
  watchChildren,
} from "./shared";

export const SOLID_POPOVER_TAG = "solid-popover";
export const SOLID_POPOVER_TRIGGER_TAG = "solid-popover-trigger";
export const SOLID_POPOVER_POPUP_TAG = "solid-popover-popup";
export const SOLID_POPOVER_CLOSE_TAG = "solid-popover-close";
type Side = "top" | "right" | "bottom" | "left";
const SIDES = ["top", "right", "bottom", "left"] as const;

interface ControlProps {
  hostClass: string;
  disabled: boolean;
}

const controlProps = { hostClass: classProp, disabled: booleanProp("disabled") };

export const SolidPopoverTriggerElement = customElement<ControlProps>(
  SOLID_POPOVER_TRIGGER_TAG,
  controlProps,
  (props, { element }) =>
    createControl(element as unknown as SolidElementHost, props, "button", "popover-trigger"),
);

export const SolidPopoverCloseElement = customElement<ControlProps>(
  SOLID_POPOVER_CLOSE_TAG,
  controlProps,
  (props, { element }) =>
    createControl(element as unknown as SolidElementHost, props, "button", "popover-close"),
);

export const SolidPopoverPopupElement = customElement<ControlProps>(
  SOLID_POPOVER_POPUP_TAG,
  controlProps,
  (props, { element }) =>
    createControl(element as unknown as SolidElementHost, props, "div", "popover-popup"),
);

interface PopoverProps {
  open: boolean;
  defaultOpen: boolean;
  disabled: boolean;
  side: Side;
  sideOffset: number;
  onOpenChange: ChangeCallback<boolean>;
}

export const SolidPopoverElement = customElement<PopoverProps>(
  SOLID_POPOVER_TAG,
  {
    open: booleanProp("open", false),
    defaultOpen: booleanProp("default-open"),
    disabled: booleanProp("disabled"),
    side: reflectedProp<Side>("bottom", "side"),
    sideOffset: reflectedProp(0, "side-offset"),
    onOpenChange: null,
  },
  (props, { element }) => {
    useLightDom();
    const host = element as unknown as SolidElementHost & PopoverProps;
    preserveChildren(host);
    initializeBooleanProps(host, {
      open: "open",
      defaultOpen: "default-open",
      disabled: "disabled",
    });

    let controlled = host.hasAttribute("open");
    let internalWrite = false;
    let trigger: HTMLButtonElement | null = null;
    let popup: HTMLElement | null = null;
    host.addPropertyChangedCallback((name) => {
      if (name === "open" && !internalWrite) controlled = true;
    });
    const setOpen = (open: boolean): void => {
      internalWrite = true;
      host.open = open;
      internalWrite = false;
    };
    setOpen(controlled ? host.hasAttribute("open") : host.hasAttribute("default-open"));

    const side = (): Side => enumValue(props.side, SIDES, "bottom", "side");
    const offset = (): number => finiteNumber(props.sideOffset ?? 0, "sideOffset");
    const requestOpen = (open: boolean): void => {
      if (host.hasAttribute("disabled") || open === Boolean(props.open)) return;
      emit(host, props.onOpenChange, "open-change", "open", open);
      if (!controlled) setOpen(open);
    };
    const position = (): void => {
      if (!trigger || !popup || !props.open) return;
      const rect = trigger.getBoundingClientRect();
      const distance = offset();
      popup.style.setProperty("--anchor-left", `${rect.left}px`);
      popup.style.setProperty("--anchor-top", `${rect.top}px`);
      popup.style.setProperty("--anchor-width", `${rect.width}px`);
      popup.style.setProperty("--anchor-height", `${rect.height}px`);
      popup.style.position = "fixed";
      if (side() === "bottom") {
        popup.style.left = `${rect.left}px`;
        popup.style.top = `${rect.bottom + distance}px`;
      }
      if (side() === "top") {
        popup.style.left = `${rect.left}px`;
        popup.style.top = `${rect.top - popup.offsetHeight - distance}px`;
      }
      if (side() === "right") {
        popup.style.left = `${rect.right + distance}px`;
        popup.style.top = `${rect.top}px`;
      }
      if (side() === "left") {
        popup.style.left = `${rect.left - popup.offsetWidth - distance}px`;
        popup.style.top = `${rect.top}px`;
      }
    };
    const sync = (): void => {
      const open = Boolean(props.open);
      const placement = side();
      offset();
      trigger = host.querySelector(`${SOLID_POPOVER_TRIGGER_TAG} > button`);
      popup = host.querySelector(`${SOLID_POPOVER_POPUP_TAG} > div`);
      if (!trigger || !popup) return;
      const triggerHost = trigger.parentElement!;
      const popupHost = popup.parentElement!;
      const disabled = host.hasAttribute("disabled");
      popupHost.id ||= nextId(SOLID_POPOVER_POPUP_TAG);
      popup.setAttribute("popover", "auto");
      popup.setAttribute("role", "dialog");
      trigger.setAttribute("aria-haspopup", "dialog");
      trigger.setAttribute("aria-expanded", String(open));
      trigger.setAttribute("aria-controls", popupHost.id);
      trigger.toggleAttribute("disabled", disabled);
      trigger.style.cursor = disabled ? "not-allowed" : "pointer";
      for (const node of [triggerHost, popupHost, popup]) {
        node.toggleAttribute("data-open", open);
        node.toggleAttribute("data-closed", !open);
        node.toggleAttribute("data-disabled", disabled);
      }
      popupHost.dataset.side = popup.dataset.side = placement;
      const shown = popup.matches(":popover-open");
      if (open && !shown) {
        if (typeof popup.showPopover === "function") popup.showPopover();
        else popup.hidden = false;
      }
      if (!open && shown) popup.hidePopover();
      if (!open && typeof popup.showPopover !== "function") popup.hidden = true;
      position();
    };
    side();
    offset();
    createEffect(sync);
    watchChildren(host, sync);

    const onClick = (event: Event): void => {
      const target = event.target as Element;
      if (target.closest(`${SOLID_POPOVER_TRIGGER_TAG} > button`)) requestOpen(!props.open);
      if (target.closest(`${SOLID_POPOVER_CLOSE_TAG} > button`)) requestOpen(false);
    };
    const onToggle = (event: Event): void => {
      if ((event as ToggleEvent).newState !== "closed" || !props.open) return;
      requestOpen(false);
      if (controlled) queueMicrotask(sync);
    };
    host.addEventListener("click", onClick);
    host.addEventListener("toggle", onToggle);
    window.addEventListener("resize", position);
    window.addEventListener("scroll", position, true);
    onCleanup(() => {
      host.removeEventListener("click", onClick);
      host.removeEventListener("toggle", onToggle);
      window.removeEventListener("resize", position);
      window.removeEventListener("scroll", position, true);
    });
  },
);
