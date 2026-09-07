import selectCSS from "./select.css?inline";
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
  parseJsonStrings,
  requireSlottedElement,
  setAttributeValue,
  stringProp,
  toggleState,
  type ChangeCallback,
} from "../shared";
import {
  acquireScrollLock,
  attachDismiss,
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

if (typeof document !== "undefined" && !document.getElementById("bwc-select-style")) {
  const style = document.createElement("style");
  style.id = "bwc-select-style";
  style.textContent = `${floatingCSS}\n${selectCSS}`;
  document.head.append(style);
}

const sides = floatingSides;
type Side = FloatingSide;
const aligns = floatingAligns;
type Align = FloatingAlign;
const strategies = ["absolute", "fixed"] as const;
type Strategy = FloatingStrategy;

/** Select options: `[data-option][data-value]` elements owned by this host. */
export function selectOptions(host: HTMLElement, popup: HTMLElement): HTMLElement[] {
  return [...popup.querySelectorAll<HTMLElement>("[data-option]")].filter((element) =>
    belongsToHost(element, host),
  );
}

export function isOptionDisabled(option: HTMLElement): boolean {
  return (
    option.hasAttribute("data-disabled") ||
    option.hasAttribute("disabled") ||
    option.getAttribute("aria-disabled") === "true"
  );
}

export function optionValue(option: HTMLElement): string {
  return option.dataset.value ?? "";
}

export function optionLabel(option: HTMLElement): string {
  return option.dataset.label ?? option.textContent?.trim() ?? "";
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

/** Keep scroll-arrow affordances honest: disable at the scrolled edge. */
export function syncScrollArrows(host: HTMLElement, popup: HTMLElement): void {
  const scroller = popup.querySelector<HTMLElement>("[data-list]") ?? popup;
  const max = scroller.scrollHeight - scroller.clientHeight;
  const scrollable = max > 1;
  const edges: Array<[string, boolean]> = [
    ["[data-scroll-up]", scroller.scrollTop <= 0],
    ["[data-scroll-down]", scroller.scrollTop >= max],
  ];
  for (const [selector, atEdge] of edges) {
    const arrow = popup.querySelector<HTMLElement>(selector);
    if (!arrow || !belongsToHost(arrow, host)) continue;
    const off = !scrollable || atEdge;
    toggleState(arrow, "data-disabled", off);
    if (arrow instanceof HTMLButtonElement && arrow.disabled !== off) arrow.disabled = off;
  }
}

export type BwcSelectElement = HTMLElement & {
  open: boolean;
  defaultOpen: boolean;
  value: string;
  defaultValue: string;
  /** Multi-select values (`values` attribute is a JSON string array). */
  values: string[];
  defaultValues: string[];
  /** Multi-select mode: options toggle without closing. Default false. */
  multiple: boolean;
  /** Reflected into hidden input(s) for native form participation. */
  name: string;
  /** Passed to hidden input(s) to associate with a form by id. */
  form: string;
  required: boolean;
  /** Open allowed, but selection changes are ignored. */
  readonly: boolean;
  disabled: boolean;
  /** Lock body scroll while open; light-dismiss always applies. Default true. */
  modal: boolean;
  /** Wrap highlight past the first/last option. Default true. */
  loopFocus: boolean;
  placeholder: string;
  /** Size the popup to at least the trigger width while open. Default true. */
  matchTriggerWidth: boolean;
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
  onValueChange: ChangeCallback<string>;
  onValuesChange: ChangeCallback<string[]>;
  /** Imperative open. Respects `disabled`; applies and notifies in controlled mode. */
  show: () => void;
  /** Imperative close. Applies and notifies in controlled mode. */
  close: () => void;
  /** Toggle, or force with a boolean. Applies and notifies in controlled mode. */
  toggle: (force?: boolean) => void;
  /** Select a value. Ignored when `readonly`/`disabled`. */
  selectValue: (next: string) => void;
  /** Replace all values in `multiple` mode. Ignored when `readonly`/`disabled`. */
  selectValues: (next: string[]) => void;
  /** Clear the value(s). Ignored when `readonly`/`disabled`. */
  clear: () => void;
};

export const BwcSelectElement = defineComponent<BwcSelectElement>("bwc-select", () => {
  const host = useHost<BwcSelectElement>();
  let openControlled = host.hasAttribute("open") || Object.hasOwn(host, "open");
  let valueControlled = host.hasAttribute("value") || Object.hasOwn(host, "value");
  let valuesControlled = host.hasAttribute("values") || Object.hasOwn(host, "values");
  const openState = signal(false);
  const valueState = signal("");
  const valuesState = signal<string[]>([]);
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
    onSet: (next, commit) => {
      openControlled = true;
      if (initialized) requestOpen(next, false, true);
      commit(next);
    },
  });
  const defaultOpen = useProp<boolean>("defaultOpen", booleanProp("default-open"));
  const value = useProp<string>("value", {
    ...stringProp("value"),
    get: () => valueState(),
    onSet: (next, commit) => {
      valueControlled = true;
      if (initialized) requestValue(next, true, false);
      commit(next);
    },
  });
  const defaultValue = useProp<string>("defaultValue", stringProp("default-value"));
  const values = useProp<string[]>("values", {
    attribute: "values",
    defaultValue: [],
    fromAttribute: (raw: string | null) => parseJsonStrings(raw, "values"),
    fromProperty: (raw: unknown) => {
      if (!Array.isArray(raw) || raw.some((item) => typeof item !== "string")) {
        throw new TypeError("values must be a string array");
      }
      return [...raw] as string[];
    },
    toAttribute: (next: string[]) => JSON.stringify(next),
    get: () => valuesState(),
    onSet: (next, commit) => {
      valuesControlled = true;
      if (initialized) requestValues(next, true);
      commit(next);
    },
  });
  const defaultValues = useProp<string[]>("defaultValues", {
    attribute: "default-values",
    defaultValue: [],
    fromAttribute: (raw: string | null) => parseJsonStrings(raw, "default-values"),
    fromProperty: (raw: unknown) => {
      if (!Array.isArray(raw) || raw.some((item) => typeof item !== "string")) {
        throw new TypeError("defaultValues must be a string array");
      }
      return [...raw] as string[];
    },
    toAttribute: (next: string[]) => JSON.stringify(next),
  });
  const multiple = useProp<boolean>("multiple", booleanProp("multiple"));
  const name = useProp<string>("name", stringProp("name"));
  const form = useProp<string>("form", stringProp("form"));
  const required = useProp<boolean>("required", booleanProp("required"));
  const readonly = useProp<boolean>("readonly", booleanProp("readonly"));
  const disabled = useProp<boolean>("disabled", booleanProp("disabled"));
  const modal = useProp<boolean>("modal", booleanPropDefaultTrue("modal"));
  const loopFocus = useProp<boolean>("loopFocus", booleanPropDefaultTrue("loop-focus"));
  const placeholder = useProp<string>("placeholder", stringProp("placeholder"));
  const matchTriggerWidth = useProp<boolean>(
    "matchTriggerWidth",
    booleanPropDefaultTrue("match-trigger-width"),
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
  const triggerClass = useProp<string>("triggerClass", stringProp("trigger-class"));
  const popupClass = useProp<string>("popupClass", stringProp("popup-class"));
  const onOpenChange = useProp<ChangeCallback<boolean>>(
    "onOpenChange",
    callbackProp<boolean>("onOpenChange"),
  );
  const onValueChange = useProp<ChangeCallback<string>>(
    "onValueChange",
    callbackProp<string>("onValueChange"),
  );
  const onValuesChange = useProp<ChangeCallback<string[]>>(
    "onValuesChange",
    callbackProp<string[]>("onValuesChange"),
  );
  openState(openControlled ? open() : defaultOpen());
  valueState(valueControlled ? value() : defaultValue());
  valuesState(valuesControlled ? values() : defaultValues());
  if (multiple() && valuesState().length > 0 && !valueControlled) {
    valueState(valuesState()[0] ?? "");
  }

  const applyPartClass = (part: HTMLElement, marker: string, value: string) => {
    let apply = classControllers.get(part);
    if (!apply) {
      apply = createPartClassController(part, marker, value);
      classControllers.set(part, apply);
    }
    apply(value);
  };

  const requestOpen = (next: boolean, refocusTrigger = false, force = false) => {
    if (next === openState()) {
      if (!next && refocusTrigger) parts()?.trigger.focus();
      return;
    }
    if (!force && next && disabled()) return;
    emit(host, onOpenChange(), "open-change", "open", next);
    if (openControlled && !force) {
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

  const requestValue = (next: string, force = false, closePopup = true) => {
    if (!force && (readonly() || disabled())) return;
    const previous = valueState();
    if (next !== previous) {
      emit(host, onValueChange(), "value-change", "value", next);
      if (!valueControlled || force) {
        try {
          valueState(next);
        } catch (error) {
          valueState(previous);
          throw error;
        }
      }
    }
    if (closePopup) requestOpen(false, true);
  };

  const requestValues = (next: string[], force = false) => {
    if (!force && (readonly() || disabled())) return;
    const current = valuesState();
    const changed =
      current.length !== next.length || current.some((entry, index) => entry !== next[index]);
    if (changed) {
      emit(host, onValuesChange(), "values-change", "values", [...next]);
      if (!valuesControlled || force) {
        try {
          valuesState([...next]);
        } catch (error) {
          valuesState(current);
          throw error;
        }
      }
    }
    // Keep the single-value mirror on the first selection for compat.
    const first = next[0] ?? "";
    if (first !== valueState() && !valueControlled) valueState(first);
  };

  // Toggle one value in `multiple` mode; the popup stays open so more
  // options can be picked (Base UI parity).
  const toggleValue = (next: string) => {
    if (readonly() || disabled()) return;
    const current = valuesState();
    requestValues(
      current.includes(next) ? current.filter((entry) => entry !== next) : [...current, next],
    );
  };

  const resetTypeahead = () => {
    typeBuffer = "";
    window.clearTimeout(typeTimer);
  };

  const matchTypeahead = (options: HTMLElement[], current: number, char: string): number => {
    if (char.length !== 1 || char === " " || options.length === 0) return -1;
    window.clearTimeout(typeTimer);
    typeTimer = window.setTimeout(() => {
      typeBuffer = "";
    }, 500);
    const lower = char.toLowerCase();
    const repeated =
      typeBuffer.length > 0 && (typeBuffer + lower).split("").every((c) => c === lower);
    typeBuffer = (repeated ? lower : typeBuffer + lower).slice(-32);
    const labels = options.map((option) => optionLabel(option).toLowerCase());
    const from = (current + 1 + options.length) % options.length;
    for (let step = 0; step < options.length; step++) {
      const index = (from + step) % options.length;
      if (labels[index]!.startsWith(typeBuffer)) return index;
    }
    return -1;
  };

  // Label typeahead over enabled options: highlight + focus, never select.
  const runOptionTypeahead = (char: string): boolean => {
    const currentParts = parts();
    if (!currentParts) return false;
    const all = selectOptions(host, currentParts.popup);
    const options = all.filter((option) => !isOptionDisabled(option));
    const match = matchTypeahead(
      options,
      options.indexOf(document.activeElement as HTMLElement),
      char,
    );
    if (match === -1) return false;
    const found = options[match]!;
    highlight(all.indexOf(found));
    found.focus();
    return true;
  };

  const enabledOptions = (): HTMLElement[] => {
    const currentParts = parts();
    if (!currentParts) return [];
    return selectOptions(host, currentParts.popup).filter((option) => !isOptionDisabled(option));
  };

  const moveHighlight = (direction: 1 | -1) => {
    const options = enabledOptions();
    if (options.length === 0) return;
    const all = parts() ? selectOptions(host, parts()!.popup) : [];
    const current = all.indexOf(document.activeElement as HTMLElement);
    const currentEnabled = options.indexOf(all[current] as HTMLElement);
    let next: number;
    if (currentEnabled === -1) {
      next = direction === 1 ? 0 : options.length - 1;
    } else if (loopFocus()) {
      next = (currentEnabled + direction + options.length) % options.length;
    } else {
      next = Math.min(options.length - 1, Math.max(0, currentEnabled + direction));
    }
    const target = options[next]!;
    highlight(all.indexOf(target));
    target.focus();
  };

  const highlightEdge = (first: boolean) => {
    const options = enabledOptions();
    if (options.length === 0) return;
    const all = parts() ? selectOptions(host, parts()!.popup) : [];
    const target = (first ? options[0] : options[options.length - 1])!;
    highlight(all.indexOf(target));
    target.focus();
  };

  const selectHighlighted = () => {
    const currentParts = parts();
    if (!currentParts) return;
    const all = selectOptions(host, currentParts.popup);
    const focused = document.activeElement;
    const target =
      focused instanceof HTMLElement && all.includes(focused)
        ? focused
        : (all[highlight()] ?? null);
    if (!target || isOptionDisabled(target)) return;
    if (multiple()) toggleValue(optionValue(target));
    else requestValue(optionValue(target));
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
  host.selectValue = (next: string) => {
    if (readonly() || disabled()) return;
    if (multiple()) {
      if (!valuesState().includes(next)) requestValues([...valuesState(), next], true);
    } else {
      requestValue(next, true);
    }
    requestOpen(false, true, true);
  };
  host.selectValues = (next: string[]) => {
    if (readonly() || disabled()) return;
    if (!multiple()) {
      if (next.length > 0) requestValue(next[0]!, true);
    } else {
      requestValues([...next], true);
    }
    requestOpen(false, true, true);
  };
  host.clear = () => {
    if (readonly() || disabled()) return;
    if (multiple()) requestValues([], true);
    else requestValue("", true);
  };

  onMount(() => {
    let stopObserver: (() => void) | undefined;
    let stopTopology: (() => void) | undefined;
    let stopControl: (() => void) | undefined;
    let stopClasses: (() => void) | undefined;
    let stopState: (() => void) | undefined;
    let stopConfig: (() => void) | undefined;
    let stopFloating: (() => void) | undefined;
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
        requestOpen(!openState());
        return;
      }
      const scroller = target.closest<HTMLElement>("[data-scroll-up], [data-scroll-down]");
      if (scroller && currentParts.popup.contains(scroller) && belongsToHost(scroller, host)) {
        const atEdge =
          scroller.hasAttribute("data-disabled") ||
          scroller.getAttribute("aria-disabled") === "true";
        if (!atEdge) {
          const list =
            currentParts.popup.querySelector<HTMLElement>("[data-list]") ?? currentParts.popup;
          const delta = scroller.hasAttribute("data-scroll-up") ? -1 : 1;
          list.scrollBy({ top: delta * Math.max(list.clientHeight * 0.8, 48) });
        }
        return;
      }
      const option = target.closest<HTMLElement>("[data-option]");
      if (
        option &&
        currentParts.popup.contains(option) &&
        belongsToHost(option, host) &&
        !isOptionDisabled(option)
      ) {
        if (multiple()) toggleValue(optionValue(option));
        else requestValue(optionValue(option));
      }
    };
    const mouseover = (event: MouseEvent) => {
      const target = event.target;
      const currentParts = parts();
      if (!(target instanceof Element) || !currentParts || !openState()) return;
      const option = target.closest<HTMLElement>("[data-option]");
      if (option && currentParts.popup.contains(option) && belongsToHost(option, host)) {
        if (!isOptionDisabled(option))
          highlight(selectOptions(host, currentParts.popup).indexOf(option));
      }
    };
    const keydown = (event: KeyboardEvent) => {
      const target = event.target;
      const currentParts = parts();
      if (!(target instanceof Element) || !currentParts) return;

      if (currentParts.trigger.contains(target) && !currentParts.popup.contains(target)) {
        if (
          event.key.length === 1 &&
          event.key !== " " &&
          !event.ctrlKey &&
          !event.metaKey &&
          !event.altKey
        ) {
          event.preventDefault();
          if (!openState()) {
            requestOpen(true);
            const char = event.key;
            queueMicrotask(() => runOptionTypeahead(char));
          } else {
            runOptionTypeahead(event.key);
          }
          return;
        }
        if (event.key === "ArrowDown" || event.key === "ArrowUp" || event.key === "Enter") {
          if (!openState()) {
            event.preventDefault();
            requestOpen(true);
            const first = event.key !== "ArrowUp";
            queueMicrotask(() => highlightEdge(first));
          } else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            moveHighlight(event.key === "ArrowDown" ? 1 : -1);
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
        if (runOptionTypeahead(event.key)) event.preventDefault();
      }
      switch (event.key) {
        case "ArrowDown":
          event.preventDefault();
          moveHighlight(1);
          break;
        case "ArrowUp":
          event.preventDefault();
          moveHighlight(-1);
          break;
        case "Home":
          event.preventDefault();
          highlightEdge(true);
          break;
        case "End":
          event.preventDefault();
          highlightEdge(false);
          break;
        case "Enter":
        case " ":
          event.preventDefault();
          selectHighlighted();
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
                record.attributeName === "data-option" ||
                record.attributeName === "data-value" ||
                record.attributeName === "data-label" ||
                record.attributeName === "data-disabled",
            )
          ) {
            topologyRevision(++topologyVersion);
          } else {
            classRevision(++classVersion);
          }
        },
        ["class", "slot", "data-option", "data-value", "data-label", "data-disabled"],
      );
      stopTopology = effect(() => {
        topologyRevision();
        parts(null);

        const popup = requireSlottedElement(host, "popup", HTMLDivElement);
        const trigger = requireSlottedElement(host, "trigger", HTMLButtonElement);
        popup.id ||= nextId("bwc-select-popup");
        popup.dataset.testid ||= "bwc-select-popup";
        setAttributeValue(popup, "role", "listbox");
        if (!popup.hasAttribute("data-floating")) popup.setAttribute("data-floating", "");
        const arrow = popup.querySelector<HTMLElement>("[data-arrow]");
        if (arrow && belongsToHost(arrow, host) && !arrow.hasAttribute("data-floating-arrow")) {
          arrow.setAttribute("data-floating-arrow", "");
        }
        trigger.id ||= nextId("bwc-select-trigger");
        setAttributeValue(trigger, "aria-haspopup", "listbox");
        setAttributeValue(trigger, "aria-controls", popup.id);
        popup.addEventListener("scroll", () => syncScrollArrows(host, popup), true);
        parts({ popup, trigger });
      });
      stopControl = effect(() => {
        const next = open();
        if (next) openControlled = true;
        const nextValue = value();
        if (valueControlled || host.hasAttribute("value")) valueControlled = true;
        const nextValues = values();
        if (valuesControlled || host.hasAttribute("values")) valuesControlled = true;
        if (!initialized) {
          initialized = true;
          openState(openControlled ? next : defaultOpen());
          valueState(valueControlled ? nextValue : defaultValue());
          valuesState(valuesControlled ? nextValues : defaultValues());
        } else {
          if (next) openState(true);
          else if (openControlled) openState(false);
          if (valueControlled) valueState(nextValue);
          if (valuesControlled) valuesState([...nextValues]);
        }
      });
      stopClasses = effect(() => {
        classRevision();
        const currentParts = parts();
        if (!currentParts) return;
        decorateButton(
          currentParts.trigger,
          "select-trigger",
          "bwc-select-trigger",
          currentParts.trigger.className,
        );
        applyPartClass(currentParts.trigger, "select-trigger", triggerClass());
        applyPartClass(currentParts.popup, "select-popup", popupClass());
      });
      stopState = effect(() => {
        const currentParts = parts();
        if (!currentParts) return;
        const isOpen = openState();
        const currentValue = valueState();
        const currentValues = valuesState();
        const isDisabled = disabled();
        const isModal = modal();
        const isMultiple = multiple();
        const highlighted = highlight();
        const { popup, trigger } = currentParts;
        if (trigger.disabled !== isDisabled) trigger.disabled = isDisabled;
        const cursor = isDisabled ? "not-allowed" : "pointer";
        if (trigger.style.cursor !== cursor) trigger.style.cursor = cursor;
        setAttributeValue(trigger, "aria-expanded", String(isOpen));
        for (const node of [trigger, popup]) {
          toggleState(node, "data-open", isOpen);
          toggleState(node, "data-closed", !isOpen);
          toggleState(node, "data-disabled", isDisabled);
          toggleState(node, "data-modal", isModal);
          toggleState(node, "data-multiple", isMultiple);
        }
        const showPlaceholder =
          (isMultiple ? currentValues.length === 0 : currentValue === "") && placeholder() !== "";
        toggleState(trigger, "data-placeholder", showPlaceholder);
        syncPopupVisibility(popup, isOpen);

        // Modal scroll-lock via the shared helper; light-dismiss still applies.
        setScrollLock(isOpen && isModal);

        const backdrop = popup.querySelector<HTMLElement>("[data-backdrop]");
        if (backdrop && belongsToHost(backdrop, host)) {
          toggleState(backdrop, "data-open", isOpen);
          toggleState(backdrop, "data-closed", !isOpen);
          backdrop.hidden = !isOpen;
        }
        syncScrollArrows(host, popup);

        const options = selectOptions(host, popup);
        const match = options.find((option) => optionValue(option) === currentValue) ?? null;
        for (const [index, option] of options.entries()) {
          const active = isOpen && index === highlighted;
          toggleState(option, "data-highlighted", active);
          const tabIndex = active || (highlighted === -1 && index === 0) ? "0" : "-1";
          if (option.getAttribute("tabindex") !== tabIndex)
            option.setAttribute("tabindex", tabIndex);
          const selected = isMultiple
            ? currentValues.includes(optionValue(option))
            : option === match;
          toggleState(option, "data-selected", selected);
          setAttributeValue(option, "aria-selected", String(selected));
          if (!option.hasAttribute("role")) setAttributeValue(option, "role", "option");
        }

        const display = trigger.querySelector("[data-value]");
        if (display) {
          const text = isMultiple
            ? currentValues
                .map((entry) => {
                  const found = options.find((option) => optionValue(option) === entry);
                  return found ? optionLabel(found) : entry;
                })
                .join(", ") || placeholder()
            : match
              ? optionLabel(match)
              : currentValue || placeholder();
          if (display.textContent !== text) display.textContent = text;
        }

        const currentName = name();
        const currentForm = form();
        const ownedHidden = [...host.children].filter(
          (child) =>
            child instanceof HTMLInputElement &&
            child.type === "hidden" &&
            !child.hasAttribute("slot"),
        ) as HTMLInputElement[];
        const decorateHidden = (input: HTMLInputElement, inputValue: string) => {
          if (input.name !== currentName) input.name = currentName;
          if (input.value !== inputValue) input.value = inputValue;
          if (currentForm !== "") {
            if (input.getAttribute("form") !== currentForm) input.setAttribute("form", currentForm);
          } else if (input.hasAttribute("form")) {
            input.removeAttribute("form");
          }
          if (input.required !== required()) input.required = required();
          if (input.disabled !== isDisabled) input.disabled = isDisabled;
        };
        if (currentName === "") {
          for (const input of ownedHidden) input.remove();
        } else if (!isMultiple) {
          for (const extra of ownedHidden.slice(1)) extra.remove();
          let hidden = ownedHidden[0];
          if (!hidden) {
            hidden = document.createElement("input");
            hidden.type = "hidden";
            host.prepend(hidden);
          }
          decorateHidden(hidden, currentValue);
        } else {
          // One hidden input per value (native multi-select convention:
          // nothing submits when empty).
          while (ownedHidden.length < currentValues.length) {
            const input = document.createElement("input");
            input.type = "hidden";
            host.prepend(input);
            ownedHidden.push(input);
          }
          while (ownedHidden.length > currentValues.length) ownedHidden.pop()?.remove();
          currentValues.forEach((entry, index) => decorateHidden(ownedHidden[index]!, entry));
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
        const widePopup = matchTriggerWidth();
        const isOpen = openState();
        teardownFloating();
        if (!isOpen) return;
        const { popup, trigger } = currentParts;
        const anchorEl = resolveAnchor(host, currentAnchor, trigger) ?? trigger;
        const update = () => {
          if (widePopup) {
            const width = `${trigger.getBoundingClientRect().width}px`;
            if (popup.style.minWidth !== width) popup.style.minWidth = width;
          }
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
