import navigationMenuCSS from "./navigation-menu.css?inline";
import floatingCSS from "../floating/floating.css?inline";
import { defineComponent, effect, html, onMount, signal, useHost, useProp } from "microfw";
import {
  booleanProp,
  booleanPropDefaultTrue,
  callbackProp,
  createPartClassController,
  decorateButton,
  emit,
  enumProp,
  nextId,
  numberProp,
  observeSlotSubtree,
  removeAttributeValue,
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
  trackAnchor,
  type FloatingAlign,
  type FloatingSide,
  type FloatingStrategy,
} from "../floating";

if (typeof document !== "undefined" && !document.getElementById("bwc-navigation-menu-style")) {
  const style = document.createElement("style");
  style.id = "bwc-navigation-menu-style";
  style.textContent = `${floatingCSS}\n${navigationMenuCSS}`;
  document.head.append(style);
}

const sides = floatingSides;
type Side = FloatingSide;
const aligns = floatingAligns;
type Align = FloatingAlign;
const strategies = ["absolute", "fixed"] as const;
type Strategy = FloatingStrategy;
const orientations = ["horizontal", "vertical"] as const;
type Orientation = (typeof orientations)[number];

export type BwcNavigationMenuElement = HTMLElement & {
  /** Id of the open panel ("" when closed). Present (or assigned) → controlled. */
  value: string;
  /** Seed for uncontrolled mode. */
  defaultValue: string;
  /** Disable the whole menu: open requests are ignored. */
  disabled: boolean;
  /** Wrap focus past the first/last trigger. Default true. */
  loopFocus: boolean;
  /** Roving direction. Default "horizontal". Invalid values throw. */
  orientation: Orientation;
  /** Hover-open delay in ms. Default 200. */
  delay: number;
  /** Hover-close delay in ms. Default 150. */
  closeDelay: number;
  side: Side;
  align: Align;
  sideOffset: number;
  alignOffset: number;
  strategy: Strategy;
  triggerClass: string;
  panelClass: string;
  onValueChange: ChangeCallback<string>;
  onOpenChange: ChangeCallback<boolean>;
  /** Imperative open of a panel by value. Respects `disabled`. */
  show: (value: string) => void;
  /** Imperative close. */
  close: () => void;
  /** Toggle a panel, or close when it (or nothing) is given while open. */
  toggle: (value?: string) => void;
};

type NavigationMenuParts = {
  triggers: HTMLButtonElement[];
  panels: HTMLElement[];
  panelByValue: Map<string, HTMLElement>;
};

const focusableSelector =
  'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"]), input:not([disabled]), select:not([disabled]), textarea:not([disabled])';

