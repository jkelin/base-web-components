import { defineComponent, effect, html, onMount, useHost, useProp } from "microfw";
import {
  booleanProp,
  belongsToHost,
  callbackProp,
  createPartClassController,
  decorateButton,
  emit,
  enumProp,
  nextId,
  numberProp,
  observeSlotSubtree,
  requireSlottedElement,
  stringProp,
  type ChangeCallback,
} from "../shared";

export const BWC_POPOVER_TAG = "bwc-popover";

const sides = ["top", "right", "bottom", "left"] as const;
type Side = (typeof sides)[number];

export type BwcPopoverElement = HTMLElement & {
  open: boolean;
  defaultOpen: boolean;
  disabled: boolean;
  side: Side;
  sideOffset: number;
  triggerClass: string;
  popupClass: string;
  closeClass: string;
  onOpenChange: ChangeCallback<boolean>;
};

export const BwcPopoverElement = defineComponent<BwcPopoverElement>(BWC_POPOVER_TAG, () => {
  const host = useHost<BwcPopoverElement>();
  let controlled = host.hasAttribute("open") || Object.hasOwn(host, "open");
  let openState = false;
  let initialized = false;
  let activePopup: HTMLDivElement | null = null;
  const shownPopups = new WeakSet<HTMLDivElement>();
  const classControllers = new WeakMap<HTMLElement, (partClass?: string | null) => void>();

  const open = useProp<boolean>("open", {
    ...booleanProp("open"),
    get: () => openState,
    onSet: (value, commit) => {
      controlled = true;
      commit(value);
    },
  });
  const defaultOpen = useProp<boolean>("defaultOpen", booleanProp("default-open"));
  const disabled = useProp<boolean>("disabled", booleanProp("disabled"));
  const side = useProp<Side>("side", enumProp("side", sides, "bottom"));
  const sideOffset = useProp<number>("sideOffset", numberProp("side-offset"));
  const triggerClass = useProp<string>("triggerClass", stringProp("trigger-class"));
  const popupClass = useProp<string>("popupClass", stringProp("popup-class"));
  const closeClass = useProp<string>("closeClass", stringProp("close-class"));
  const onOpenChange = useProp<ChangeCallback<boolean>>(
    "onOpenChange",
    callbackProp<boolean>("onOpenChange"),
  );
  openState = controlled ? open() : defaultOpen();

  const applyPartClass = (part: HTMLElement, marker: string, value: string) => {
    let apply = classControllers.get(part);
    if (!apply) {
      apply = createPartClassController(part, marker, value);
      classControllers.set(part, apply);
    }
    apply(value);
  };

  const parts = () => ({
    popup: requireSlottedElement(host, "popup", HTMLDivElement),
    trigger: requireSlottedElement(host, "trigger", HTMLButtonElement),
  });

  const isShown = (popup: HTMLDivElement) =>
    shownPopups.has(popup) || popup.matches(":popover-open");

  const hide = (popup: HTMLDivElement) => {
    if (typeof popup.hidePopover === "function") {
      if (isShown(popup)) popup.hidePopover();
      popup.hidden = false;
    } else {
      popup.hidden = true;
    }
    shownPopups.delete(popup);
  };

  const position = () => {
    const { popup, trigger } = parts();
    popup.style.inset = "0 auto auto 0";
    popup.style.margin = "0";
    popup.style.position = "fixed";
    if (!openState) return;

    const rect = trigger.getBoundingClientRect();
    const offset = sideOffset();
    popup.style.setProperty("--anchor-left", `${rect.left}px`);
    popup.style.setProperty("--anchor-top", `${rect.top}px`);
    popup.style.setProperty("--anchor-width", `${rect.width}px`);
    popup.style.setProperty("--anchor-height", `${rect.height}px`);
    if (side() === "bottom") {
      popup.style.transform = `translate3d(${rect.left}px, ${rect.bottom + offset}px, 0)`;
    } else if (side() === "top") {
      popup.style.transform = `translate3d(${rect.left}px, ${rect.top - offset}px, 0) translateY(-100%)`;
    } else if (side() === "right") {
      popup.style.transform = `translate3d(${rect.right + offset}px, ${rect.top}px, 0)`;
    } else {
      popup.style.transform = `translate3d(${rect.left - offset}px, ${rect.top}px, 0) translateX(-100%)`;
    }
  };

  const sync = () => {
    const { popup, trigger } = parts();
    if (!initialized) {
      initialized = true;
      if (!controlled) openState = defaultOpen();
    }

    if (activePopup && activePopup !== popup) hide(activePopup);
    activePopup = popup;

    popup.id ||= nextId("bwc-popover-popup");
    popup.dataset.testid ||= "bwc-popover-popup";
    popup.setAttribute("popover", "auto");
    popup.setAttribute("role", "dialog");
    trigger.id ||= nextId("bwc-popover-trigger");
    trigger.disabled = disabled();
    trigger.setAttribute("aria-haspopup", "dialog");
    trigger.setAttribute("aria-controls", popup.id);
    decorateButton(trigger, "popover-trigger", "bwc-popover-trigger", trigger.className);
    applyPartClass(trigger, "popover-trigger", triggerClass());
    applyPartClass(popup, "popover-popup", popupClass());

    const closeButtons = [
      ...popup.querySelectorAll<HTMLButtonElement>("button[data-close]"),
    ].filter((button) => belongsToHost(button, host));
    for (const button of closeButtons) {
      button.id ||= nextId("bwc-popover-close");
      decorateButton(button, "popover-close", "bwc-popover-close", button.className);
      applyPartClass(button, "popover-close", closeClass());
    }

    trigger.setAttribute("aria-expanded", String(openState));
    for (const node of [trigger, popup]) {
      node.toggleAttribute("data-open", openState);
      node.toggleAttribute("data-closed", !openState);
      node.toggleAttribute("data-disabled", disabled());
    }
    popup.dataset.side = side();

    if (openState && !isShown(popup)) {
      try {
        if (typeof popup.showPopover === "function") {
          popup.hidden = false;
          popup.showPopover({ source: trigger });
        } else {
          popup.hidden = false;
        }
        shownPopups.add(popup);
      } catch (error) {
        openState = false;
        if (typeof popup.showPopover !== "function") popup.hidden = true;
        throw error;
      }
    } else if (!openState) {
      hide(popup);
    }
    position();
  };

  const requestOpen = (next: boolean) => {
    if (disabled() || next === openState) return;
    emit(host, onOpenChange(), "open-change", "open", next);
    if (controlled) return;

    openState = next;
    try {
      sync();
    } catch (error) {
      openState = !next;
      throw error;
    }
  };

  onMount(() => {
    // Validate cardinality and native host types before creating effects or listeners.
    parts();
    const view = host.ownerDocument.defaultView;
    let stopObserver: (() => void) | undefined;
    let stopEffect: (() => void) | undefined;

    const click = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const { trigger } = parts();
      if (trigger.contains(target)) {
        requestOpen(!openState);
        return;
      }
      const close = target.closest<HTMLButtonElement>("button[data-close]");
      if (close && belongsToHost(close, host)) requestOpen(false);
    };
    const toggle = (event: Event) => {
      const { popup } = parts();
      const nextState = (event as ToggleEvent).newState;
      if (event.target !== popup || nextState !== "closed" || !openState) return;
      shownPopups.delete(popup);
      emit(host, onOpenChange(), "open-change", "open", false);
      if (controlled) {
        queueMicrotask(() => {
          if (host.isConnected && openState) sync();
        });
      } else {
        openState = false;
        sync();
      }
    };
    const cleanup = () => {
      stopObserver?.();
      stopEffect?.();
      host.removeEventListener("click", click);
      host.removeEventListener("toggle", toggle, true);
      view?.removeEventListener("resize", position);
      view?.removeEventListener("scroll", position, true);
      if (activePopup) hide(activePopup);
      activePopup = null;
    };

    try {
      sync();
      host.addEventListener("click", click);
      host.addEventListener("toggle", toggle, true);
      view?.addEventListener("resize", position);
      view?.addEventListener("scroll", position, true);
      stopEffect = effect(() => {
        const next = open();
        if (next) {
          controlled = true;
          openState = true;
        } else if (controlled) {
          openState = false;
        }
        sync();
      });
      stopObserver = observeSlotSubtree(host, sync, ["class", "data-close"]);
      return cleanup;
    } catch (error) {
      cleanup();
      throw error;
    }
  });

  return html`<slot name="trigger"></slot><slot name="popup"></slot>`;
});
