import {
  booleanValue,
  callbackValue,
  decorateButton,
  defineComponent,
  emit,
  enumValue,
  finiteNumber,
  nextId,
  observeChildren,
  useEffects,
  type ChangeCallback,
} from "../shared";

export const BWC_POPOVER_TAG = "bwc-popover";
export const BWC_POPOVER_TRIGGER_TAG = `${BWC_POPOVER_TAG}-trigger`;
export const BWC_POPOVER_POPUP_TAG = `${BWC_POPOVER_TAG}-popup`;
export const BWC_POPOVER_CLOSE_TAG = `${BWC_POPOVER_TAG}-close`;

type PopoverState = {
  controlled: boolean;
  initialized: boolean;
  onOpenChange: ChangeCallback<boolean>;
  open: boolean;
};
const sides = ["top", "right", "bottom", "left"] as const;
const popoverProperties = {
  open: "open",
  defaultOpen: "default-open",
  disabled: "disabled",
  side: "side",
  sideOffset: "side-offset",
  onOpenChange: null,
} as const;

export const BwcPopoverElement = defineComponent<
  PopoverState,
  HTMLElement,
  typeof popoverProperties
>(
  BWC_POPOVER_TAG,
  HTMLElement,
  popoverProperties,
  (element, props, context, properties) => {
    const previous = context();
    // Defaults initialize once; reconnects retain the last uncontrolled open state.
    const state: PopoverState =
      "open" in previous
        ? previous
        : {
            controlled: props.open() !== null,
            initialized: false,
            onOpenChange: null,
            open: props.open() !== null,
          };
    context(state);
    const side = () => enumValue(props.side(), sides, "bottom", "side");
    const sideOffset = () =>
      props.sideOffset() === null ? 0 : finiteNumber(props.sideOffset(), "sideOffset");

    const position = () => {
      const trigger = element.querySelector<HTMLButtonElement>(
        `button[is="${BWC_POPOVER_TRIGGER_TAG}"]`,
      );
      const popup = element.querySelector<HTMLDivElement>(`div[is="${BWC_POPOVER_POPUP_TAG}"]`);
      if (!trigger || !popup) return;
      // Static viewport origin for transform-only positioning, never dynamic positioning.
      // Native [popover] UA styles use inset/margins, so own the baseline without reset CSS.
      popup.style.inset = "0 auto auto 0";
      popup.style.margin = "0";
      popup.style.position = "fixed";
      if (!state.open) return;

      const rect = trigger.getBoundingClientRect();
      const offset = sideOffset();
      const currentSide = side();
      popup.style.setProperty("--anchor-left", `${rect.left}px`);
      popup.style.setProperty("--anchor-top", `${rect.top}px`);
      popup.style.setProperty("--anchor-width", `${rect.width}px`);
      popup.style.setProperty("--anchor-height", `${rect.height}px`);
      if (currentSide === "bottom") {
        popup.style.transform = `translate3d(${rect.left}px, ${rect.bottom + offset}px, 0)`;
      } else if (currentSide === "top") {
        popup.style.transform = `translate3d(${rect.left}px, ${rect.top - offset}px, 0) translateY(-100%)`;
      } else if (currentSide === "right") {
        popup.style.transform = `translate3d(${rect.right + offset}px, ${rect.top}px, 0)`;
      } else {
        popup.style.transform = `translate3d(${rect.left - offset}px, ${rect.top}px, 0) translateX(-100%)`;
      }
    };
    const sync = () => {
      if (!state.initialized) {
        state.initialized = true;
        if (!state.controlled) state.open = props.defaultOpen() !== null;
      }
      const trigger = element.querySelector<HTMLButtonElement>(
        `button[is="${BWC_POPOVER_TRIGGER_TAG}"]`,
      );
      const popup = element.querySelector<HTMLDivElement>(`div[is="${BWC_POPOVER_POPUP_TAG}"]`);
      if (!trigger || !popup) return;
      popup.id ||= nextId(BWC_POPOVER_POPUP_TAG);
      popup.setAttribute("popover", "auto");
      popup.setAttribute("role", "dialog");
      trigger.setAttribute("aria-haspopup", "dialog");
      trigger.setAttribute("aria-expanded", String(state.open));
      trigger.setAttribute("aria-controls", popup.id);
      trigger.disabled = props.disabled() !== null;
      decorateButton(
        trigger,
        "popover-trigger",
        BWC_POPOVER_TRIGGER_TAG,
        trigger.className.replace(/(?:^| )popover-trigger(?: |$)/g, " ").trim(),
      );
      for (const node of [trigger, popup]) {
        node.toggleAttribute("data-open", state.open);
        node.toggleAttribute("data-closed", !state.open);
        node.toggleAttribute("data-disabled", props.disabled() !== null);
      }
      popup.dataset.side = side();
      const shown = popup.matches(":popover-open");
      if (state.open && !shown) {
        if (typeof popup.showPopover === "function") popup.showPopover();
        else popup.hidden = false;
      }
      if (!state.open && shown) popup.hidePopover();
      if (!state.open && typeof popup.showPopover !== "function") popup.hidden = true;
      position();
    };

    properties.install({
      open: {
        get: () => state.open,
        set: (next) => {
          state.controlled = true;
          element.toggleAttribute("open", booleanValue(next, "open"));
        },
      },
      defaultOpen: {
        get: () => props.defaultOpen() !== null,
        set: (next) => element.toggleAttribute("default-open", booleanValue(next, "defaultOpen")),
      },
      disabled: {
        get: () => props.disabled() !== null,
        set: (next) => element.toggleAttribute("disabled", booleanValue(next, "disabled")),
      },
      side: {
        get: side,
        set: (next) =>
          element.setAttribute("side", enumValue(String(next), sides, "bottom", "side")),
      },
      sideOffset: {
        get: sideOffset,
        set: (next) =>
          element.setAttribute("side-offset", String(finiteNumber(next, "sideOffset"))),
      },
      onOpenChange: {
        get: () => state.onOpenChange,
        set: (next) => {
          state.onOpenChange = callbackValue<boolean>(next, "onOpenChange");
        },
      },
    });

    const requestOpen = (next: boolean) => {
      if (props.disabled() !== null || next === state.open) return;
      emit(element, state.onOpenChange, "open-change", "open", next);
      if (!state.controlled) {
        state.open = next;
        sync();
      }
    };
    const click = (event: Event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (target.closest(`button[is="${BWC_POPOVER_TRIGGER_TAG}"]`)) {
        requestOpen(!state.open);
      }
      if (target.closest(`button[is="${BWC_POPOVER_CLOSE_TAG}"]`)) requestOpen(false);
    };
    const toggle = (event: Event) => {
      const popup = element.querySelector<HTMLDivElement>(`div[is="${BWC_POPOVER_POPUP_TAG}"]`);
      const nextState = (event as ToggleEvent).newState;
      // Programmatic hides follow a state change; only native closes need synchronization.
      if (event.target !== popup || nextState !== "closed" || !state.open) return;
      emit(element, state.onOpenChange, "open-change", "open", false);
      if (state.controlled) {
        // Reopen after the native toggle finishes so the browser accepts the controlled state.
        queueMicrotask(() => {
          if (element.isConnected && state.open) sync();
        });
      } else {
        state.open = false;
        sync();
      }
    };
    element.addEventListener("click", click);
    element.addEventListener("toggle", toggle, true);
    addEventListener("resize", position);
    addEventListener("scroll", position, true);
    const observer = observeChildren(element, sync);
    const dispose = useEffects(() => {
      if (props.open() !== null) {
        state.controlled = true;
        state.open = true;
      } else if (state.controlled) {
        state.open = false;
      }
      sync();
    });

    return {
      disconnect() {
        dispose();
        element.removeEventListener("click", click);
        element.removeEventListener("toggle", toggle, true);
        removeEventListener("resize", position);
        removeEventListener("scroll", position, true);
        observer.disconnect();
      },
    };
  },
  () => {
    const emptyProperties = {} as const;
    defineComponent<unknown, HTMLButtonElement, typeof emptyProperties>(
      "trigger",
      HTMLButtonElement,
      emptyProperties,
      (element) => {
        decorateButton(element, "popover-trigger", BWC_POPOVER_TRIGGER_TAG, element.className);
      },
    );
    defineComponent<unknown, HTMLDivElement, typeof emptyProperties>(
      "popup",
      HTMLDivElement,
      emptyProperties,
      (element) => {
        element.classList.add("popover-popup");
        element.dataset.testid ||= BWC_POPOVER_POPUP_TAG;
      },
    );
    defineComponent<unknown, HTMLButtonElement, typeof emptyProperties>(
      "close",
      HTMLButtonElement,
      emptyProperties,
      (element) => {
        decorateButton(element, "popover-close", BWC_POPOVER_CLOSE_TAG, element.className);
      },
    );
  },
);
