import toastCSS from "./toast.css?inline";
import { defineComponent, effect, html, onMount, signal, useHost, useProp } from "microfw";
import {
  booleanProp,
  callbackProp,
  createPartClassController,
  decorateButton,
  emit,
  enumProp,
  nextId,
  numberProp,
  removeAttributeValue,
  setAttributeValue,
  stringProp,
  toggleState,
  type ChangeCallback,
} from "../shared";

if (typeof document !== "undefined" && !document.getElementById("bwc-toast-style")) {
  const style = document.createElement("style");
  style.id = "bwc-toast-style";
  style.textContent = toastCSS;
  document.head.append(style);
}

/**
 * Total exit-transition time for a toast in ms (duration + delay, longest
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

const positions = [
  "top-left",
  "top-center",
  "top-right",
  "bottom-left",
  "bottom-center",
  "bottom-right",
] as const;
export type ToastPosition = (typeof positions)[number];

const toastTypes = ["success", "error", "info", "warning"] as const;
export type ToastType = (typeof toastTypes)[number];

export type ShowToastOptions = {
  title?: string;
  description?: string;
  type?: ToastType;
  /** Auto-dismiss delay in ms; 0 = sticky. Defaults to the region default. */
  duration?: number;
  /** Label for an action button; omitted when absent. */
  actionLabel?: string;
};

export type BwcToastRegionElement = HTMLElement & {
  position: ToastPosition;
  /** Max visible toasts; extras wait with `data-limited` until a slot frees. */
  limit: number;
  /** Default auto-dismiss delay in ms for child toasts; 0 = sticky. */
  duration: number;
  /**
   * Build, append, and open a toast; returns the element for further control
   * (e.g. `.close()` or removal). The toast opens uncontrolled via
   * `default-open`, so auto-dismiss and `close()` work without wiring.
   */
  showToast: (options?: ShowToastOptions) => BwcToastElement;
};

export type BwcToastElement = HTMLElement & {
  open: boolean;
  defaultOpen: boolean;
  /** Auto-dismiss delay in ms; -1 inherits the region default; 0 = sticky. */
  duration: number;
  type: ToastType;
  titleClass: string;
  descriptionClass: string;
  actionClass: string;
  closeClass: string;
  onOpenChange: ChangeCallback<boolean>;
  /** Imperative open. Applies and notifies in controlled mode. */
  show: () => void;
  /** Imperative close. Applies and notifies in controlled mode. */
  close: () => void;
  /** Toggle, or force with a boolean. Applies and notifies in controlled mode. */
  toggle: (force?: boolean) => void;
};

/** Nearest owning toast region, or null for standalone toasts. */
export function toastRegionOf(toast: HTMLElement): BwcToastRegionElement | null {
  return toast.closest("bwc-toast-region") as BwcToastRegionElement | null;
}

function ownedByToast(toast: HTMLElement, element: HTMLElement): boolean {
  return element.closest("bwc-toast") === toast;
}

