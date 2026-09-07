import popoverCSS from "./popover.css?inline";
import floatingCSS from "../floating/floating.css?inline";
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
  partClassName,
  removeAttributeValue,
  requireSlottedElement,
  setAttributeValue,
  stringProp,
  toggleState,
  type ChangeCallback,
} from "../shared";
import {
  acquireScrollLock,
  attachHover,
  floatingAligns,
  floatingSides,
  positionFloating,
  releaseScrollLock,
  resolveAnchor,
  trackAnchor,
  type AnchorOption,
  type FloatingAlign,
  type FloatingSide,
  type FloatingStrategy,
} from "../floating";

if (typeof document !== "undefined" && !document.getElementById("bwc-popover-style")) {
  const style = document.createElement("style");
  style.id = "bwc-popover-style";
  style.textContent = `${floatingCSS}\n${popoverCSS}`;
  document.head.append(style);
}
const sides = floatingSides;
type Side = FloatingSide;
const aligns = floatingAligns;
type Align = FloatingAlign;
const strategies = ["absolute", "fixed"] as const;
type Strategy = FloatingStrategy;

/**
 * Total exit-transition time for the popup in ms (duration + delay, longest
 * of any comma-separated list). Reads computed style with an inline-style
 * fallback so author stylesheets and inline styles both count; 0 (or
 * unreadable style) means hide synchronously.
 */
function transitionTotalMs(element: HTMLElement): number {
  let duration = "";
  let delay = "";
  try {
    const computed = getComputedStyle(element);
    duration = computed.transitionDuration || "";
    delay = computed.transitionDelay || "";
  } catch {
    duration = "";
    delay = "";
  }
  duration = [duration, element.style.transitionDuration].filter(Boolean).join(",");
  delay = [delay, element.style.transitionDelay].filter(Boolean).join(",");
  const longest = (raw: string): number => {
    let max = 0;
    for (const part of raw.split(",")) {
      const match = /^([\d.]+)(m?s)$/.exec(part.trim());
      if (!match) continue;
      const value = Number(match[1]);
      if (!Number.isFinite(value)) continue;
      max = Math.max(max, match[2] === "s" ? value * 1000 : value);
    }
    return max;
  };
  return longest(duration) + longest(delay);
}

/**
 * Value for `--transform-origin` (the anchor point on the popup edge) from
 * a placement result: the arrow center when an arrow is present, otherwise
 * the align edge. Lets authors scale/fade from the anchor without JS.
 */
