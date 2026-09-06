import popoverCSS from "./popover.css?inline";
import { defineComponent, effect, html, onMount, signal, useHost, useProp } from "microfw";
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
  setAttributeValue,
  stringProp,
  toggleState,
  type ChangeCallback,
} from "../shared";

if (typeof document !== "undefined" && !document.getElementById("bwc-popover-style")) {
  const style = document.createElement("style");
  style.id = "bwc-popover-style";
  style.textContent = popoverCSS;
  document.head.append(style);
}

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

export const BwcPopoverElement = defineComponent<BwcPopoverElement>("bwc-popover", () => {
  const host = useHost<BwcPopoverElement>();
  let controlled = host.hasAttribute("open") || Object.hasOwn(host, "open");
  const openState = signal(false);
  const parts = signal<{
    closeButtons: HTMLButtonElement[];
    popup: HTMLDivElement;
    trigger: HTMLButtonElement;
  } | null>(null);
  const topologyRevision = signal(0);
  const classRevision = signal(0);
  const nativeRevision = signal(0);
  let topologyVersion = 0;
  let classVersion = 0;
  let nativeVersion = 0;
  let initialized = false;
  let activePopup: HTMLDivElement | null = null;
  const shownPopups = new WeakSet<HTMLDivElement>();
  const classControllers = new WeakMap<HTMLElement, (partClass?: string | null) => void>();

  const open = useProp<boolean>("open", {
    ...booleanProp("open"),
    get: () => openState(),
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
  openState(controlled ? open() : defaultOpen());

  const applyPartClass = (part: HTMLElement, marker: string, value: string) => {
    let apply = classControllers.get(part);
    if (!apply) {
      apply = createPartClassController(part, marker, value);
      classControllers.set(part, apply);
    }
    apply(value);
  };

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

  const requestOpen = (next: boolean) => {
    if (disabled() || next === openState()) return;
    emit(host, onOpenChange(), "open-change", "open", next);
    if (controlled) return;

    try {
      openState(next);
    } catch (error) {
      openState(!next);
      throw error;
    }
  };

  onMount(() => {
    let stopObserver: (() => void) | undefined;
    let stopTopology: (() => void) | undefined;
    let stopControl: (() => void) | undefined;
    let stopClasses: (() => void) | undefined;
    let stopState: (() => void) | undefined;
    let stopConfig: (() => void) | undefined;
    const click = (event: MouseEvent) => {
      const target = event.target;
      const currentParts = parts();
      if (!(target instanceof Element) || !currentParts) return;
      if (currentParts.trigger.contains(target)) {
        requestOpen(!openState());
        return;
      }
      const close = target.closest<HTMLButtonElement>("button[data-close]");
      if (close && currentParts.closeButtons.includes(close)) requestOpen(false);
    };
    const toggle = (event: Event) => {
      const currentParts = parts();
      const nextState = (event as ToggleEvent).newState;
      if (
        !currentParts ||
        event.target !== currentParts.popup ||
        nextState !== "closed" ||
        !openState()
      ) {
        return;
      }
      shownPopups.delete(currentParts.popup);
      emit(host, onOpenChange(), "open-change", "open", false);
      if (controlled) {
        queueMicrotask(() => {
          if (host.isConnected && openState()) nativeRevision(++nativeVersion);
        });
      } else {
        openState(false);
      }
    };
    const cleanup = () => {
      host.removeEventListener("click", click);
      host.removeEventListener("toggle", toggle, true);
      stopObserver?.();
      stopConfig?.();
      stopState?.();
      stopClasses?.();
      stopControl?.();
      stopTopology?.();
      parts(null);
      if (activePopup) hide(activePopup);
      activePopup = null;
    };

    try {
      stopObserver = observeSlotSubtree(
        host,
        (records) => {
          if (
            records.length === 0 ||
            records.some(
              (record) =>
                record.type === "childList" ||
                record.attributeName === "slot" ||
                record.attributeName === "data-close",
            )
          ) {
            topologyRevision(++topologyVersion);
          } else {
            classRevision(++classVersion);
          }
        },
        ["class", "data-close", "slot"],
      );
      stopTopology = effect(() => {
        topologyRevision();
        parts(null);
        if (activePopup) hide(activePopup);
        activePopup = null;

        const popup = requireSlottedElement(host, "popup", HTMLDivElement);
        const trigger = requireSlottedElement(host, "trigger", HTMLButtonElement);
        const closeButtons = [
          ...popup.querySelectorAll<HTMLButtonElement>("button[data-close]"),
        ].filter((button) => belongsToHost(button, host));
        activePopup = popup;
        popup.id ||= nextId("bwc-popover-popup");
        popup.dataset.testid ||= "bwc-popover-popup";
        setAttributeValue(popup, "popover", "auto");
        setAttributeValue(popup, "role", "dialog");
        trigger.id ||= nextId("bwc-popover-trigger");
        setAttributeValue(trigger, "aria-haspopup", "dialog");
        setAttributeValue(trigger, "aria-controls", popup.id);
        for (const button of closeButtons) {
          button.id ||= nextId("bwc-popover-close");
        }
        parts({ closeButtons, popup, trigger });
      });
      stopControl = effect(() => {
        const next = open();
        if (next) controlled = true;
        if (!initialized) {
          initialized = true;
          openState(controlled ? next : defaultOpen());
        } else if (next) {
          openState(true);
        } else if (controlled) {
          openState(false);
        }
      });
      stopClasses = effect(() => {
        classRevision();
        const currentParts = parts();
        if (!currentParts) return;
        decorateButton(
          currentParts.trigger,
          "popover-trigger",
          "bwc-popover-trigger",
          currentParts.trigger.className,
        );
        applyPartClass(currentParts.trigger, "popover-trigger", triggerClass());
        applyPartClass(currentParts.popup, "popover-popup", popupClass());
        for (const button of currentParts.closeButtons) {
          decorateButton(button, "popover-close", "bwc-popover-close", button.className);
          applyPartClass(button, "popover-close", closeClass());
        }
      });
      stopState = effect(() => {
        nativeRevision();
        const currentParts = parts();
        if (!currentParts) return;
        const isOpen = openState();
        const isDisabled = disabled();
        const { popup, trigger } = currentParts;
        if (trigger.disabled !== isDisabled) trigger.disabled = isDisabled;
        const cursor = isDisabled ? "not-allowed" : "pointer";
        if (trigger.style.cursor !== cursor) trigger.style.cursor = cursor;
        setAttributeValue(trigger, "aria-expanded", String(isOpen));
        for (const node of [trigger, popup]) {
          toggleState(node, "data-open", isOpen);
          toggleState(node, "data-closed", !isOpen);
          toggleState(node, "data-disabled", isDisabled);
        }

        if (isOpen && !isShown(popup)) {
          try {
            if (typeof popup.showPopover === "function") {
              if (popup.hidden) popup.hidden = false;
              popup.showPopover({ source: trigger });
            } else {
              if (popup.hidden) popup.hidden = false;
            }
            shownPopups.add(popup);
          } catch (error) {
            openState(false);
            if (typeof popup.showPopover !== "function") popup.hidden = true;
            throw error;
          }
        } else if (!isOpen) {
          hide(popup);
        }
      });
      stopConfig = effect(() => {
        const currentParts = parts();
        if (!currentParts) return;
        const { popup } = currentParts;
        const currentSide = side();
        if (popup.dataset.side !== currentSide) popup.dataset.side = currentSide;
        const offset = `${sideOffset()}px`;
        if (popup.style.getPropertyValue("--side-offset") !== offset) {
          popup.style.setProperty("--side-offset", offset);
        }
      });
      host.addEventListener("click", click);
      host.addEventListener("toggle", toggle, true);
      return cleanup;
    } catch (error) {
      cleanup();
      throw error;
    }
  });

  return html`<slot name="trigger"></slot><slot name="popup"></slot>`;
});
