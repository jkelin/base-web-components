import alertDialogCSS from "./alert-dialog.css?inline";
import { defineComponent, effect, html, onMount, signal, useHost, useProp } from "microfw";
import {
  booleanProp,
  booleanPropDefaultTrue,
  belongsToHost,
  callbackProp,
  createPartClassController,
  decorateButton,
  emit,
  nextId,
  observeSlotSubtree,
  partClassName,
  removeAttributeValue,
  requireSlottedElement,
  setAttributeValue,
  stringProp,
  toggleState,
  type ChangeCallback,
} from "../shared";
import { acquireScrollLock, releaseScrollLock } from "../floating";

if (typeof document !== "undefined" && !document.getElementById("bwc-alert-dialog-style")) {
  const style = document.createElement("style");
  style.id = "bwc-alert-dialog-style";
  style.textContent = alertDialogCSS;
  document.head.append(style);
}

/**
 * Total exit-transition time for the popup in ms (duration + delay, longest
 * channel). Zero when author CSS sets no transition/animation, in which case
 * close finishes synchronously (also the jsdom/happy-dom path in tests).
 */
function transitionTotalMs(element: HTMLElement): number {
  try {
    const style = getComputedStyle(element);
    const durations = `${style.transitionDuration ?? ""},${style.animationDuration ?? ""}`.split(
      ",",
    );
    const delays = `${style.transitionDelay ?? ""},${style.animationDelay ?? ""}`.split(",");
    return durations.reduce((max, part, index) => {
      const total =
        Number.parseFloat(part) * 1000 +
        Number.parseFloat(delays[index % delays.length] ?? "0") * 1000;
      return Number.isFinite(total) ? Math.max(max, total) : max;
    }, 0);
  } catch {
    return 0;
  }
}

type FocusTarget = Element | string | null;

/** Element-or-selector codec for `initial-focus` / `final-focus`. */
const focusTargetProp = (attribute: string) => ({
  attribute,
  defaultValue: null as FocusTarget,
  fromAttribute: (raw: string | null): FocusTarget => (raw === null || raw === "" ? null : raw),
  fromProperty: (raw: unknown): FocusTarget => {
    if (raw === null || raw instanceof Element || typeof raw === "string") return raw;
    throw new TypeError(`${attribute} must be an element, selector, or null`);
  },
  toAttribute: (value: FocusTarget) => (typeof value === "string" ? value : null),
});

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export type BwcAlertDialogElement = HTMLElement & {
  open: boolean;
  defaultOpen: boolean;
  disabled: boolean;
  /** Modal: render a backdrop, lock scroll, outside/Escape dismiss. Default true. */
  modal: boolean;
  /** Element or selector focused on open; defaults to the popup. */
  initialFocus: FocusTarget;
  /** Element or selector focused on close; defaults to the trigger. */
  finalFocus: FocusTarget;
  triggerClass: string;
  popupClass: string;
  actionClass: string;
  cancelClass: string;
  closeClass: string;
  backdropClass: string;
  titleClass: string;
  descriptionClass: string;
  onOpenChange: ChangeCallback<boolean>;
  /** Imperative open. Respects `disabled`; applies and notifies in controlled mode. */
  show: () => void;
  /** Imperative close. Applies and notifies in controlled mode. */
  close: () => void;
  /** Toggle, or force with a boolean. Applies and notifies in controlled mode. */
  toggle: (force?: boolean) => void;
};