function placementTransformOrigin(
  result: { placedSide: Side; arrowX: number | null; arrowY: number | null },
  align: Align,
  arrowSize: number,
): string {
  const cross = (arrow: number | null): string => {
    if (arrow !== null) return `${arrow + arrowSize / 2}px`;
    if (align === "start") return "0";
    if (align === "end") return "100%";
    return "50%";
  };
  switch (result.placedSide) {
    case "bottom":
      return `${cross(result.arrowX)} 0`;
    case "top":
      return `${cross(result.arrowX)} 100%`;
    case "right":
      return `0 ${cross(result.arrowY)}`;
    case "left":
      return `100% ${cross(result.arrowY)}`;
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

export type BwcPopoverElement = HTMLElement & {
  open: boolean;
  defaultOpen: boolean;
  disabled: boolean;
  /** Open on hovering the trigger (with `delay`/`close-delay`); click toggles regardless. */
  openOnHover: boolean;
  /** Hover-open delay in ms. */
  delay: number;
  /** Hover-close delay in ms. */
  closeDelay: number;
  /** Modal: render a backdrop, lock scroll, and move focus into the popup. */
  modal: boolean;
  /** Keep this much space between popup and viewport edge, in px. */
  collisionPadding: number;
  /** Minimum distance between arrow and popup edges, in px. */
  arrowPadding: number;
  /** Skip repositioning on scroll/resize/layout shifts while open. */
  disableAnchorTracking: boolean;
  /** Element or selector focused on open; modal popovers focus the popup by default. */
  initialFocus: FocusTarget;
  /** Element or selector focused on close; defaults to the trigger. */
  finalFocus: FocusTarget;
  side: Side;
  align: Align;
  sideOffset: number;
  alignOffset: number;
  strategy: Strategy;
  /** Anchor element or selector; null anchors to the trigger. */
  anchor: AnchorOption;
  triggerClass: string;
  popupClass: string;
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

export const BwcPopoverElement = defineComponent<BwcPopoverElement>("bwc-popover", () => {
  const host = useHost<BwcPopoverElement>();
  let controlled = host.hasAttribute("open") || Object.hasOwn(host, "open");
  const openState = signal(false);
  const parts = signal<{
    trigger: HTMLButtonElement;
    popup: HTMLDivElement;
    closeButtons: HTMLButtonElement[];
    title: HTMLElement | null;
    description: HTMLElement | null;
  } | null>(null);
  const openOnHover = useProp<boolean>("openOnHover", booleanProp("open-on-hover"));
  const delay = useProp<number>("delay", numberProp("delay"));
  const closeDelay = useProp<number>("closeDelay", numberProp("close-delay"));
  const modal = useProp<boolean>("modal", booleanProp("modal"));
  const collisionPadding = useProp<number>("collisionPadding", numberProp("collision-padding"));
  const arrowPadding = useProp<number>("arrowPadding", numberProp("arrow-padding"));
  const disableAnchorTracking = useProp<boolean>(
    "disableAnchorTracking",
    booleanProp("disable-anchor-tracking"),
  );
  const initialFocus = useProp<FocusTarget>("initialFocus", focusTargetProp("initial-focus"));
  const finalFocus = useProp<FocusTarget>("finalFocus", focusTargetProp("final-focus"));
  const backdropClass = useProp<string>("backdropClass", stringProp("backdrop-class"));
  const titleClass = useProp<string>("titleClass", stringProp("title-class"));
  const descriptionClass = useProp<string>("descriptionClass", stringProp("description-class"));
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
      if (initialized) requestOpen(value, true);
      commit(value);
    },
  });
  const defaultOpen = useProp<boolean>("defaultOpen", booleanProp("default-open"));
  const disabled = useProp<boolean>("disabled", booleanProp("disabled"));
  const side = useProp<Side>("side", enumProp("side", sides, "bottom"));
  const align = useProp<Align>("align", enumProp("align", aligns, "center"));
  const sideOffset = useProp<number>("sideOffset", numberProp("side-offset"));
  const alignOffset = useProp<number>("alignOffset", numberProp("align-offset"));
  const strategy = useProp<Strategy>("strategy", enumProp("strategy", strategies, "fixed"));
  const anchor = useProp<AnchorOption>("anchor", {
    attribute: "anchor",
    defaultValue: null,
    fromAttribute: (raw: string | null) => (raw === null || raw === "" ? null : raw),
    fromProperty: (raw: unknown) => {
      if (raw === null || raw instanceof Element || typeof raw === "string") return raw;
      throw new TypeError("anchor must be an element, selector, or null");
    },
    toAttribute: (value: AnchorOption) => (typeof value === "string" ? value : null),
  });
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
  // Exit-animation state: while `exiting`, the popup keeps `data-ending-style`
  // until its transition finishes (or a fallback timer fires); the finish
  // step hides it through the popover API, drops the backdrop, and parks
  // focus. Without a transition the finish runs synchronously.
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

  // Native `title` suppression: while the custom popover is open the trigger
  // must not also show the platform tooltip. Restored on close.
  let titledTrigger: HTMLElement | null = null;
  let titledValue: string | null = null;
  const suppressTriggerTitle = (trigger: HTMLElement) => {
    if (titledTrigger === null && trigger.hasAttribute("title")) {
      titledTrigger = trigger;
      titledValue = trigger.getAttribute("title");
      trigger.removeAttribute("title");
    }
  };
  const restoreTriggerTitle = () => {
    if (titledTrigger !== null && titledValue !== null && !titledTrigger.hasAttribute("title")) {
      titledTrigger.setAttribute("title", titledValue);
    }
    titledTrigger = null;
    titledValue = null;
  };

  // Modal backdrop: a plain fixed layer behind the top-layer popover.
  // Backdrop pointerdown natively light-dismisses the popover.
  let backdrop: HTMLDivElement | null = null;
  let scrollHeld = false;
  const paintBackdrop = () => {
    if (!backdrop) return;
    const className = partClassName("popover-backdrop", backdropClass());
    if (backdrop.className !== className) backdrop.className = className;
  };
  const ensureBackdrop = (): HTMLDivElement => {
    if (!backdrop) {
      const element = document.createElement("div");
      element.dataset.testid = "bwc-popover-backdrop";
      element.setAttribute("data-backdrop", "");
      backdrop = element;
    }
    paintBackdrop();
    if (!backdrop.isConnected) document.body.append(backdrop);
    return backdrop;
  };
  const removeBackdrop = () => {
    backdrop?.remove();
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

  const resolveFocusTarget = (value: FocusTarget): HTMLElement | null => {
    if (value instanceof HTMLElement) return value;
    if (typeof value === "string") {
      const scope = host.isConnected ? host.ownerDocument : document;
      return (host.querySelector(value) ?? scope.querySelector(value)) as HTMLElement | null;
    }
    return null;
  };

  // Close finish: hide through the popover API, drop modal side effects,
  // then park focus (`final-focus`, defaulting to the trigger).
  const finishClose = (popup: HTMLDivElement, trigger: HTMLButtonElement) => {
    hide(popup);
    removeBackdrop();
    unlockScroll();
    restoreTriggerTitle();
    const finalTarget = resolveFocusTarget(finalFocus());
    if (finalTarget) {
      finalTarget.focus();
    } else if (trigger.isConnected && !trigger.disabled) {
      trigger.focus();
    }
  };
  let wasOpen = false;

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
    let stopConfig: (() => void) | undefined;
    let stopPosition: (() => void) | undefined;
    let stopTracking: (() => void) | undefined;
    let stopHover: (() => void) | undefined;
    let stopInteract: (() => void) | undefined;
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
      stopHover?.();
      stopHover = undefined;
      stopTracking?.();
      stopTracking = undefined;
      cancelExit();
      cancelStartingStyle();
      restoreTriggerTitle();
      removeBackdrop();
      unlockScroll();
      stopObserver?.();
      stopInteract?.();
      stopConfig?.();
      stopPosition?.();
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
        ["class", "data-close", "data-description", "data-title", "slot"],
      );
      stopTopology = effect(() => {
        topologyRevision();
        const previous = parts();
        const popup = requireSlottedElement(host, "popup", HTMLDivElement);
        const trigger = requireSlottedElement(host, "trigger", HTMLButtonElement);
        const closeButtons = [
          ...popup.querySelectorAll<HTMLButtonElement>("button[data-close]"),
        ].filter((button) => belongsToHost(button, host));
        const titleCandidate = popup.querySelector<HTMLElement>("[data-title]");
        const title = titleCandidate && belongsToHost(titleCandidate, host) ? titleCandidate : null;
        const descriptionCandidate = popup.querySelector<HTMLElement>("[data-description]");
        const description =
          descriptionCandidate && belongsToHost(descriptionCandidate, host)
            ? descriptionCandidate
            : null;
        // Same nodes (re-run from `openState`, not a slot change): visibility
        // is stopState's job, so leave parts — and the popup — untouched.
        if (
          previous &&
          previous.popup === popup &&
          previous.trigger === trigger &&
          previous.title === title &&
          previous.description === description &&
          previous.closeButtons.length === closeButtons.length &&
          previous.closeButtons.every((button, index) => button === closeButtons[index])
        ) {
          return;
        }
        parts(null);
        if (activePopup) hide(activePopup);
        activePopup = null;
        activePopup = popup;
        popup.id ||= nextId("bwc-popover-popup");
        popup.dataset.testid ||= "bwc-popover-popup";
        setAttributeValue(popup, "popover", "auto");
        setAttributeValue(popup, "role", "dialog");
        if (!popup.hasAttribute("data-floating")) popup.setAttribute("data-floating", "");
        const arrow = popup.querySelector<HTMLElement>("[data-arrow]");
        if (arrow && belongsToHost(arrow, host) && !arrow.hasAttribute("data-floating-arrow")) {
          arrow.setAttribute("data-floating-arrow", "");
        }
        trigger.id ||= nextId("bwc-popover-trigger");
        setAttributeValue(trigger, "aria-haspopup", "dialog");
        setAttributeValue(trigger, "aria-controls", popup.id);
        for (const button of closeButtons) {
          button.id ||= nextId("bwc-popover-close");
        }
        if (title) {
          title.id ||= nextId("bwc-popover-title");
          title.dataset.testid ||= "bwc-popover-title";
          setAttributeValue(popup, "aria-labelledby", title.id);
        } else {
          removeAttributeValue(popup, "aria-labelledby");
        }
        if (description) {
          description.id ||= nextId("bwc-popover-description");
          description.dataset.testid ||= "bwc-popover-description";
          setAttributeValue(popup, "aria-describedby", description.id);
        } else {
          removeAttributeValue(popup, "aria-describedby");
        }
        parts({ closeButtons, description, popup, title, trigger });
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
        if (currentParts.title) applyPartClass(currentParts.title, "popover-title", titleClass());
        if (currentParts.description) {
          applyPartClass(currentParts.description, "popover-description", descriptionClass());
        }
      });
      stopState = effect(() => {
        nativeRevision();
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
        for (const node of [trigger, popup]) {
          toggleState(node, "data-open", isOpen);
          toggleState(node, "data-closed", !isOpen);
          toggleState(node, "data-disabled", isDisabled);
        }
        paintBackdrop();

        if (isOpen) {
          if (!isShown(popup)) {
            try {
              cancelExit();
              if (popup.hidden) popup.hidden = false;
              if (typeof popup.showPopover === "function") {
                popup.showPopover({ source: trigger });
              }
              shownPopups.add(popup);
            } catch (error) {
              openState(false);
              if (typeof popup.showPopover !== "function") popup.hidden = true;
              throw error;
            }
            // Open-path side effects run only after a successful show.
            wasOpen = true;
            if (isModal) {
              ensureBackdrop();
              lockScroll();
            } else {
              removeBackdrop();
              unlockScroll();
            }
            suppressTriggerTitle(trigger);
            popup.removeAttribute("data-ending-style");
            popup.setAttribute("data-starting-style", "");
            scheduleStartingStyleEnd(popup);
            const initialTarget = resolveFocusTarget(initialFocus());
            if (initialTarget) {
              initialTarget.focus();
            } else if (isModal) {
              if (!popup.hasAttribute("tabindex")) popup.tabIndex = -1;
              popup.focus();
            }
          } else {
            // Reopened while an exit was pending: cancel the hide. Modal
            // side effects sync here too (e.g. `modal` toggled while open).
            cancelExit();
            popup.removeAttribute("data-ending-style");
            if (isModal) {
              ensureBackdrop();
              lockScroll();
            } else {
              removeBackdrop();
              unlockScroll();
            }
          }
        } else if (wasOpen || isShown(popup)) {
          wasOpen = false;
          if (isShown(popup)) {
            beginExit(popup, () => finishClose(popup, trigger));
          } else {
            // Already hidden through native light-dismiss: close side
            // effects (backdrop, focus) still need to run.
            finishClose(popup, trigger);
          }
        }
      });
      stopConfig = effect(() => {
        const currentParts = parts();
        if (!currentParts) return;
        const { popup } = currentParts;
        // Requested side/align; positionFloating overwrites data-side with
        // the placed side after measuring.
        if (popup.dataset.side !== side() && !openState()) popup.dataset.side = side();
        if (popup.dataset.align !== align()) popup.dataset.align = align();
        const sideOffsetValue = `${sideOffset()}px`;
        if (popup.style.getPropertyValue("--side-offset") !== sideOffsetValue) {
          popup.style.setProperty("--side-offset", sideOffsetValue);
        }
        const alignOffsetValue = `${alignOffset()}px`;
        if (popup.style.getPropertyValue("--align-offset") !== alignOffsetValue) {
          popup.style.setProperty("--align-offset", alignOffsetValue);
        }
      });
      stopPosition = effect(() => {
        const currentParts = parts();
        if (!currentParts) return;
        const currentSide = side();
        const currentAlign = align();
        const currentSideOffset = sideOffset();
        const currentAlignOffset = alignOffset();
        const currentStrategy = strategy();
        const currentAnchor = anchor();
        const currentCollisionPadding = collisionPadding();
        const currentArrowPadding = arrowPadding();
        const currentDisableTracking = disableAnchorTracking();
        const isOpen = openState();
        stopTracking?.();
        stopTracking = undefined;
        if (!isOpen) return;
        const { popup, trigger } = currentParts;
        const anchorEl = resolveAnchor(host, currentAnchor, trigger) ?? trigger;
        const update = () => {
          const arrow = popup.querySelector<HTMLElement>("[data-arrow]");
          const arrowEl = arrow && belongsToHost(arrow, host) ? arrow : null;
          const result = positionFloating(anchorEl, popup, arrowEl, {
            side: currentSide,
            align: currentAlign,
            sideOffset: currentSideOffset,
            alignOffset: currentAlignOffset,
            strategy: currentStrategy,
            collisionPadding: currentCollisionPadding,
          });
          // `arrow-padding` tightens the core clamp (never looser than the
          // collision padding the core already applied).
          let arrowSize = 0;
          if (arrowEl) {
            arrowSize = arrowEl.getBoundingClientRect().width || 8;
            const pad = Math.max(currentArrowPadding, currentCollisionPadding);
            if (pad > 0) {
              const size = popup.getBoundingClientRect();
              if (result.arrowX !== null) {
                arrowEl.style.left = `${Math.min(
                  size.width - arrowSize - pad,
                  Math.max(pad, result.arrowX),
                )}px`;
              } else if (result.arrowY !== null) {
                arrowEl.style.top = `${Math.min(
                  size.height - arrowSize - pad,
                  Math.max(pad, result.arrowY),
                )}px`;
              }
            }
          }
          const origin = placementTransformOrigin(result, currentAlign, arrowSize);
          if (popup.style.getPropertyValue("--transform-origin") !== origin) {
            popup.style.setProperty("--transform-origin", origin);
          }
        };
        update();
        stopTracking = currentDisableTracking ? undefined : trackAnchor(anchorEl, popup, update);
      });
      stopInteract = effect(() => {
        const currentParts = parts();
        if (!currentParts) return;
        const hoverEnabled = openOnHover();
        const openDelay = delay();
        const closeDelayValue = closeDelay();
        stopHover?.();
        stopHover = undefined;
        if (!hoverEnabled) return;
        const { popup, trigger } = currentParts;
        stopHover = attachHover(trigger, popup, {
          openDelay,
          closeDelay: closeDelayValue,
          onOpen: () => requestOpen(true),
          onClose: () => requestOpen(false),
        });
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