export const BwcNavigationMenuElement = defineComponent<BwcNavigationMenuElement>(
  "bwc-navigation-menu",
  () => {
    const host = useHost<BwcNavigationMenuElement>();
    let controlled = host.hasAttribute("value") || Object.hasOwn(host, "value");
    const valueState = signal("");
    const parts = signal<NavigationMenuParts | null>(null);
    const revision = signal(0);
    let version = 0;
    let initialized = false;
    const classControllers = new WeakMap<HTMLElement, (partClass?: string | null) => void>();

    const value = useProp<string>("value", {
      ...stringProp("value"),
      get: () => valueState(),
      onSet: (next, commit) => {
        controlled = true;
        if (initialized) requestValue(next, false, true);
        commit(next);
      },
    });
    const defaultValue = useProp<string>("defaultValue", stringProp("default-value"));
    const disabled = useProp<boolean>("disabled", booleanProp("disabled"));
    const loopFocus = useProp<boolean>("loopFocus", booleanPropDefaultTrue("loop-focus"));
    const orientation = useProp<Orientation>(
      "orientation",
      enumProp("orientation", orientations, "horizontal"),
    );
    const delay = useProp<number>("delay", numberProp("delay", 200));
    const closeDelay = useProp<number>("closeDelay", numberProp("close-delay", 150));
    const side = useProp<Side>("side", enumProp("side", sides, "bottom"));
    const align = useProp<Align>("align", enumProp("align", aligns, "start"));
    const sideOffset = useProp<number>("sideOffset", numberProp("side-offset"));
    const alignOffset = useProp<number>("alignOffset", numberProp("align-offset"));
    const strategy = useProp<Strategy>("strategy", enumProp("strategy", strategies, "fixed"));
    const triggerClass = useProp<string>("triggerClass", stringProp("trigger-class"));
    const panelClass = useProp<string>("panelClass", stringProp("panel-class"));
    const onValueChange = useProp<ChangeCallback<string>>(
      "onValueChange",
      callbackProp<string>("onValueChange"),
    );
    const onOpenChange = useProp<ChangeCallback<boolean>>(
      "onOpenChange",
      callbackProp<boolean>("onOpenChange"),
    );

    const applyPartClass = (part: HTMLElement, marker: string, classValue: string) => {
      let apply = classControllers.get(part);
      if (!apply) {
        apply = createPartClassController(part, marker, classValue);
        classControllers.set(part, apply);
      }
      apply(classValue);
    };

    /**
     * Total exit-transition time for a panel in ms (duration + delay,
     * longest of any comma-separated list). Reads computed style with an
     * inline-style fallback so author stylesheets and inline styles both
     * count; 0 (or unreadable style) means hide synchronously.
     */
    function transitionTotalMs(element: HTMLElement): number {
      let duration = "";
      let wait = "";
      try {
        const computed = getComputedStyle(element);
        duration = computed.transitionDuration || "";
        wait = computed.transitionDelay || "";
      } catch {
        duration = "";
        wait = "";
      }
      duration = [duration, element.style.transitionDuration].filter(Boolean).join(",");
      wait = [wait, element.style.transitionDelay].filter(Boolean).join(",");
      const longest = (raw: string): number => {
        let max = 0;
        for (const part of raw.split(",")) {
          const match = /^([\d.]+)(m?s)$/.exec(part.trim());
          if (!match) continue;
          const parsed = Number(match[1]);
          if (!Number.isFinite(parsed)) continue;
          max = Math.max(max, match[2] === "s" ? parsed * 1000 : parsed);
        }
        return max;
      };
      return longest(duration) + longest(wait);
    }

    // Per-panel enter/exit animation state (copied from the tooltip
    // pattern, but keyed per panel since an exit can run on one panel
    // while another is open).
    type PanelAnimation = {
      exiting: boolean;
      exitTimer: number;
      exitDetach: (() => void) | null;
      startToken: number;
      startRaf: number;
      startTimer: number;
    };
    const panelAnimations = new WeakMap<HTMLElement, PanelAnimation>();
    const animationOf = (panel: HTMLElement): PanelAnimation => {
      let state = panelAnimations.get(panel);
      if (!state) {
        state = {
          exiting: false,
          exitTimer: 0,
          exitDetach: null,
          startToken: 0,
          startRaf: 0,
          startTimer: 0,
        };
        panelAnimations.set(panel, state);
      }
      return state;
    };
    const cancelStartingStyle = (panel: HTMLElement) => {
      const state = animationOf(panel);
      state.startToken++;
      if (state.startRaf) {
        cancelAnimationFrame(state.startRaf);
        state.startRaf = 0;
      }
      if (state.startTimer) {
        window.clearTimeout(state.startTimer);
        state.startTimer = 0;
      }
    };
    const scheduleStartingStyleEnd = (panel: HTMLElement) => {
      cancelStartingStyle(panel);
      const state = animationOf(panel);
      const token = ++state.startToken;
      const remove = () => {
        state.startRaf = 0;
        state.startTimer = 0;
        if (token === state.startToken && panel.isConnected) {
          panel.removeAttribute("data-starting-style");
        }
      };
      if (typeof window.requestAnimationFrame === "function") {
        state.startRaf = window.requestAnimationFrame(() => {
          state.startRaf = window.requestAnimationFrame(remove);
        });
      } else {
        state.startTimer = window.setTimeout(remove, 0);
      }
    };
    const cancelExit = (panel: HTMLElement) => {
      const state = animationOf(panel);
      if (!state.exiting) return;
      state.exiting = false;
      if (state.exitTimer) window.clearTimeout(state.exitTimer);
      state.exitTimer = 0;
      state.exitDetach?.();
      state.exitDetach = null;
    };
    const beginExit = (panel: HTMLElement, finish: () => void) => {
      const state = animationOf(panel);
      if (state.exiting) return;
      cancelStartingStyle(panel);
      panel.removeAttribute("data-starting-style");
      const total = transitionTotalMs(panel);
      if (total <= 0) {
        finish();
        return;
      }
      state.exiting = true;
      panel.setAttribute("data-ending-style", "");
      // Flush styles so the ending frame transitions from the open frame.
      void panel.offsetWidth;
      const done = () => {
        if (!state.exiting) return;
        state.exiting = false;
        state.exitTimer = 0;
        state.exitDetach = null;
        panel.removeAttribute("data-ending-style");
        finish();
      };
      const onTransitionEnd = (event: TransitionEvent) => {
        if (event.target !== panel) return;
        panel.removeEventListener("transitionend", onTransitionEnd);
        done();
      };
      panel.addEventListener("transitionend", onTransitionEnd);
      state.exitDetach = () => panel.removeEventListener("transitionend", onTransitionEnd);
      state.exitTimer = window.setTimeout(done, total + 50);
    };
    const cancelPanelAnimation = (panel: HTMLElement) => {
      cancelExit(panel);
      cancelStartingStyle(panel);
    };

    const triggerValue = (trigger: HTMLButtonElement): string => trigger.dataset.value ?? "";
    const isTriggerDisabled = (trigger: HTMLButtonElement): boolean =>
      disabled() ||
      trigger.disabled ||
      trigger.hasAttribute("data-disabled") ||
      trigger.getAttribute("aria-disabled") === "true";

    const triggerForValue = (target: string): HTMLButtonElement | null =>
      parts()?.triggers.find((trigger) => triggerValue(trigger) === target) ?? null;

    const focusTrigger = (target: string) => {
      triggerForValue(target)?.focus();
    };
    const requestValue = (next: string, refocusTrigger = false, force = false) => {
      if (!force && next !== "" && disabled()) return;
      // Focus returns to the trigger of the panel being closed.
      const returnTo = valueState();
      if (next === returnTo) {
        if (refocusTrigger && next !== "") focusTrigger(next);
        return;
      }
      emit(host, onValueChange(), "value-change", "value", next);
      emit(host, onOpenChange(), "open-change", "open", next !== "");
      if (controlled && !force) {
        if (refocusTrigger && returnTo !== "") focusTrigger(returnTo);
        return;
      }
      const previous = returnTo;
      try {
        valueState(next);
      } catch (error) {
        valueState(previous);
        throw error;
      }
      if (refocusTrigger && returnTo !== "") focusTrigger(returnTo);
    };
    // `value` is the state property, so imperative open is `show(value)`
    // (mirroring the `open` + `show()`/`close()` split of the other floaters).
    host.show = (next: string) => {
      if (typeof next !== "string" || next === "") {
        throw new TypeError("show() requires a non-empty panel value");
      }
      const panel = parts()?.panelByValue.get(next);
      if (!panel) throw new RangeError(`bwc-navigation-menu has no panel with value "${next}"`);
      if (!disabled()) requestValue(next, false, true);
    };
    host.close = () => requestValue("", false, true);
    host.toggle = (next?: string) => {
      if (next === undefined) {
        if (valueState() !== "") requestValue("", false, true);
        return;
      }
      const target = next === valueState() ? "" : next;
      if (target === "" || !disabled()) requestValue(target, false, true);
    };

    onMount(() => {
      let stopObserver: (() => void) | undefined;
      let stopTopology: (() => void) | undefined;
      let stopControl: (() => void) | undefined;
      let stopClasses: (() => void) | undefined;
      let stopState: (() => void) | undefined;
      let stopConfig: (() => void) | undefined;
      let stopFloating: (() => void) | undefined;
      let stopInteract: (() => void) | undefined;
      let stopPosition: (() => void) | undefined;

      const teardownFloating = () => {
        stopFloating?.();
        stopFloating = undefined;
      };

      const owned = (element: Element): boolean => element.closest("bwc-navigation-menu") === host;

      const triggerOf = (target: EventTarget | null): HTMLButtonElement | null => {
        if (!(target instanceof Element)) return null;
        const trigger = target.closest("button[data-nav-trigger]");
        if (!(trigger instanceof HTMLButtonElement) || !owned(trigger)) return null;
        return parts()?.triggers.includes(trigger) ? trigger : null;
      };

      const enabledTriggers = (): HTMLButtonElement[] =>
        (parts()?.triggers ?? []).filter((trigger) => !isTriggerDisabled(trigger));

      const focusTriggerStep = (from: HTMLButtonElement | null, direction: 1 | -1) => {
        const order = enabledTriggers();
        if (order.length === 0) return;
        const at = from ? order.indexOf(from) : -1;
        let next: HTMLButtonElement;
        if (at === -1) {
          next = (direction === 1 ? order[0] : order[order.length - 1])!;
        } else if (loopFocus()) {
          next = order[(at + direction + order.length) % order.length]!;
        } else {
          next = order[Math.min(order.length - 1, Math.max(0, at + direction))]!;
        }
        next.focus();
      };

      const focusFirstInPanel = (panel: HTMLElement) => {
        const first = [...panel.querySelectorAll<HTMLElement>(focusableSelector)].find(
          (candidate) => owned(candidate) && candidate.tabIndex !== -1,
        );
        first?.focus();
      };

      const click = (event: MouseEvent) => {
        const trigger = triggerOf(event.target);
        if (!trigger || isTriggerDisabled(trigger)) return;
        const target = triggerValue(trigger);
        if (!parts()?.panelByValue.has(target)) return;
        requestValue(valueState() === target ? "" : target);
      };

      const focusin = (event: FocusEvent) => {
        // Focusing another trigger while a panel is open switches to it
        // immediately; focusing with everything closed opens nothing.
        const trigger = triggerOf(event.target);
        if (!trigger || isTriggerDisabled(trigger)) return;
        const current = valueState();
        if (current !== "" && current !== triggerValue(trigger)) {
          requestValue(triggerValue(trigger));
        }
      };

      const keydown = (event: KeyboardEvent) => {
        const currentParts = parts();
        if (!currentParts || disabled()) return;
        const horizontal = orientation() === "horizontal";
        const nextKey = horizontal ? "ArrowRight" : "ArrowDown";
        const prevKey = horizontal ? "ArrowLeft" : "ArrowUp";
        const trigger = triggerOf(event.target);

        if (trigger) {
          if (event.key === nextKey || event.key === prevKey) {
            event.preventDefault();
            const from = trigger;
            focusTriggerStep(from, event.key === nextKey ? 1 : -1);
            const focused = document.activeElement;
            const nextTrigger =
              focused instanceof HTMLButtonElement && currentParts.triggers.includes(focused)
                ? focused
                : null;
            if (valueState() !== "" && nextTrigger) {
              const nextValue = triggerValue(nextTrigger);
              requestValue(currentParts.panelByValue.has(nextValue) ? nextValue : "");
            }
          } else if (event.key === "Home" || event.key === "End") {
            event.preventDefault();
            const order = enabledTriggers();
            if (order.length === 0) return;
            const next = (event.key === "Home" ? order[0] : order[order.length - 1])!;
            next.focus();
            if (valueState() !== "") {
              const nextValue = triggerValue(next);
              requestValue(currentParts.panelByValue.has(nextValue) ? nextValue : "");
            }
          } else if (event.key === "Enter" || event.key === " " || event.key === "ArrowDown") {
            if (isTriggerDisabled(trigger)) return;
            const target = triggerValue(trigger);
            const panel = currentParts.panelByValue.get(target);
            if (!panel) return;
            event.preventDefault();
            requestValue(target);
            queueMicrotask(() => focusFirstInPanel(panel));
          } else if (event.key === "Escape" && valueState() !== "") {
            event.preventDefault();
            requestValue("", true);
          }
          return;
        }

        if (event.target instanceof Element) {
          const panel = event.target.closest("div[data-nav-panel]");
          if (panel instanceof HTMLElement && owned(panel) && event.key === "Escape") {
            event.preventDefault();
            requestValue("", true);
          }
        }
      };

      const cleanup = () => {
        host.removeEventListener("click", click);
        host.removeEventListener("focusin", focusin);
        host.removeEventListener("keydown", keydown);
        teardownFloating();
        stopInteract?.();
        stopInteract = undefined;
        stopPosition?.();
        stopObserver?.();
        stopConfig?.();
        stopState?.();
        stopClasses?.();
        stopControl?.();
        stopTopology?.();
        for (const panel of parts()?.panels ?? []) cancelPanelAnimation(panel);
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
                  record.attributeName === "data-value",
              )
            ) {
              revision(++version);
            }
          },
          ["slot", "data-value"],
        );
        stopTopology = effect(() => {
          revision();
          parts(null);

          const candidates = [...host.querySelectorAll("[data-nav-trigger]")].filter(owned);
          for (const candidate of candidates) {
            if (!(candidate instanceof HTMLButtonElement)) {
              throw new TypeError("bwc-navigation-menu triggers must be button[data-nav-trigger]");
            }
          }
          const triggers = candidates as HTMLButtonElement[];
          if (triggers.length === 0) {
            throw new TypeError(
              "bwc-navigation-menu requires at least one button[data-nav-trigger]",
            );
          }
          const seen = new Set<string>();
          for (const trigger of triggers) {
            const target = triggerValue(trigger);
            if (target === "") {
              throw new TypeError("bwc-navigation-menu triggers require a data-value");
            }
            if (seen.has(target)) {
              throw new TypeError(`bwc-navigation-menu has a duplicate trigger value "${target}"`);
            }
            seen.add(target);
          }

          const panelCandidates = [...host.querySelectorAll("[data-nav-panel]")].filter(owned);
          for (const candidate of panelCandidates) {
            if (!(candidate instanceof HTMLDivElement)) {
              throw new TypeError("bwc-navigation-menu panels must be div[data-nav-panel]");
            }
          }
          const panels = panelCandidates as HTMLElement[];
          const panelByValue = new Map<string, HTMLElement>();
          for (const panel of panels) {
            const target = panel.dataset.value ?? "";
            if (target === "") {
              throw new TypeError("bwc-navigation-menu panels require a data-value");
            }
            if (panelByValue.has(target)) {
              throw new TypeError(`bwc-navigation-menu has a duplicate panel value "${target}"`);
            }
            if (!seen.has(target)) {
              throw new TypeError(`bwc-navigation-menu has a panel without a trigger "${target}"`);
            }
            panelByValue.set(target, panel);
          }

          host.dataset.testid ||= "bwc-navigation-menu";
          setAttributeValue(host, "role", "navigation");
          for (const trigger of triggers) {
            trigger.id ||= nextId("bwc-navigation-menu-trigger");
            trigger.dataset.testid ||= "bwc-navigation-menu-trigger";
            if (trigger.type !== "button") trigger.type = "button";
          }
          for (const panel of panels) {
            panel.id ||= nextId("bwc-navigation-menu-panel");
            panel.dataset.testid ||= "bwc-navigation-menu-panel";
            setAttributeValue(panel, "role", "region");
            if (!panel.hasAttribute("data-floating")) panel.setAttribute("data-floating", "");
            const arrow = panel.querySelector<HTMLElement>("[data-arrow]");
            if (arrow && owned(arrow) && !arrow.hasAttribute("data-floating-arrow")) {
              arrow.setAttribute("data-floating-arrow", "");
            }
          }
          parts({ panels, panelByValue, triggers });
        });
        stopControl = effect(() => {
          const next = value();
          if (next) controlled = true;
          if (!initialized) {
            initialized = true;
            valueState(controlled ? next : defaultValue());
          } else if (controlled) {
            valueState(next);
          }
        });
        stopClasses = effect(() => {
          const currentParts = parts();
          if (!currentParts) return;
          for (const trigger of currentParts.triggers) {
            decorateButton(
              trigger,
              "navigation-menu-trigger",
              "bwc-navigation-menu-trigger",
              trigger.className,
            );
            applyPartClass(trigger, "navigation-menu-trigger", triggerClass());
          }
          for (const panel of currentParts.panels) {
            applyPartClass(panel, "navigation-menu-panel", panelClass());
          }
        });
        stopState = effect(() => {
          const currentParts = parts();
          if (!currentParts) return;
          const current = valueState();
          const isDisabled = disabled();
          toggleState(host, "data-open", current !== "");
          toggleState(host, "data-closed", current === "");
          toggleState(host, "data-disabled", isDisabled);
          host.style.cursor = isDisabled ? "not-allowed" : "";

          const active = document.activeElement;
          let preferred = currentParts.triggers.findIndex((trigger) => trigger === active);
          if (
            preferred === -1 ||
            (currentParts.triggers[preferred] &&
              isTriggerDisabled(currentParts.triggers[preferred]!))
          ) {
            preferred = currentParts.triggers.findIndex((trigger) => !isTriggerDisabled(trigger));
          }
          for (const trigger of currentParts.triggers) {
            const target = triggerValue(trigger);
            const panel = currentParts.panelByValue.get(target) ?? null;
            const open = current !== "" && current === target;
            toggleState(trigger, "data-open", open);
            toggleState(trigger, "data-closed", !open);
            toggleState(trigger, "data-disabled", isTriggerDisabled(trigger));
            setAttributeValue(trigger, "aria-expanded", String(open));
            if (panel) setAttributeValue(trigger, "aria-controls", panel.id);
            else removeAttributeValue(trigger, "aria-controls");
            const tabIndex = currentParts.triggers.indexOf(trigger) === preferred ? "0" : "-1";
            if (trigger.getAttribute("tabindex") !== tabIndex) {
              trigger.setAttribute("tabindex", tabIndex);
            }
          }
          for (const panel of currentParts.panels) {
            const open = current !== "" && panel.dataset.value === current;
            toggleState(panel, "data-open", open);
            toggleState(panel, "data-closed", !open);
            toggleState(panel, "data-disabled", isDisabled);
            if (open) {
              cancelExit(panel);
              panel.hidden = false;
              panel.removeAttribute("data-ending-style");
              panel.setAttribute("data-starting-style", "");
              scheduleStartingStyleEnd(panel);
            } else {
              beginExit(panel, () => {
                panel.hidden = true;
              });
            }
            const trigger = currentParts.triggers.find(
              (candidate) => triggerValue(candidate) === panel.dataset.value,
            );
            if (trigger) setAttributeValue(panel, "aria-labelledby", trigger.id);
          }
        });
        stopConfig = effect(() => {
          const currentParts = parts();
          if (!currentParts) return;
          if (valueState() !== "") return;
          for (const panel of currentParts.panels) {
            if (panel.dataset.side !== side()) panel.dataset.side = side();
            if (panel.dataset.align !== align()) panel.dataset.align = align();
          }
          for (const panel of currentParts.panels) {
            const sideOffsetValue = `${sideOffset()}px`;
            if (panel.style.getPropertyValue("--side-offset") !== sideOffsetValue) {
              panel.style.setProperty("--side-offset", sideOffsetValue);
            }
            const alignOffsetValue = `${alignOffset()}px`;
            if (panel.style.getPropertyValue("--align-offset") !== alignOffsetValue) {
              panel.style.setProperty("--align-offset", alignOffsetValue);
            }
          }
        });
        stopPosition = effect(() => {
          const currentParts = parts();
          if (!currentParts) return;
          const current = valueState();
          const currentSide = side();
          const currentAlign = align();
          const currentSideOffset = sideOffset();
          const currentAlignOffset = alignOffset();
          const currentStrategy = strategy();
          teardownFloating();
          stopInteract?.();
          stopInteract = undefined;
          // Hover with a bridge per trigger/panel pair: the pointer may
          // travel from the trigger to its panel without closing.
          const detachers: Array<() => void> = [];
          for (const trigger of currentParts.triggers) {
            const panel = currentParts.panelByValue.get(triggerValue(trigger));
            if (!panel) continue;
            const target = triggerValue(trigger);
            detachers.push(
              attachHover(trigger, panel, {
                openDelay: delay(),
                closeDelay: closeDelay(),
                onOpen: () => requestValue(target),
                onClose: () => {
                  if (valueState() === target) requestValue("");
                },
              }),
            );
          }
          stopInteract = () => {
            for (const detach of detachers) detach();
          };
          if (current === "") return;
          const panel = currentParts.panelByValue.get(current);
          const trigger = triggerForValue(current);
          if (!panel || !trigger) return;
          const update = () => {
            const arrow = panel.querySelector<HTMLElement>("[data-arrow]");
            const arrowEl = arrow && owned(arrow) ? arrow : null;
            positionFloating(trigger, panel, arrowEl, {
              side: currentSide,
              align: currentAlign,
              sideOffset: currentSideOffset,
              alignOffset: currentAlignOffset,
              strategy: currentStrategy,
            });
          };
          const stopTracking = trackAnchor(trigger, panel, update);
          // Outside pointer and tabbing away close; Escape is the host
          // keydown's job so focus returns to the trigger.
          const stopDismiss = attachDismiss(panel, currentParts.triggers, {
            outside: true,
            escape: false,
            focusOut: true,
            onDismiss: () => requestValue(""),
          });
          update();
          stopFloating = () => {
            stopDismiss();
            stopTracking();
          };
        });
        host.addEventListener("click", click);
        host.addEventListener("focusin", focusin);
        host.addEventListener("keydown", keydown);
        return cleanup;
      } catch (error) {
        cleanup();
        throw error;
      }
    });

    return html`<slot></slot>`;
  },
);