export const BwcAlertDialogElement = defineComponent<BwcAlertDialogElement>(
  "bwc-alert-dialog",
  () => {
    const host = useHost<BwcAlertDialogElement>();
    let controlled = host.hasAttribute("open") || Object.hasOwn(host, "open");
    const openState = signal(false);
    const parts = signal<{
      trigger: HTMLButtonElement;
      popup: HTMLDivElement;
      actionButtons: HTMLButtonElement[];
      cancelButtons: HTMLButtonElement[];
      closeButtons: HTMLButtonElement[];
      title: HTMLElement | null;
      description: HTMLElement | null;
    } | null>(null);
    const modal = useProp<boolean>("modal", booleanPropDefaultTrue("modal"));
    const initialFocus = useProp<FocusTarget>("initialFocus", focusTargetProp("initial-focus"));
    const finalFocus = useProp<FocusTarget>("finalFocus", focusTargetProp("final-focus"));
    const backdropClass = useProp<string>("backdropClass", stringProp("backdrop-class"));
    const titleClass = useProp<string>("titleClass", stringProp("title-class"));
    const descriptionClass = useProp<string>("descriptionClass", stringProp("description-class"));
    const actionClass = useProp<string>("actionClass", stringProp("action-class"));
    const cancelClass = useProp<string>("cancelClass", stringProp("cancel-class"));
    const topologyRevision = signal(0);
    const classRevision = signal(0);
    let topologyVersion = 0;
    let classVersion = 0;
    let initialized = false;
    let scrollHeld = false;
    let wasOpen = false;
    const classControllers = new WeakMap<HTMLElement, (partClass?: string | null) => void>();

    const open = useProp<boolean>("open", {
      ...booleanProp("open"),
      get: () => openState(),
      onSet: (value, commit) => {
        controlled = true;
        if (initialized) requestOpen(value, true);
        commit(value);
      },
    });
    const defaultOpen = useProp<boolean>("defaultOpen", booleanProp("default-open"));
    const disabled = useProp<boolean>("disabled", booleanProp("disabled"));
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

    const lockScroll = () => {
      if (!scrollHeld) {
        scrollHeld = true;
        acquireScrollLock(host);
      }
    };
    const unlockScroll = () => {
      if (scrollHeld) {
        scrollHeld = false;
        releaseScrollLock(host);
      }
    };

    // Modal backdrop: a plain fixed layer on `document.body` behind the popup.
    // Clicking it requests close (outside handling for dialogs).
    let backdrop: HTMLDivElement | null = null;
    const paintBackdrop = () => {
      if (!backdrop) return;
      const className = partClassName("alert-dialog-backdrop", backdropClass());
      if (backdrop.className !== className) backdrop.className = className;
    };
    const ensureBackdrop = (): HTMLDivElement => {
      if (!backdrop) {
        const element = document.createElement("div");
        element.dataset.testid = "bwc-alert-dialog-backdrop";
        element.setAttribute("data-backdrop", "");
        element.addEventListener("click", () => requestOpen(false));
        backdrop = element;
      }
      paintBackdrop();
      if (!backdrop.isConnected) document.body.append(backdrop);
      return backdrop;
    };
    const removeBackdrop = () => {
      backdrop?.remove();
    };

    const resolveFocusTarget = (value: FocusTarget): HTMLElement | null => {
      if (value instanceof HTMLElement) return value;
      if (typeof value === "string") {
        const scope = host.isConnected ? host.ownerDocument : document;
        return (host.querySelector(value) ?? scope.querySelector(value)) as HTMLElement | null;
      }
      return null;
    };

    // Exit-animation state: while `exiting`, the popup keeps `data-ending-style`
    // until its transition finishes (or a fallback timer fires); the finish
    // step hides it, drops the backdrop, releases the lock, and parks focus.
    // Without a transition the finish runs synchronously.
    let exiting = false;
    let exitTimer = 0;
    let exitDetach: (() => void) | null = null;
    const cancelExit = () => {
      if (!exiting) return;
      exiting = false;
      if (exitTimer) window.clearTimeout(exitTimer);
      exitTimer = 0;
      exitDetach?.();
      exitDetach = null;
    };
    const beginExit = (popup: HTMLDivElement, finish: () => void) => {
      if (exiting) return;
      cancelStartingStyle();
      popup.removeAttribute("data-starting-style");
      const total = transitionTotalMs(popup);
      if (total <= 0) {
        finish();
        return;
      }
      exiting = true;
      popup.setAttribute("data-ending-style", "");
      // Flush styles so the ending frame transitions from the open frame.
      void popup.offsetWidth;
      const done = () => {
        if (!exiting) return;
        exiting = false;
        exitTimer = 0;
        exitDetach = null;
        popup.removeAttribute("data-ending-style");
        finish();
      };
      const onTransitionEnd = (event: TransitionEvent) => {
        if (event.target !== popup) return;
        popup.removeEventListener("transitionend", onTransitionEnd);
        done();
      };
      popup.addEventListener("transitionend", onTransitionEnd);
      exitDetach = () => popup.removeEventListener("transitionend", onTransitionEnd);
      exitTimer = window.setTimeout(done, total + 50);
    };

    // Enter-animation state: `data-starting-style` is present for the opening
    // frames so author CSS can transition in, then removed.
    let startToken = 0;
    let startRaf = 0;
    let startTimer = 0;
    const cancelStartingStyle = () => {
      startToken++;
      if (startRaf) {
        cancelAnimationFrame(startRaf);
        startRaf = 0;
      }
      if (startTimer) {
        window.clearTimeout(startTimer);
        startTimer = 0;
      }
    };
    const scheduleStartingStyleEnd = (popup: HTMLDivElement) => {
      cancelStartingStyle();
      const token = ++startToken;
      const remove = () => {
        startRaf = 0;
        startTimer = 0;
        if (token === startToken && popup.isConnected) {
          popup.removeAttribute("data-starting-style");
        }
      };
      if (typeof window.requestAnimationFrame === "function") {
        startRaf = window.requestAnimationFrame(() => {
          startRaf = window.requestAnimationFrame(remove);
        });
      } else {
        startTimer = window.setTimeout(remove, 0);
      }
    };

    // Close finish: hide, drop modal side effects, then park focus
    // (`final-focus`, defaulting to the trigger).
    const finishClose = (popup: HTMLDivElement, trigger: HTMLButtonElement) => {
      popup.hidden = true;
      removeBackdrop();
      unlockScroll();
      const finalTarget = resolveFocusTarget(finalFocus());
      if (finalTarget) {
        finalTarget.focus();
      } else if (trigger.isConnected && !trigger.disabled) {
        trigger.focus();
      }
    };

    const requestOpen = (next: boolean, force = false) => {
      if ((!force && disabled()) || next === openState()) return;
      emit(host, onOpenChange(), "open-change", "open", next);
      if (controlled && !force) return;

      try {
        openState(next);
      } catch (error) {
        openState(!next);
        throw error;
      }
    };

    // `open` is the boolean state property, so imperative open is `show()`
    // (mirroring HTMLDialogElement, which pairs its `open` property with
    // `show()`/`close()` rather than an `open()` method).
    host.show = () => {
      if (!disabled()) requestOpen(true, true);
    };
    host.close = () => {
      if (!disabled()) requestOpen(false, true);
    };
    host.toggle = (force?: boolean) => {
      if (disabled()) return;
      requestOpen(typeof force === "boolean" ? force : !openState(), true);
    };

    onMount(() => {
      let stopObserver: (() => void) | undefined;
      let stopTopology: (() => void) | undefined;
      let stopControl: (() => void) | undefined;
      let stopClasses: (() => void) | undefined;
      let stopState: (() => void) | undefined;
      const click = (event: MouseEvent) => {
        const target = event.target;
        const currentParts = parts();
        if (!(target instanceof Element) || !currentParts) return;
        if (currentParts.trigger.contains(target)) {
          requestOpen(true);
          return;
        }
        const action = target.closest<HTMLButtonElement>("button[data-action]");
        if (action && currentParts.actionButtons.includes(action)) {
          // Confirm closes by default; `data-keep-open` opts out.
          if (!action.hasAttribute("data-keep-open")) requestOpen(false);
          return;
        }
        const cancel = target.closest<HTMLButtonElement>("button[data-cancel], button[data-close]");
        if (
          cancel &&
          (currentParts.cancelButtons.includes(cancel) ||
            currentParts.closeButtons.includes(cancel))
        ) {
          requestOpen(false);
        }
      };
      const keydown = (event: KeyboardEvent) => {
        const currentParts = parts();
        if (!currentParts || !openState()) return;
        if (event.key === "Escape") {
          event.preventDefault();
          requestOpen(false);
          return;
        }
        if (event.key !== "Tab") return;
        // Lightweight focus trap: wrap first/last while open.
        const { popup } = currentParts;
        if (!popup.contains(event.target as Node)) return;
        const items = [
          popup,
          ...[...popup.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((element) =>
            belongsToHost(element, host),
          ),
        ];
        const first = items[0];
        const last = items[items.length - 1];
        if (!first || !last) return;
        if (event.shiftKey && event.target === first) {
          event.preventDefault();
          (last as HTMLElement).focus();
        } else if (!event.shiftKey && event.target === last) {
          event.preventDefault();
          (first as HTMLElement).focus();
        }
      };
      const cleanup = () => {
        host.removeEventListener("click", click);
        host.removeEventListener("keydown", keydown);
        cancelExit();
        cancelStartingStyle();
        removeBackdrop();
        unlockScroll();
        stopObserver?.();
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
                  record.attributeName === "data-action" ||
                  record.attributeName === "data-cancel" ||
                  record.attributeName === "data-close" ||
                  record.attributeName === "data-title" ||
                  record.attributeName === "data-description",
              )
            ) {
              topologyRevision(++topologyVersion);
            } else {
              classRevision(++classVersion);
            }
          },
          [
            "class",
            "data-action",
            "data-cancel",
            "data-close",
            "data-description",
            "data-title",
            "slot",
          ],
        );
        stopTopology = effect(() => {
          topologyRevision();
          const popup = requireSlottedElement(host, "popup", HTMLDivElement);
          const trigger = requireSlottedElement(host, "trigger", HTMLButtonElement);
          const owned = (selector: string): HTMLButtonElement[] =>
            [...popup.querySelectorAll<HTMLButtonElement>(selector)].filter((element) =>
              belongsToHost(element, host),
            );
          const actionButtons = owned("button[data-action]");
          const cancelButtons = owned("button[data-cancel]");
          const closeButtons = owned("button[data-close]");
          const titleCandidate = popup.querySelector<HTMLElement>("[data-title]");
          const title =
            titleCandidate && belongsToHost(titleCandidate, host) ? titleCandidate : null;
          const descriptionCandidate = popup.querySelector<HTMLElement>("[data-description]");
          const description =
            descriptionCandidate && belongsToHost(descriptionCandidate, host)
              ? descriptionCandidate
              : null;
          popup.id ||= nextId("bwc-alert-dialog-popup");
          popup.dataset.testid ||= "bwc-alert-dialog-popup";
          setAttributeValue(popup, "role", "alertdialog");
          popup.hidden = !openState();
          trigger.id ||= nextId("bwc-alert-dialog-trigger");
          setAttributeValue(trigger, "aria-haspopup", "dialog");
          setAttributeValue(trigger, "aria-controls", popup.id);
          for (const button of [...actionButtons, ...cancelButtons, ...closeButtons]) {
            button.id ||= nextId("bwc-alert-dialog-button");
          }
          if (title) {
            title.id ||= nextId("bwc-alert-dialog-title");
            title.dataset.testid ||= "bwc-alert-dialog-title";
            setAttributeValue(popup, "aria-labelledby", title.id);
          } else {
            removeAttributeValue(popup, "aria-labelledby");
          }
          if (description) {
            description.id ||= nextId("bwc-alert-dialog-description");
            description.dataset.testid ||= "bwc-alert-dialog-description";
            setAttributeValue(popup, "aria-describedby", description.id);
          } else {
            removeAttributeValue(popup, "aria-describedby");
          }
          parts({ actionButtons, cancelButtons, closeButtons, description, popup, title, trigger });
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
            "alert-dialog-trigger",
            "bwc-alert-dialog-trigger",
            currentParts.trigger.className,
          );
          applyPartClass(currentParts.trigger, "alert-dialog-trigger", triggerClass());
          applyPartClass(currentParts.popup, "alert-dialog-popup", popupClass());
          for (const button of currentParts.actionButtons) {
            decorateButton(
              button,
              "alert-dialog-action",
              "bwc-alert-dialog-action",
              button.className,
            );
            applyPartClass(button, "alert-dialog-action", actionClass());
          }
          for (const button of currentParts.cancelButtons) {
            decorateButton(
              button,
              "alert-dialog-cancel",
              "bwc-alert-dialog-cancel",
              button.className,
            );
            applyPartClass(button, "alert-dialog-cancel", cancelClass());
          }
          for (const button of currentParts.closeButtons) {
            decorateButton(
              button,
              "alert-dialog-close",
              "bwc-alert-dialog-close",
              button.className,
            );
            applyPartClass(button, "alert-dialog-close", closeClass());
          }
          if (currentParts.title) {
            applyPartClass(currentParts.title, "alert-dialog-title", titleClass());
          }
          if (currentParts.description) {
            applyPartClass(
              currentParts.description,
              "alert-dialog-description",
              descriptionClass(),
            );
          }
        });
        stopState = effect(() => {
          const currentParts = parts();
          if (!currentParts) return;
          const isOpen = openState();
          const isDisabled = disabled();
          const isModal = modal();
          const { popup, trigger } = currentParts;
          if (trigger.disabled !== isDisabled) trigger.disabled = isDisabled;
          const cursor = isDisabled ? "not-allowed" : "pointer";
          if (trigger.style.cursor !== cursor) trigger.style.cursor = cursor;
          setAttributeValue(trigger, "aria-expanded", String(isOpen));
          setAttributeValue(popup, "aria-modal", String(isModal));
          for (const node of [trigger, popup]) {
            toggleState(node, "data-open", isOpen);
            toggleState(node, "data-closed", !isOpen);
            toggleState(node, "data-disabled", isDisabled);
            toggleState(node, "data-modal", isModal);
          }
          paintBackdrop();

          if (isOpen) {
            cancelExit();
            if (popup.hidden) popup.hidden = false;
            wasOpen = true;
            if (isModal) {
              ensureBackdrop();
              lockScroll();
            } else {
              removeBackdrop();
              unlockScroll();
            }
            popup.removeAttribute("data-ending-style");
            popup.setAttribute("data-starting-style", "");
            scheduleStartingStyleEnd(popup);
            const initialTarget = resolveFocusTarget(initialFocus());
            if (initialTarget) {
              initialTarget.focus();
            } else {
              if (!popup.hasAttribute("tabindex")) popup.tabIndex = -1;
              popup.focus();
            }
          } else if (wasOpen) {
            wasOpen = false;
            beginExit(popup, () => finishClose(popup, trigger));
          } else {
            popup.hidden = true;
            removeBackdrop();
            unlockScroll();
          }
        });
        host.addEventListener("click", click);
        host.addEventListener("keydown", keydown);
        return cleanup;
      } catch (error) {
        cleanup();
        throw error;
      }
    });

    return html`<slot name="trigger"></slot><slot name="popup"></slot>`;
  },
);
