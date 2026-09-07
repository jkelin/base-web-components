import menuCSS from "./menu.css?inline";
import floatingCSS from "../floating/floating.css?inline";
import { defineComponent, effect, html, onMount, signal, useHost, useProp } from "microfw";
import {
  booleanProp,
  booleanPropDefaultTrue,
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
import {
  acquireScrollLock,
  attachDismiss,
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
if (typeof document !== "undefined" && !document.getElementById("bwc-menu-style")) {
  const style = document.createElement("style");
  style.id = "bwc-menu-style";
  style.textContent = `${floatingCSS}\n${menuCSS}`;
  document.head.append(style);
}

const sides = floatingSides;
type Side = FloatingSide;
const aligns = floatingAligns;
type Align = FloatingAlign;
const strategies = ["absolute", "fixed"] as const;
type Strategy = FloatingStrategy;
const orientations = ["vertical", "horizontal"] as const;
type Orientation = (typeof orientations)[number];
/** Menu items: explicit opt-in or a menuitem role, owned by this host. */
export function menuItems(host: HTMLElement, popup: HTMLElement): HTMLElement[] {
  return [...popup.querySelectorAll<HTMLElement>("[data-menu-item], [role='menuitem']")].filter(
    (element) => belongsToHost(element, host),
  );
}

export function isMenuItemDisabled(item: HTMLElement): boolean {
  return (
    item.hasAttribute("data-disabled") ||
    item.hasAttribute("disabled") ||
    item.getAttribute("aria-disabled") === "true"
  );
}

/**
 * Whether activating an item closes the menu. Plain items close; checkbox
 * and radio items stay open unless the author opts in with
 * `data-close-on-click="true"` (or out with `"false"`).
 */
export function wantsMenuClose(item: HTMLElement): boolean {
  if (item.dataset.closeOnClick === "true") return true;
  if (item.dataset.closeOnClick === "false") return false;
  return !item.hasAttribute("data-checkbox-item") && !item.hasAttribute("data-radio-item");
}
/** Nearest owning radio group for an item, or null when ungrouped. */
export function radioGroupOf(item: HTMLElement, popup: HTMLElement): HTMLElement | null {
  const group = item.closest("[data-radio-group]");
  return group instanceof HTMLElement && popup.contains(group) ? group : null;
}

const pendingHides = new WeakMap<HTMLElement, number>();

function popupHasTransition(popup: HTMLElement): boolean {
  try {
    const style = getComputedStyle(popup);
    const durations = `${style.transitionDuration ?? ""},${style.animationDuration ?? ""}`.split(
      ",",
    );
    return durations.some((part) => Number.parseFloat(part) > 0);
  } catch {
    return false;
  }
}

function nextFrame(callback: () => void): void {
  if (typeof window !== "undefined" && typeof window.requestAnimationFrame === "function") {
    window.requestAnimationFrame(() => callback());
  } else {
    window.setTimeout(callback, 0);
  }
}

/**
 * Show/hide with Base UI animation hooks: `data-starting-style` on open,
 * `data-ending-style` plus deferred hide on close while a CSS transition or
 * animation is present, synchronous hide otherwise (e.g. tests, no CSS).
 */
export function syncPopupVisibility(popup: HTMLElement, isOpen: boolean): void {
  const pending = pendingHides.get(popup);
  if (pending !== undefined) {
    window.clearTimeout(pending);
    pendingHides.delete(popup);
  }
  if (isOpen) {
    popup.removeAttribute("data-ending-style");
    if (popup.hidden) {
      popup.hidden = false;
      popup.setAttribute("data-starting-style", "");
      nextFrame(() => popup.removeAttribute("data-starting-style"));
    }
    return;
  }
  popup.removeAttribute("data-starting-style");
  if (popup.hidden || popup.hasAttribute("data-ending-style")) return;
  if (!popupHasTransition(popup)) {
    popup.hidden = true;
    return;
  }
  popup.setAttribute("data-ending-style", "");
  const finish = () => {
    pendingHides.delete(popup);
    if (!popup.hasAttribute("data-ending-style")) return;
    popup.removeAttribute("data-ending-style");
    popup.hidden = true;
  };
  const onEnd = (event: TransitionEvent) => {
    if (event.target !== popup) return;
    popup.removeEventListener("transitionend", onEnd);
    const timer = pendingHides.get(popup);
    if (timer !== undefined) window.clearTimeout(timer);
    finish();
  };
  popup.addEventListener("transitionend", onEnd);
  pendingHides.set(
    popup,
    window.setTimeout(() => {
      popup.removeEventListener("transitionend", onEnd);
      finish();
    }, 400),
  );
}

export type BwcMenuElement = HTMLElement & {
  open: boolean;
  defaultOpen: boolean;
  disabled: boolean;
  /** Lock body scroll while open; light-dismiss always applies. Default true. */
  modal: boolean;
  /** Wrap highlight past the first/last item. Default true. */
  loopFocus: boolean;
  orientation: Orientation;
  side: Side;
  align: Align;
  sideOffset: number;
  alignOffset: number;
  strategy: Strategy;
  /** Anchor element or selector; null anchors to the trigger. */
  anchor: AnchorOption;
  /** Open on trigger/popup hover instead of click. Default false. */
  openOnHover: boolean;
  delay: number;
  closeDelay: number;
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

export const BwcMenuElement = defineComponent<BwcMenuElement>("bwc-menu", () => {
  const host = useHost<BwcMenuElement>();
  let controlled = host.hasAttribute("open") || Object.hasOwn(host, "open");
  const openState = signal(false);
  const highlight = signal(-1);
  const parts = signal<{
    trigger: HTMLButtonElement;
    popup: HTMLDivElement;
  } | null>(null);
  const topologyRevision = signal(0);
  const classRevision = signal(0);
  let topologyVersion = 0;
  let classVersion = 0;
  let initialized = false;
  const classControllers = new WeakMap<HTMLElement, (partClass?: string | null) => void>();

  const open = useProp<boolean>("open", {
    ...booleanProp("open"),
    get: () => openState(),
    onSet: (value, commit) => {
      controlled = true;
      if (initialized) requestOpen(value, false, true);
      commit(value);
    },
  });
  const defaultOpen = useProp<boolean>("defaultOpen", booleanProp("default-open"));
  const disabled = useProp<boolean>("disabled", booleanProp("disabled"));
  const modal = useProp<boolean>("modal", booleanPropDefaultTrue("modal"));
  const loopFocus = useProp<boolean>("loopFocus", booleanPropDefaultTrue("loop-focus"));
  const orientation = useProp<Orientation>(
    "orientation",
    enumProp("orientation", orientations, "vertical"),
  );
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
  const openOnHover = useProp<boolean>("openOnHover", booleanProp("open-on-hover"));
  const delay = useProp<number>("delay", numberProp("delay"));
  const closeDelay = useProp<number>("closeDelay", numberProp("close-delay"));
  const triggerClass = useProp<string>("triggerClass", stringProp("trigger-class"));
  const popupClass = useProp<string>("popupClass", stringProp("popup-class"));
  const onOpenChange = useProp<ChangeCallback<boolean>>(
    "onOpenChange",
    callbackProp<boolean>("onOpenChange"),
  );
  const applyPartClass = (part: HTMLElement, marker: string, value: string) => {
    let apply = classControllers.get(part);
    if (!apply) {
      apply = createPartClassController(part, marker, value);
      classControllers.set(part, apply);
    }
    apply(value);
  };

  let typeBuffer = "";
  let typeTimer = 0;
  let scrollHeld = false;
  const setScrollLock = (wantLock: boolean) => {
    if (wantLock && !scrollHeld) {
      scrollHeld = true;
      acquireScrollLock(host);
    } else if (!wantLock && scrollHeld) {
      scrollHeld = false;
      releaseScrollLock(host);
    }
  };

  const resetTypeahead = () => {
    typeBuffer = "";
    window.clearTimeout(typeTimer);
  };

  // Label typeahead over enabled items: accumulate printable chars (500ms
  // window), jump to the next match after the current item, wrap around.
  // Repeating one char cycles through its matches.
  const matchTypeahead = (items: HTMLElement[], current: number, char: string): number => {
    if (char.length !== 1 || char === " " || items.length === 0) return -1;
    window.clearTimeout(typeTimer);
    typeTimer = window.setTimeout(() => {
      typeBuffer = "";
    }, 500);
    const lower = char.toLowerCase();
    const repeated =
      typeBuffer.length > 0 && (typeBuffer + lower).split("").every((c) => c === lower);
    typeBuffer = (repeated ? lower : typeBuffer + lower).slice(-32);
    const labels = items.map((item) =>
      (item.dataset.label ?? item.textContent ?? "").trim().toLowerCase(),
    );
    const from = (current + 1 + items.length) % items.length;
    for (let step = 0; step < items.length; step++) {
      const index = (from + step) % items.length;
      if (labels[index]!.startsWith(typeBuffer)) return index;
    }
    return -1;
  };

  const checkableValue = (item: HTMLElement): string =>
    item.dataset.value ?? (item.dataset.label ?? item.textContent ?? "").trim();

  const toggleCheckbox = (item: HTMLElement) => {
    if (isMenuItemDisabled(item)) return;
    const checked = !item.hasAttribute("data-checked");
    item.toggleAttribute("data-checked", checked);
    setAttributeValue(item, "aria-checked", String(checked));
    host.dispatchEvent(
      new CustomEvent("checked-change", {
        bubbles: true,
        composed: true,
        detail: { checked, value: checkableValue(item) },
      }),
    );
  };

  const selectRadio = (item: HTMLElement, popup: HTMLElement) => {
    if (isMenuItemDisabled(item)) return;
    const group = radioGroupOf(item, popup);
    const value = item.dataset.value ?? "";
    if (group && group.dataset.value !== value) group.dataset.value = value;
    const siblings = group
      ? [...group.querySelectorAll<HTMLElement>("[data-radio-item]")].filter(
          (sibling) => popup.contains(sibling) && belongsToHost(sibling, host),
        )
      : [item];
    for (const sibling of siblings) {
      const checked = (sibling.dataset.value ?? "") === value;
      sibling.toggleAttribute("data-checked", checked);
      setAttributeValue(sibling, "aria-checked", String(checked));
    }
    host.dispatchEvent(
      new CustomEvent("radio-change", {
        bubbles: true,
        composed: true,
        detail: { value, group: group?.dataset.name ?? "" },
      }),
    );
  };

  const activateItem = (item: HTMLElement, popup: HTMLElement) => {
    if (isMenuItemDisabled(item)) return;
    if (item.hasAttribute("data-checkbox-item")) toggleCheckbox(item);
    else if (item.hasAttribute("data-radio-item")) selectRadio(item, popup);
    else item.click();
    if (wantsMenuClose(item)) requestOpen(false, true);
  };

  const requestOpen = (next: boolean, refocusTrigger = false, force = false) => {
    if (next === openState()) {
      // Dismiss may have closed first (document capture runs before the
      // host key handler); still honor the focus return.
      if (!next && refocusTrigger) parts()?.trigger.focus();
      return;
    }
    if (!force && next && disabled()) return;
    emit(host, onOpenChange(), "open-change", "open", next);
    if (controlled && !force) {
      if (!next && refocusTrigger) parts()?.trigger.focus();
      return;
    }

    try {
      openState(next);
    } catch (error) {
      openState(!next);
      throw error;
    }
    if (!next) highlight(-1);
    if (!next) resetTypeahead();
    if (!next && refocusTrigger) parts()?.trigger.focus();
  };

  const enabledItems = (): HTMLElement[] => {
    const currentParts = parts();
    if (!currentParts) return [];
    return menuItems(host, currentParts.popup).filter((item) => !isMenuItemDisabled(item));
  };

  const moveHighlight = (direction: 1 | -1) => {
    const items = enabledItems();
    if (items.length === 0) return;
    const all = parts() ? menuItems(host, parts()!.popup) : [];
    const current = all.indexOf(document.activeElement as HTMLElement);
    const currentEnabled = items.indexOf(all[current] as HTMLElement);
    let next: number;
    if (currentEnabled === -1) {
      next = direction === 1 ? 0 : items.length - 1;
    } else if (loopFocus()) {
      next = (currentEnabled + direction + items.length) % items.length;
    } else {
      next = Math.min(items.length - 1, Math.max(0, currentEnabled + direction));
    }
    const target = items[next]!;
    highlight(all.indexOf(target));
    target.focus();
  };

  const highlightFirstOrLast = (first: boolean) => {
    const items = enabledItems();
    if (items.length === 0) return;
    const all = parts() ? menuItems(host, parts()!.popup) : [];
    const target = (first ? items[0] : items[items.length - 1])!;
    highlight(all.indexOf(target));
    target.focus();
  };

  const activateHighlighted = () => {
    const currentParts = parts();
    if (!currentParts) return;
    const all = menuItems(host, currentParts.popup);
    const focused = document.activeElement;
    const target =
      focused instanceof HTMLElement && all.includes(focused)
        ? focused
        : (all[highlight()] ?? null);
    if (!target) return;
    activateItem(target, currentParts.popup);
  };

  // `open` is the boolean state property, so imperative open is `show()`
  // (mirroring HTMLDialogElement, which pairs its `open` property with
  // `show()`/`close()` rather than an `open()` method).
  host.show = () => {
    if (!disabled()) requestOpen(true, false, true);
  };
  host.close = () => requestOpen(false, false, true);
  host.toggle = (force?: boolean) => {
    const next = typeof force === "boolean" ? force : !openState();
    if (!next || !disabled()) requestOpen(next, false, true);
  };

  onMount(() => {
    let stopObserver: (() => void) | undefined;
    let stopTopology: (() => void) | undefined;
    let stopControl: (() => void) | undefined;
    let stopClasses: (() => void) | undefined;
    let stopState: (() => void) | undefined;
    let stopConfig: (() => void) | undefined;
    let stopFloating: (() => void) | undefined;
    let stopHover: (() => void) | undefined;
    let stopBehavior: (() => void) | undefined;

    const teardownFloating = () => {
      stopFloating?.();
      stopFloating = undefined;
    };

    const click = (event: MouseEvent) => {
      const target = event.target;
      const currentParts = parts();
      if (!(target instanceof Element) || !currentParts) return;
      if (currentParts.trigger.contains(target)) {
        if (!openOnHover()) requestOpen(!openState());
        return;
      }
      const item = target.closest<HTMLElement>("[data-menu-item], [role='menuitem']");
      if (
        item &&
        currentParts.popup.contains(item) &&
        belongsToHost(item, host) &&
        !isMenuItemDisabled(item)
      ) {
        if (item.hasAttribute("data-checkbox-item")) toggleCheckbox(item);
        else if (item.hasAttribute("data-radio-item")) selectRadio(item, currentParts.popup);
        if (wantsMenuClose(item)) requestOpen(false, true);
      }
    };
    const mouseover = (event: MouseEvent) => {
      const target = event.target;
      const currentParts = parts();
      if (!(target instanceof Element) || !currentParts || !openState()) return;
      const item = target.closest<HTMLElement>("[data-menu-item], [role='menuitem']");
      if (item && currentParts.popup.contains(item) && belongsToHost(item, host)) {
        if (!isMenuItemDisabled(item)) highlight(menuItems(host, currentParts.popup).indexOf(item));
      }
    };
    const keydown = (event: KeyboardEvent) => {
      const target = event.target;
      const currentParts = parts();
      if (!(target instanceof Element) || !currentParts) return;
      const horizontal = orientation() === "horizontal";
      const nextKey = horizontal ? "ArrowRight" : "ArrowDown";
      const prevKey = horizontal ? "ArrowLeft" : "ArrowUp";

      if (currentParts.trigger.contains(target) && !currentParts.popup.contains(target)) {
        if (event.key === nextKey || event.key === prevKey || event.key === "Enter") {
          if (!openState()) {
            event.preventDefault();
            requestOpen(true);
            queueMicrotask(() => highlightFirstOrLast(event.key !== prevKey));
          } else if (event.key === nextKey || event.key === prevKey) {
            event.preventDefault();
            if (event.key === nextKey) moveHighlight(1);
            else moveHighlight(-1);
          }
        } else if (event.key === "Escape" && openState()) {
          requestOpen(false, true);
        }
        return;
      }

      if (!currentParts.popup.contains(target)) return;
      if (
        event.key.length === 1 &&
        event.key !== " " &&
        !event.ctrlKey &&
        !event.metaKey &&
        !event.altKey
      ) {
        const all = menuItems(host, currentParts.popup);
        const items = all.filter((candidate) => !isMenuItemDisabled(candidate));
        const match = matchTypeahead(
          items,
          items.indexOf(document.activeElement as HTMLElement),
          event.key,
        );
        if (match !== -1) {
          event.preventDefault();
          const found = items[match]!;
          highlight(all.indexOf(found));
          found.focus();
          return;
        }
      }
      switch (event.key) {
        case nextKey:
          event.preventDefault();
          moveHighlight(1);
          break;
        case prevKey:
          event.preventDefault();
          moveHighlight(-1);
          break;
        case "Home":
          event.preventDefault();
          highlightFirstOrLast(true);
          break;
        case "End":
          event.preventDefault();
          highlightFirstOrLast(false);
          break;
        case "Enter":
        case " ":
          event.preventDefault();
          activateHighlighted();
          break;
        case "Escape":
          event.preventDefault();
          requestOpen(false, true);
          break;
        case "Tab":
          requestOpen(false);
          break;
      }
    };
    const cleanup = () => {
      // Release a held modal scroll-lock before tearing down effects.
      setScrollLock(false);
      window.clearTimeout(typeTimer);
      host.removeEventListener("click", click);
      host.removeEventListener("mouseover", mouseover);
      host.removeEventListener("keydown", keydown);
      teardownFloating();
      stopBehavior?.();
      stopHover?.();
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
                record.attributeName === "data-menu-item" ||
                record.attributeName === "data-checkbox-item" ||
                record.attributeName === "data-radio-item" ||
                record.attributeName === "data-radio-group" ||
                record.attributeName === "data-disabled" ||
                record.attributeName === "data-close-on-click",
            )
          ) {
            topologyRevision(++topologyVersion);
          } else {
            classRevision(++classVersion);
          }
        },
        [
          "class",
          "slot",
          "data-menu-item",
          "data-checkbox-item",
          "data-radio-item",
          "data-radio-group",
          "data-disabled",
          "data-close-on-click",
          "data-checked",
          "data-value",
          "data-label",
        ],
      );
      stopTopology = effect(() => {
        topologyRevision();
        parts(null);

        const popup = requireSlottedElement(host, "popup", HTMLDivElement);
        const trigger = requireSlottedElement(host, "trigger", HTMLButtonElement);
        popup.id ||= nextId("bwc-menu-popup");
        popup.dataset.testid ||= "bwc-menu-popup";
        setAttributeValue(popup, "role", "menu");
        if (!popup.hasAttribute("data-floating")) popup.setAttribute("data-floating", "");
        const arrow = popup.querySelector<HTMLElement>("[data-arrow]");
        if (arrow && belongsToHost(arrow, host) && !arrow.hasAttribute("data-floating-arrow")) {
          arrow.setAttribute("data-floating-arrow", "");
        }
        trigger.id ||= nextId("bwc-menu-trigger");
        setAttributeValue(trigger, "aria-haspopup", "menu");
        setAttributeValue(trigger, "aria-controls", popup.id);
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
        decorateButton(
          currentParts.trigger,
          "menu-trigger",
          "bwc-menu-trigger",
          currentParts.trigger.className,
        );
        applyPartClass(currentParts.trigger, "menu-trigger", triggerClass());
        applyPartClass(currentParts.popup, "menu-popup", popupClass());
      });
      stopState = effect(() => {
        const currentParts = parts();
        if (!currentParts) return;
        const isOpen = openState();
        const isDisabled = disabled();
        const isModal = modal();
        const highlighted = highlight();
        const { popup, trigger } = currentParts;
        if (trigger.disabled !== isDisabled) trigger.disabled = isDisabled;
        const cursor = isDisabled ? "not-allowed" : "pointer";
        if (trigger.style.cursor !== cursor) trigger.style.cursor = cursor;
        setAttributeValue(trigger, "aria-expanded", String(isOpen));
        setAttributeValue(popup, "aria-orientation", orientation());
        for (const node of [trigger, popup]) {
          toggleState(node, "data-open", isOpen);
          toggleState(node, "data-closed", !isOpen);
          toggleState(node, "data-disabled", isDisabled);
          toggleState(node, "data-modal", isModal);
        }
        syncPopupVisibility(popup, isOpen);

        // Modal scroll-lock via the shared helper; light-dismiss still applies.
        setScrollLock(isOpen && isModal);

        const backdrop = popup.querySelector<HTMLElement>("[data-backdrop]");
        if (backdrop && belongsToHost(backdrop, host)) {
          toggleState(backdrop, "data-open", isOpen);
          toggleState(backdrop, "data-closed", !isOpen);
          backdrop.hidden = !isOpen;
        }

        for (const separator of popup.querySelectorAll<HTMLElement>("[data-separator]")) {
          if (!belongsToHost(separator, host)) continue;
          if (!separator.hasAttribute("role")) setAttributeValue(separator, "role", "separator");
        }
        for (const group of popup.querySelectorAll<HTMLElement>("[data-group]")) {
          if (!belongsToHost(group, host)) continue;
          if (!group.hasAttribute("role")) setAttributeValue(group, "role", "group");
          const label = group.querySelector<HTMLElement>("[data-group-label]");
          if (label && belongsToHost(label, host)) {
            label.id ||= nextId("bwc-menu-group-label");
            setAttributeValue(group, "aria-labelledby", label.id);
          }
        }

        const items = menuItems(host, popup);
        for (const [index, item] of items.entries()) {
          const active = isOpen && index === highlighted;
          toggleState(item, "data-highlighted", active);
          const tabIndex =
            active || (!isOpen ? false : highlighted === -1 && index === 0) ? "0" : "-1";
          if (item.getAttribute("tabindex") !== tabIndex) item.setAttribute("tabindex", tabIndex);
          if (item.hasAttribute("data-checkbox-item")) {
            if (!item.hasAttribute("role")) setAttributeValue(item, "role", "menuitemcheckbox");
            setAttributeValue(item, "aria-checked", String(item.hasAttribute("data-checked")));
          } else if (item.hasAttribute("data-radio-item")) {
            if (!item.hasAttribute("role")) setAttributeValue(item, "role", "menuitemradio");
            const group = radioGroupOf(item, popup);
            const checked = group
              ? (item.dataset.value ?? "") === group.dataset.value
              : item.hasAttribute("data-checked");
            toggleState(item, "data-checked", checked);
            setAttributeValue(item, "aria-checked", String(checked));
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
      stopBehavior = effect(() => {
        const currentParts = parts();
        if (!currentParts) return;
        const currentSide = side();
        const currentAlign = align();
        const currentSideOffset = sideOffset();
        const currentAlignOffset = alignOffset();
        const currentStrategy = strategy();
        const currentAnchor = anchor();
        const hover = openOnHover();
        const openDelay = delay();
        const closeDelayValue = closeDelay();
        const isOpen = openState();
        teardownFloating();
        stopHover?.();
        stopHover = undefined;
        if (hover) {
          const { popup, trigger } = currentParts;
          stopHover = attachHover(trigger, popup, {
            openDelay,
            closeDelay: closeDelayValue,
            onOpen: () => requestOpen(true),
            onClose: () => requestOpen(false),
          });
        }
        if (!isOpen) return;
        const { popup, trigger } = currentParts;
        const anchorEl = resolveAnchor(host, currentAnchor, trigger) ?? trigger;
        const update = () => {
          const arrow = popup.querySelector<HTMLElement>("[data-arrow]");
          const arrowEl = arrow && belongsToHost(arrow, host) ? arrow : null;
          positionFloating(anchorEl, popup, arrowEl, {
            side: currentSide,
            align: currentAlign,
            sideOffset: currentSideOffset,
            alignOffset: currentAlignOffset,
            strategy: currentStrategy,
          });
        };
        const stopTracking = trackAnchor(anchorEl, popup, update);
        // Light-dismiss always applies; `modal` adds body scroll-lock while open.
        const stopDismiss = attachDismiss(popup, [trigger, anchorEl], {
          outside: true,
          escape: true,
          onDismiss: () => requestOpen(false),
        });
        update();
        stopFloating = () => {
          stopDismiss();
          stopTracking();
        };
      });
      host.addEventListener("click", click);
      host.addEventListener("mouseover", mouseover);
      host.addEventListener("keydown", keydown);
      return cleanup;
    } catch (error) {
      cleanup();
      throw error;
    }
  });

  return html`<slot name="trigger"></slot><slot name="popup"></slot>`;
});
