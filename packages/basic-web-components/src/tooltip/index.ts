import tooltipCSS from "./tooltip.css?inline";
import floatingCSS from "../floating/floating.css?inline";
import { defineComponent, effect, html, onMount, signal, useHost, useProp } from "microfw";
import {
  belongsToHost,
  booleanProp,
  booleanPropDefaultTrue,
  callbackProp,
  createPartClassController,
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
  attachDismiss,
  attachHover,
  floatingAligns,
  floatingSides,
  positionFloating,
  resolveAnchor,
  trackAnchor,
  type AnchorOption,
  type FloatingAlign,
  type FloatingSide,
  type FloatingStrategy,
} from "../floating";

if (typeof document !== "undefined" && !document.getElementById("bwc-tooltip-style")) {
  const style = document.createElement("style");
  style.id = "bwc-tooltip-style";
  style.textContent = `${floatingCSS}\n${tooltipCSS}`;
  document.head.append(style);
}

const sides = floatingSides;
type Side = FloatingSide;
const aligns = floatingAligns;
type Align = FloatingAlign;
const strategies = ["absolute", "fixed"] as const;
type Strategy = FloatingStrategy;
const trackCursorModes = ["none", "x", "y", "both"] as const;
export type TrackCursorMode = (typeof trackCursorModes)[number];

/**
 * Page-wide hover group (Base UI Provider `timeout` semantics without a
 * provider element): every close refreshes this timestamp, and a trigger
 * hovered within `timeout` ms opens instantly, skipping `delay`.
 */
let lastTooltipCloseAt = 0;

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

export type BwcTooltipElement = HTMLElement & {
  open: boolean;
  defaultOpen: boolean;
  disabled: boolean;
  delay: number;
  closeDelay: number;
  hoverable: boolean;
  closeOnClick: boolean;
  /** Cursor-tracking axis; anything but "none" anchors to the pointer. */
  trackCursor: TrackCursorMode;
  /** Group window: hover within this long after any tooltip closed opens instantly. */
  timeout: number;
  /** Keep this much space between popup and viewport edge, in px. */
  collisionPadding: number;
  /** Minimum distance between arrow and popup edges, in px. */
  arrowPadding: number;
  /** Skip repositioning on scroll/resize/layout shifts while open. */
  disableAnchorTracking: boolean;
  side: Side;
  align: Align;
  sideOffset: number;
  alignOffset: number;
  strategy: Strategy;
  /** Anchor element or selector; null anchors to the trigger. */
  anchor: AnchorOption;
  triggerClass: string;
  popupClass: string;
  onOpenChange: ChangeCallback<boolean>;
  /** Imperative open. Respects `disabled`; applies and notifies in controlled mode. */
  show: () => void;
  /** Imperative close. Applies and notifies in controlled mode. */
  close: () => void;
  /** Toggle, or force with a boolean. Applies and notifies in controlled mode. */
  toggle: (force?: boolean) => void;
};

/** Hover wiring for `hoverable={false}`: delays apply to the trigger only. */
function attachTriggerHover(
  trigger: Element,
  openDelay: number,
  closeDelay: number,
  onOpen: () => void,
  onClose: () => void,
): () => void {
  let detached = false;
  let openTimer = 0;
  let closeTimer = 0;

  const clearTimers = () => {
    window.clearTimeout(openTimer);
    window.clearTimeout(closeTimer);
  };
  const scheduleOpen = () => {
    window.clearTimeout(closeTimer);
    window.clearTimeout(openTimer);
    if (openDelay <= 0) onOpen();
    else openTimer = window.setTimeout(onOpen, openDelay);
  };
  const scheduleClose = () => {
    window.clearTimeout(openTimer);
    window.clearTimeout(closeTimer);
    if (closeDelay <= 0) onClose();
    else closeTimer = window.setTimeout(onClose, closeDelay);
  };

  trigger.addEventListener("pointerenter", scheduleOpen);
  trigger.addEventListener("pointerleave", scheduleClose);

  return () => {
    if (detached) return;
    detached = true;
    clearTimers();
    trigger.removeEventListener("pointerenter", scheduleOpen);
    trigger.removeEventListener("pointerleave", scheduleClose);
  };
}