export const BwcToastRegionElement = defineComponent<BwcToastRegionElement>(
  "bwc-toast-region",
  () => {
    const host = useHost<BwcToastRegionElement>();
    const position = useProp<ToastPosition>(
      "position",
      enumProp("position", positions, "bottom-right"),
    );
    const limit = useProp<number>("limit", numberProp("limit", 3));
    // Registered without a local binding: read via `region.duration` by toasts.
    useProp<number>("duration", numberProp("duration", 5000));
    const revision = signal(0);
    let version = 0;

    const syncToasts = () => {
      const max = limit();
      const toasts = [...host.querySelectorAll("bwc-toast")].filter(
        (element): element is BwcToastElement => element instanceof HTMLElement,
      );
      let visible = 0;
      for (const toast of toasts) {
        if (!toast.open) {
          toggleState(toast, "data-limited", false);
          continue;
        }
        const limited = visible >= max;
        visible++;
        toggleState(toast, "data-limited", limited);
        // Limited toasts wait off-screen; unhiding a freed toast re-shows it.
        if (limited) {
          toast.hidden = true;
        } else if (!toast.hasAttribute("data-ending-style")) {
          toast.hidden = false;
        }
      }
    };

    host.showToast = (options: ShowToastOptions = {}): BwcToastElement => {
      if (options !== null && typeof options !== "object") {
        throw new TypeError("showToast options must be an object");
      }
      const { actionLabel, description, duration: toastDuration, title, type } = options;
      const toast = document.createElement("bwc-toast") as BwcToastElement;
      if (type !== undefined) toast.setAttribute("type", type);
      if (toastDuration !== undefined) toast.setAttribute("duration", String(toastDuration));
      const header = document.createElement("header");
      header.setAttribute("data-toast-header", "");
      if (title !== undefined) {
        const titleEl = document.createElement("div");
        titleEl.setAttribute("data-title", "");
        titleEl.textContent = title;
        header.append(titleEl);
      }
      const close = document.createElement("button");
      close.setAttribute("data-close", "");
      close.setAttribute("aria-label", "Dismiss");
      close.textContent = "×";
      header.append(close);
      toast.append(header);
      if (description !== undefined) {
        const descriptionEl = document.createElement("div");
        descriptionEl.setAttribute("data-description", "");
        descriptionEl.textContent = description;
        toast.append(descriptionEl);
      }
      if (actionLabel !== undefined) {
        const action = document.createElement("button");
        action.setAttribute("data-action", "");
        action.textContent = actionLabel;
        toast.append(action);
      }
      toast.toggleAttribute("default-open", true);
      host.append(toast);
      // MutationObserver sync is async; sync now so `limit` applies by return.
      syncToasts();
      return toast;
    };
    onMount(() => {
      let stopSync: (() => void) | undefined;
      const rerender = () => revision(++version);
      const observer = new MutationObserver((records) => {
        if (records.some((record) => record.type === "childList")) rerender();
      });
      const onToastChange = () => {
        // `open-change` fires before the toast commits its new state, so
        // re-sync after the commit lands (and after any toast exit hides).
        queueMicrotask(() => revision(++version));
      };
      const cleanup = () => {
        observer.disconnect();
        host.removeEventListener("open-change", onToastChange);
        stopSync?.();
      };

      try {
        observer.observe(host, { childList: true });
        host.addEventListener("open-change", onToastChange);
        stopSync = effect(() => {
          revision();
          const currentPosition = position();
          if (host.dataset.position !== currentPosition) {
            host.dataset.position = currentPosition;
          }
          syncToasts();
        });
        return cleanup;
      } catch (error) {
        cleanup();
        throw error;
      }
    });

    return html`<slot></slot>`;
  },
);

