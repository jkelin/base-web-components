import slideOutCSS from "./slide-out.css?inline";
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
  observeSlotSubtree,
  requireSlottedElement,
  setAttributeValue,
  stringProp,
  toggleState,
  type ChangeCallback,
} from "../shared";

if (typeof document !== "undefined" && !document.getElementById("bwc-slide-out-style")) {
  const style = document.createElement("style");
  style.id = "bwc-slide-out-style";
  style.textContent = slideOutCSS;
  document.head.append(style);
}

export const BWC_SLIDE_OUT_TAG = "bwc-slide-out";

const sides = ["left", "right"] as const;
type Side = (typeof sides)[number];

export type BwcSlideOutElement = HTMLElement & {
  open: boolean;
  defaultOpen: boolean;
  disabled: boolean;
  side: Side;
  triggerClass: string;
  panelClass: string;
  closeClass: string;
  onOpenChange: ChangeCallback<boolean>;
};

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export const BwcSlideOutElement = defineComponent<BwcSlideOutElement>(BWC_SLIDE_OUT_TAG, () => {
  const host = useHost<BwcSlideOutElement>();
  let controlled = host.hasAttribute("open") || Object.hasOwn(host, "open");
  const openState = signal(false);
  const parts = signal<{
    closeButtons: HTMLButtonElement[];
    panel: HTMLElement;
    trigger: HTMLButtonElement;
  } | null>(null);
  const topologyRevision = signal(0);
  const classRevision = signal(0);
  let topologyVersion = 0;
  let classVersion = 0;
  let initialized = false;
  let wasOpen = false;
  let restoreFocus: HTMLElement | null = null;
  let addedPanelTabindex = false;
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
  const side = useProp<Side>("side", enumProp("side", sides, "right"));
  const triggerClass = useProp<string>("triggerClass", stringProp("trigger-class"));
  const panelClass = useProp<string>("panelClass", stringProp("panel-class"));
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

  // The dismiss overlay lives in shadow DOM so it paints below the slotted
  // panel with no author markup; the panel itself stays light DOM for
  // Tailwind/author styling via slide-out.css.
  const overlay = () => host.shadowRoot?.querySelector<HTMLElement>("[data-overlay]") ?? null;

  const focusPanel = (panel: HTMLElement) => {
    restoreFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const target = panel.querySelector<HTMLElement>(FOCUSABLE);
    if (target) {
      target.focus();
      return;
    }
    if (!panel.hasAttribute("tabindex")) {
      panel.setAttribute("tabindex", "-1");
      addedPanelTabindex = true;
    }
    panel.focus();
  };

  const restoreTriggerFocus = (trigger: HTMLButtonElement) => {
    const panel = parts()?.panel;
    if (panel && addedPanelTabindex) {
      panel.removeAttribute("tabindex");
      addedPanelTabindex = false;
    }
    (restoreFocus ?? trigger).focus();
    restoreFocus = null;
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
    const overlayNode = overlay();
    const onOverlayClick = () => requestOpen(false);
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
    const keydown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && openState()) {
        event.preventDefault();
        requestOpen(false);
      }
    };
    const cleanup = () => {
      host.removeEventListener("click", click);
      document.removeEventListener("keydown", keydown);
      overlayNode?.removeEventListener("click", onOverlayClick);
      stopObserver?.();
      stopConfig?.();
      stopState?.();
      stopClasses?.();
      stopControl?.();
      stopTopology?.();
      parts(null);
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

        const panel = requireSlottedElement(host, "panel", HTMLElement);
        const trigger = requireSlottedElement(host, "trigger", HTMLButtonElement);
        const closeButtons = [
          ...panel.querySelectorAll<HTMLButtonElement>("button[data-close]"),
        ].filter((button) => belongsToHost(button, host));
        panel.id ||= nextId("bwc-slide-out-panel");
        panel.dataset.testid ||= "bwc-slide-out-panel";
        setAttributeValue(panel, "role", "dialog");
        setAttributeValue(panel, "aria-modal", "false");
        trigger.id ||= nextId("bwc-slide-out-trigger");
        setAttributeValue(trigger, "aria-haspopup", "dialog");
        setAttributeValue(trigger, "aria-controls", panel.id);
        for (const button of closeButtons) {
          button.id ||= nextId("bwc-slide-out-close");
        }
        parts({ closeButtons, panel, trigger });
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
          "slide-out-trigger",
          "bwc-slide-out-trigger",
          currentParts.trigger.className,
        );
        applyPartClass(currentParts.trigger, "slide-out-trigger", triggerClass());
        applyPartClass(currentParts.panel, "slide-out-panel", panelClass());
        for (const button of currentParts.closeButtons) {
          decorateButton(button, "slide-out-close", "bwc-slide-out-close", button.className);
          applyPartClass(button, "slide-out-close", closeClass());
        }
      });
      stopState = effect(() => {
        const currentParts = parts();
        if (!currentParts) return;
        const isOpen = openState();
        const isDisabled = disabled();
        const { panel, trigger } = currentParts;
        if (trigger.disabled !== isDisabled) trigger.disabled = isDisabled;
        const cursor = isDisabled ? "not-allowed" : "pointer";
        if (trigger.style.cursor !== cursor) trigger.style.cursor = cursor;
        setAttributeValue(trigger, "aria-expanded", String(isOpen));
        for (const node of [trigger, panel]) {
          toggleState(node, "data-open", isOpen);
          toggleState(node, "data-closed", !isOpen);
          toggleState(node, "data-disabled", isDisabled);
        }

        const veil = overlay();
        if (veil) veil.hidden = !isOpen;
        if (isOpen && !wasOpen) focusPanel(panel);
        else if (!isOpen && wasOpen) restoreTriggerFocus(trigger);
        wasOpen = isOpen;
      });
      stopConfig = effect(() => {
        const currentParts = parts();
        if (!currentParts) return;
        const currentSide = side();
        if (currentParts.panel.dataset.side !== currentSide) {
          currentParts.panel.dataset.side = currentSide;
        }
      });
      host.addEventListener("click", click);
      document.addEventListener("keydown", keydown);
      overlayNode?.addEventListener("click", onOverlayClick);
      return cleanup;
    } catch (error) {
      cleanup();
      throw error;
    }
  });

  // Shadow overlay first so the slotted panel paints above it; hidden until
  // the state effect opens (also hides the pre-upgrade flash via CSS).
  return html`<div
      data-overlay
      data-testid="bwc-slide-out-overlay"
      hidden
      style="position:fixed;inset:0;z-index:40;background:rgb(0 0 0 / 0.4);cursor:pointer"
    ></div>
    <slot name="trigger"></slot><slot name="panel"></slot>`;
});