export const BwcTooltipElement = defineComponent<BwcTooltipElement>("bwc-tooltip", () => {
  const host = useHost<BwcTooltipElement>();
  let controlled = host.hasAttribute("open") || Object.hasOwn(host, "open");
  const openState = signal(false);
  const parts = signal<{
    trigger: HTMLElement;
    popup: HTMLDivElement;
  } | null>(null);
  const topologyRevision = signal(0);
  const classRevision = signal(0);
  let topologyVersion = 0;
  let classVersion = 0;
  let initialized = false;
  // Imperative closes suppress the current hover gesture; only a later
  // pointerenter may authorize hover callbacks that were already delayed.
  let hoverOpenAllowed = false;
  // Outside pointerdown dismisses before the ensuing click. Preserve the
  // gesture's initial state so an external click handler can toggle once.
  let pointerToggleBase: boolean | null = null;
  let pointerToggleClearTimer = 0;
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
  const delay = useProp<number>("delay", numberProp("delay", 600));
  const closeDelay = useProp<number>("closeDelay", numberProp("close-delay", 0));
  const hoverable = useProp<boolean>("hoverable", booleanPropDefaultTrue("hoverable"));
  const closeOnClick = useProp<boolean>("closeOnClick", booleanPropDefaultTrue("close-on-click"));
  const trackCursor = useProp<TrackCursorMode>(
    "trackCursor",
    enumProp("track-cursor", trackCursorModes, "none"),
  );
  const timeout = useProp<number>("timeout", numberProp("timeout", 400));
  const collisionPadding = useProp<number>("collisionPadding", numberProp("collision-padding"));
  const arrowPadding = useProp<number>("arrowPadding", numberProp("arrow-padding"));
  const disableAnchorTracking = useProp<boolean>(
    "disableAnchorTracking",
    booleanProp("disable-anchor-tracking"),
  );
  const side = useProp<Side>("side", enumProp("side", sides, "top"));
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
  const onOpenChange = useProp<ChangeCallback<boolean>>(
    "onOpenChange",
    callbackProp<boolean>("onOpenChange"),
  );
  openState(controlled ? open() : defaultOpen());

  const decoratePart = (element: HTMLElement, marker: string, testId: string) => {
    const className = partClassName(marker, element.className);
    if (element.className !== className) element.className = className;
    element.dataset.testid ||= testId;
    element.id ||= nextId(testId);
  };

  const applyPartClass = (part: HTMLElement, marker: string, value: string) => {
    let apply = classControllers.get(part);
    if (!apply) {
      apply = createPartClassController(part, marker, value);
      classControllers.set(part, apply);
    }
    apply(value);
  };

  // Exit-animation state: while `exiting`, the popup keeps `data-ending-style`
  // until its transition finishes (or a fallback timer fires), then hides.
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

  // Native `title` suppression: while the custom tooltip is open the trigger
  // must not also show the platform tooltip. Restored on close; while
  // disabled the component never opens, so a native title stays as fallback.
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

  // Cursor anchor: a zero-size fixed element following the pointer, so the
  // shared floating core can anchor to the cursor without core changes.
  let lastCursor: { x: number; y: number } | null = null;
  let cursorAnchor: HTMLDivElement | null = null;
  const ensureCursorAnchor = (): HTMLDivElement => {
    if (!cursorAnchor) {
      const anchor = document.createElement("div");
      anchor.dataset.testid = "bwc-tooltip-cursor";
      anchor.setAttribute("aria-hidden", "true");
      anchor.style.position = "fixed";
      anchor.style.width = "0";
      anchor.style.height = "0";
      anchor.style.pointerEvents = "none";
      cursorAnchor = anchor;
    }
    if (!cursorAnchor.isConnected) document.body.append(cursorAnchor);
    return cursorAnchor;
  };
  const removeCursorAnchor = () => {
    cursorAnchor?.remove();
  };
  const moveCursorAnchor = (
    anchor: HTMLDivElement,
    trigger: HTMLElement,
    mode: TrackCursorMode,
    cursor: { x: number; y: number } | null,
  ) => {
    const rect = trigger.getBoundingClientRect();
    const point = cursor ?? {
      x: rect.x + rect.width / 2,
      y: rect.y + rect.height / 2,
    };
    anchor.style.left = `${mode === "y" ? rect.x + rect.width / 2 : point.x}px`;
    anchor.style.top = `${mode === "x" ? rect.y + rect.height / 2 : point.y}px`;
  };

  const clearPointerToggleBase = () => {
    pointerToggleBase = null;
    if (pointerToggleClearTimer) window.clearTimeout(pointerToggleClearTimer);
    pointerToggleClearTimer = 0;
  };

  const requestOpen = (next: boolean, force = false) => {
    if (!next) hoverOpenAllowed = false;
    if ((!force && disabled()) || next === openState()) return;
    if (!next) lastTooltipCloseAt = Date.now();
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
    const next = typeof force === "boolean" ? force : !(pointerToggleBase ?? openState());
    clearPointerToggleBase();
    requestOpen(next, true);
  };

  onMount(() => {
    let stopObserver: (() => void) | undefined;
    let stopTopology: (() => void) | undefined;
    let stopControl: (() => void) | undefined;
    let stopClasses: (() => void) | undefined;
    let stopState: (() => void) | undefined;
    let stopConfig: (() => void) | undefined;
    let stopPosition: (() => void) | undefined;
    let stopInteract: (() => void) | undefined;
    let stopTracking: (() => void) | undefined;
    let stopHover: (() => void) | undefined;
    let stopDismiss: (() => void) | undefined;
    let stopCursor: (() => void) | undefined;
    const beginPointerInteraction = () => {
      clearPointerToggleBase();
      pointerToggleBase = openState();
    };
    const finishPointerInteraction = () => {
      clearPointerToggleBase();
    };
    const finishPointerInteractionAfterClick = () => {
      if (pointerToggleClearTimer) window.clearTimeout(pointerToggleClearTimer);
      pointerToggleClearTimer = window.setTimeout(clearPointerToggleBase, 0);
    };
    const click = (event: MouseEvent) => {
      const target = event.target;
      const currentParts = parts();
      if (!(target instanceof Element) || !currentParts) return;
      if (currentParts.trigger.contains(target) && closeOnClick() && openState()) {
        requestOpen(false);
      }
    };
    const focusin = () => {
      requestOpen(true);
    };
    const focusout = (event: FocusEvent) => {
      const currentParts = parts();
      if (!currentParts) return;
      const next = event.relatedTarget as Node | null;
      if (next && (currentParts.trigger.contains(next) || currentParts.popup.contains(next))) {
        return;
      }
      requestOpen(false);
    };
    const cleanup = () => {
      host.removeEventListener("click", click);
      host.removeEventListener("focusin", focusin);
      host.removeEventListener("focusout", focusout);
      document.removeEventListener("pointerdown", beginPointerInteraction, true);
      document.removeEventListener("click", finishPointerInteraction);
      document.removeEventListener("pointercancel", finishPointerInteraction, true);
      document.removeEventListener("pointerup", finishPointerInteractionAfterClick, true);
      clearPointerToggleBase();
      stopHover?.();
      stopHover = undefined;
      stopDismiss?.();
      stopDismiss = undefined;
      stopTracking?.();
      stopTracking = undefined;
      stopCursor?.();
      stopCursor = undefined;
      removeCursorAnchor();
      cancelExit();
      cancelStartingStyle();
      restoreTriggerTitle();
      stopObserver?.();
      stopInteract?.();
      stopConfig?.();
      stopPosition?.();
      stopState?.();
      stopClasses?.();
      stopControl?.();
      stopTopology?.();
      const currentParts = parts();
      parts(null);
      if (currentParts) currentParts.popup.hidden = true;
    };

    try {
      // Register before light-dismiss so toggle() can see the state from
      // before an outside pointerdown closes the tooltip.
      document.addEventListener("pointerdown", beginPointerInteraction, true);
      document.addEventListener("click", finishPointerInteraction);
      document.addEventListener("pointercancel", finishPointerInteraction, true);
      document.addEventListener("pointerup", finishPointerInteractionAfterClick, true);
      stopObserver = observeSlotSubtree(
        host,
        (records) => {
          if (
            records.length === 0 ||
            records.some((record) => record.type === "childList" || record.attributeName === "slot")
          ) {
            topologyRevision(++topologyVersion);
          } else {
            classRevision(++classVersion);
          }
        },
        ["class", "slot"],
      );
      stopTopology = effect(() => {
        topologyRevision();
        const previous = parts();
        const popup = requireSlottedElement(host, "popup", HTMLDivElement);
        const trigger = requireSlottedElement(host, "trigger", Element) as HTMLElement;
        // Same nodes (re-run from `openState`, not a slot change): visibility
        // is stopState's job, so leave parts — and the popup — untouched.
        if (previous && previous.popup === popup && previous.trigger === trigger) return;
        parts(null);
        if (previous) previous.popup.hidden = true;
        popup.id ||= nextId("bwc-tooltip-popup");
        popup.dataset.testid ||= "bwc-tooltip-popup";
        if (!popup.hasAttribute("data-floating")) popup.setAttribute("data-floating", "");
        setAttributeValue(popup, "role", "tooltip");
        const arrow = popup.querySelector<HTMLElement>("[data-arrow]");
        if (arrow && belongsToHost(arrow, host) && !arrow.hasAttribute("data-floating-arrow")) {
          arrow.setAttribute("data-floating-arrow", "");
        }
        trigger.id ||= nextId("bwc-tooltip-trigger");
        trigger.dataset.testid ||= "bwc-tooltip-trigger";
        setAttributeValue(trigger, "aria-describedby", popup.id);
        popup.hidden = !openState();
        parts({ popup, trigger });
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
        decoratePart(currentParts.trigger, "tooltip-trigger", "bwc-tooltip-trigger");
        applyPartClass(currentParts.trigger, "tooltip-trigger", triggerClass());
        decoratePart(currentParts.popup, "tooltip-popup", "bwc-tooltip-popup");
        applyPartClass(currentParts.popup, "tooltip-popup", popupClass());
      });
      stopState = effect(() => {
        const currentParts = parts();
        if (!currentParts) return;
        const isOpen = openState();
        const isDisabled = disabled();
        const { popup, trigger } = currentParts;
        const cursor = isDisabled ? "not-allowed" : "pointer";
        if (trigger.style.cursor !== cursor) trigger.style.cursor = cursor;
        if (isDisabled) setAttributeValue(trigger, "aria-disabled", "true");
        else removeAttributeValue(trigger, "aria-disabled");
        for (const node of [trigger, popup]) {
          toggleState(node, "data-open", isOpen);
          toggleState(node, "data-closed", !isOpen);
          toggleState(node, "data-disabled", isDisabled);
        }
        if (isOpen) {
          cancelExit();
          suppressTriggerTitle(trigger);
          popup.hidden = false;
          popup.removeAttribute("data-ending-style");
          popup.setAttribute("data-starting-style", "");
          scheduleStartingStyleEnd(popup);
        } else {
          beginExit(popup, () => {
            popup.hidden = true;
            restoreTriggerTitle();
          });
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
        const currentTrackCursor = trackCursor();
        const currentCollisionPadding = collisionPadding();
        const currentArrowPadding = arrowPadding();
        const currentDisableTracking = disableAnchorTracking();
        const isOpen = openState();
        stopTracking?.();
        stopTracking = undefined;
        stopCursor?.();
        stopCursor = undefined;
        removeCursorAnchor();
        if (!isOpen) return;
        const { popup, trigger } = currentParts;
        const update = () => {
          const arrow = popup.querySelector<HTMLElement>("[data-arrow]");
          const arrowEl = arrow && belongsToHost(arrow, host) ? arrow : null;
          const result = positionFloating(updateAnchor(), popup, arrowEl, {
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
        // The anchor is the cursor point while tracking; otherwise the
        // `anchor` prop (defaulting to the trigger). Re-resolved per update
        // so cursor moves reposition against the live anchor.
        const updateAnchor = (): Element => {
          if (currentTrackCursor === "none") {
            return resolveAnchor(host, currentAnchor, trigger) ?? trigger;
          }
          return cursorAnchor ?? trigger;
        };
        if (currentTrackCursor !== "none") {
          const cursorAnchorEl = ensureCursorAnchor();
          cursorAnchor = cursorAnchorEl;
          moveCursorAnchor(cursorAnchorEl, trigger, currentTrackCursor, lastCursor);
          const store = (event: PointerEvent) => {
            lastCursor = { x: event.clientX, y: event.clientY };
          };
          const follow = (event: PointerEvent) => {
            lastCursor = { x: event.clientX, y: event.clientY };
            moveCursorAnchor(cursorAnchorEl, trigger, currentTrackCursor, lastCursor);
            update();
          };
          trigger.addEventListener("pointerenter", store);
          trigger.addEventListener("pointermove", store);
          document.addEventListener("pointermove", follow);
          stopCursor = () => {
            trigger.removeEventListener("pointerenter", store);
            trigger.removeEventListener("pointermove", store);
            document.removeEventListener("pointermove", follow);
          };
        }
        update();
        stopTracking = currentDisableTracking
          ? undefined
          : trackAnchor(updateAnchor(), popup, update);
      });
      stopInteract = effect(() => {
        const currentParts = parts();
        if (!currentParts) return;
        const openDelay = delay();
        const closeDelayValue = closeDelay();
        const bridge = hoverable();
        const currentAnchor = anchor();
        stopHover?.();
        stopHover = undefined;
        stopDismiss?.();
        stopDismiss = undefined;
        const { popup, trigger } = currentParts;
        const anchorEl = resolveAnchor(host, currentAnchor, trigger) ?? trigger;
        const onOpen = () => {
          if (hoverOpenAllowed) requestOpen(true);
        };
        const onClose = () => requestOpen(false);
        // A delayed callback belongs only to the pointer gesture that
        // scheduled it. Leaving or imperatively closing requires a new enter.
        const pointerLeave = () => {
          hoverOpenAllowed = false;
        };
        const triggerEnter = () => {
          hoverOpenAllowed = true;
          // Hover group: a trigger hovered within `timeout` ms of any tooltip
          // closing opens instantly, skipping `delay`.
          if (!openState() && !disabled() && Date.now() - lastTooltipCloseAt < timeout()) {
            requestOpen(true);
          }
        };
        const popupEnter = () => {
          hoverOpenAllowed = true;
        };
        trigger.addEventListener("pointerenter", triggerEnter);
        trigger.addEventListener("pointerleave", pointerLeave);
        if (bridge) {
          popup.addEventListener("pointerenter", popupEnter);
          popup.addEventListener("pointerleave", pointerLeave);
        }
        stopHover = () => {
          trigger.removeEventListener("pointerenter", triggerEnter);
          trigger.removeEventListener("pointerleave", pointerLeave);
          if (bridge) {
            popup.removeEventListener("pointerenter", popupEnter);
            popup.removeEventListener("pointerleave", pointerLeave);
          }
          stopHoverInner();
          stopHover = undefined;
        };
        const stopHoverInner = bridge
          ? attachHover(trigger, popup, { openDelay, closeDelay: closeDelayValue, onOpen, onClose })
          : attachTriggerHover(trigger, openDelay, closeDelayValue, onOpen, onClose);
        stopDismiss = attachDismiss(popup, [trigger, anchorEl], {
          outside: true,
          escape: true,
          onDismiss: onClose,
        });
      });
      host.addEventListener("click", click);
      host.addEventListener("focusin", focusin);
      host.addEventListener("focusout", focusout);
      return cleanup;
    } catch (error) {
      cleanup();
      throw error;
    }
  });

  return html`<slot name="trigger"></slot><slot name="popup"></slot>`;
});