export const BwcToastElement = defineComponent<BwcToastElement>("bwc-toast", () => {
  const host = useHost<BwcToastElement>();
  let controlled = host.hasAttribute("open") || Object.hasOwn(host, "open");
  const openState = signal(false);
  const parts = signal<{
    title: HTMLElement | null;
    description: HTMLElement | null;
    actionButtons: HTMLButtonElement[];
    closeButtons: HTMLButtonElement[];
  } | null>(null);
  const titleClass = useProp<string>("titleClass", stringProp("title-class"));
  const descriptionClass = useProp<string>("descriptionClass", stringProp("description-class"));
  const actionClass = useProp<string>("actionClass", stringProp("action-class"));
  const closeClass = useProp<string>("closeClass", stringProp("close-class"));
  const topologyRevision = signal(0);
  const classRevision = signal(0);
  let initialized = false;
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
  const duration = useProp<number>("duration", numberProp("duration", -1));
  const type = useProp<ToastType>("type", enumProp("type", toastTypes, "info"));
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

  /** Effective auto-dismiss delay: own `duration`, else the region default. */
  const effectiveDuration = (): number => {
    const own = duration();
    if (own >= 0) return own;
    const region = toastRegionOf(host);
    if (region && Number.isFinite(region.duration)) return region.duration;
    return 5000;
  };

  // Auto-dismiss timer with hover/focus pause (Base UI behavior): pausing
  // stores the remaining delay, resuming restarts from it.
  let dismissTimer = 0;
  let deadline = 0;
  let remaining = 0;
  const clearDismissTimer = () => {
    if (dismissTimer) {
      window.clearTimeout(dismissTimer);
      dismissTimer = 0;
    }
  };
  const startDismissTimer = (ms: number) => {
    clearDismissTimer();
    if (!(ms > 0)) {
      remaining = 0;
      return;
    }
    remaining = ms;
    deadline = Date.now() + ms;
    dismissTimer = window.setTimeout(() => {
      dismissTimer = 0;
      remaining = 0;
      requestOpen(false);
    }, ms);
  };
  const pauseDismissTimer = () => {
    if (dismissTimer) {
      clearDismissTimer();
      remaining = Math.max(0, deadline - Date.now());
    }
  };
  const resumeDismissTimer = () => {
    if (openState() && !dismissTimer && remaining > 0) startDismissTimer(remaining);
  };

  // Exit-animation state: while `exiting`, the toast keeps `data-ending-style`
  // until its transition finishes (or a fallback timer fires); the finish
  // step hides it. Without a transition the finish runs synchronously.
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
  const beginExit = (finish: () => void) => {
    if (exiting) return;
    cancelStartingStyle();
    host.removeAttribute("data-starting-style");
    const total = transitionTotalMs(host);
    if (total <= 0) {
      finish();
      return;
    }
    exiting = true;
    host.setAttribute("data-ending-style", "");
    // Flush styles so the ending frame transitions from the open frame.
    void host.offsetWidth;
    const done = () => {
      if (!exiting) return;
      exiting = false;
      exitTimer = 0;
      exitDetach = null;
      host.removeAttribute("data-ending-style");
      finish();
    };
    const onTransitionEnd = (event: TransitionEvent) => {
      if (event.target !== host) return;
      host.removeEventListener("transitionend", onTransitionEnd);
      done();
    };
    host.addEventListener("transitionend", onTransitionEnd);
    exitDetach = () => host.removeEventListener("transitionend", onTransitionEnd);
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
  const scheduleStartingStyleEnd = () => {
    cancelStartingStyle();
    const token = ++startToken;
    const remove = () => {
      startRaf = 0;
      startTimer = 0;
      if (token === startToken && host.isConnected) {
        host.removeAttribute("data-starting-style");
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

  const requestOpen = (next: boolean, force = false) => {
    if (next === openState()) return;
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
  host.show = () => requestOpen(true, true);
  host.close = () => requestOpen(false, true);
  host.toggle = (force?: boolean) =>
    requestOpen(typeof force === "boolean" ? force : !openState(), true);

  onMount(() => {
    let stopTopology: (() => void) | undefined;
    let stopControl: (() => void) | undefined;
    let stopClasses: (() => void) | undefined;
    let stopState: (() => void) | undefined;
    const click = (event: MouseEvent) => {
      const target = event.target;
      const currentParts = parts();
      if (!(target instanceof Element) || !currentParts) return;
      const action = target.closest<HTMLButtonElement>("button[data-action]");
      if (action && currentParts.actionButtons.includes(action)) {
        if (!action.hasAttribute("data-keep-open")) requestOpen(false);
        return;
      }
      const close = target.closest<HTMLButtonElement>("button[data-close]");
      if (close && currentParts.closeButtons.includes(close)) requestOpen(false);
    };
    // Hover/focus pauses the auto-dismiss countdown; leaving resumes it.
    const onPointerEnter = () => pauseDismissTimer();
    const onPointerLeave = () => resumeDismissTimer();
    const onFocusIn = () => pauseDismissTimer();
    const onFocusOut = (event: FocusEvent) => {
      if (event.relatedTarget instanceof Node && host.contains(event.relatedTarget)) return;
      resumeDismissTimer();
    };
    const cleanup = () => {
      host.removeEventListener("click", click);
      host.removeEventListener("pointerenter", onPointerEnter);
      host.removeEventListener("pointerleave", onPointerLeave);
      host.removeEventListener("focusin", onFocusIn);
      host.removeEventListener("focusout", onFocusOut);
      cancelExit();
      cancelStartingStyle();
      clearDismissTimer();
      stopState?.();
      stopClasses?.();
      stopControl?.();
      stopTopology?.();
      parts(null);
    };

    try {
      stopTopology = effect(() => {
        topologyRevision();
        const owned = (selector: string): HTMLButtonElement[] =>
          [...host.querySelectorAll<HTMLButtonElement>(selector)].filter((element) =>
            ownedByToast(host, element),
          );
        const actionButtons = owned("button[data-action]");
        const closeButtons = owned("button[data-close]");
        const titleCandidate = host.querySelector<HTMLElement>("[data-title]");
        const title = titleCandidate && ownedByToast(host, titleCandidate) ? titleCandidate : null;
        const descriptionCandidate = host.querySelector<HTMLElement>("[data-description]");
        const description =
          descriptionCandidate && ownedByToast(host, descriptionCandidate)
            ? descriptionCandidate
            : null;
        host.id ||= nextId("bwc-toast");
        host.dataset.testid ||= "bwc-toast";
        setAttributeValue(host, "role", "status");
        host.hidden = !openState();
        for (const button of [...actionButtons, ...closeButtons]) {
          button.id ||= nextId("bwc-toast-button");
        }
        if (title) {
          title.id ||= nextId("bwc-toast-title");
          title.dataset.testid ||= "bwc-toast-title";
          setAttributeValue(host, "aria-labelledby", title.id);
        } else {
          removeAttributeValue(host, "aria-labelledby");
        }
        if (description) {
          description.id ||= nextId("bwc-toast-description");
          description.dataset.testid ||= "bwc-toast-description";
          setAttributeValue(host, "aria-describedby", description.id);
        } else {
          removeAttributeValue(host, "aria-describedby");
        }
        parts({ actionButtons, closeButtons, description, title });
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
        const currentType = type();
        if (host.dataset.type !== currentType) host.dataset.type = currentType;
        for (const button of currentParts.actionButtons) {
          decorateButton(button, "toast-action", "bwc-toast-action", button.className);
          applyPartClass(button, "toast-action", actionClass());
        }
        for (const button of currentParts.closeButtons) {
          decorateButton(button, "toast-close", "bwc-toast-close", button.className);
          applyPartClass(button, "toast-close", closeClass());
        }
        if (currentParts.title) applyPartClass(currentParts.title, "toast-title", titleClass());
        if (currentParts.description) {
          applyPartClass(currentParts.description, "toast-description", descriptionClass());
        }
      });
      stopState = effect(() => {
        const currentParts = parts();
        if (!currentParts) return;
        const isOpen = openState();
        const currentType = type();
        if (host.dataset.type !== currentType) host.dataset.type = currentType;
        toggleState(host, "data-open", isOpen);
        toggleState(host, "data-closed", !isOpen);
        // A region-managed toast waiting with `data-limited` stays hidden
        // until the region frees a slot (it unhides on the next sync).
        const limited = host.hasAttribute("data-limited");

        if (isOpen) {
          cancelExit();
          if (!limited && host.hidden) host.hidden = false;
          wasOpen = true;
          host.removeAttribute("data-ending-style");
          host.setAttribute("data-starting-style", "");
          scheduleStartingStyleEnd();
          startDismissTimer(effectiveDuration());
        } else if (wasOpen) {
          wasOpen = false;
          clearDismissTimer();
          beginExit(() => {
            host.hidden = true;
          });
        } else {
          clearDismissTimer();
          host.hidden = true;
        }
      });
      host.addEventListener("click", click);
      host.addEventListener("pointerenter", onPointerEnter);
      host.addEventListener("pointerleave", onPointerLeave);
      host.addEventListener("focusin", onFocusIn);
      host.addEventListener("focusout", onFocusOut);
      return cleanup;
    } catch (error) {
      cleanup();
      throw error;
    }
  });

  return html`<slot></slot>`;
});
