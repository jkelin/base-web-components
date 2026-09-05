import { defineComponent, effect, html, onMount, signal, useHost, useProp } from "microfw";
import {
  booleanProp,
  callbackProp,
  emit,
  enumProp,
  nextId,
  observeSlotSubtree,
  requireSlottedElement,
  slottedElements,
  stringProp,
} from "../shared";

export const BWC_TABS_TAG = "bwc-tabs";

type Orientation = "horizontal" | "vertical";
type ActivationMode = "automatic" | "manual";
type ChangeCallback<Value> = ((value: Value) => void) | null;

type TabsApi = HTMLElement & {
  activationMode: ActivationMode;
  defaultValue: string;
  disabled: boolean;
  onValueChange: ChangeCallback<string>;
  orientation: Orientation;
  value: string;
};

type TabsParts = {
  buttons: HTMLButtonElement[];
  list: HTMLDivElement;
  panels: HTMLElement[];
  panelByValue: Map<string, HTMLElement>;
};

const orientations = ["horizontal", "vertical"] as const;
const activationModes = ["automatic", "manual"] as const;

function tabsParts(host: HTMLElement): TabsParts {
  const list = requireSlottedElement(host, "list", HTMLDivElement);
  const buttons = [...list.children].filter(
    (child): child is HTMLButtonElement => child instanceof HTMLButtonElement,
  );
  const panels = slottedElements(host, "panel", HTMLElement);
  if (panels.some((panel) => panel.localName !== "section")) {
    throw new TypeError("tabs panels must be section elements");
  }

  const buttonValues = buttons.map((button) => button.value);
  const panelValues = panels.map((panel) => panel.dataset.value ?? "");
  if (
    buttonValues.some((value) => !value) ||
    panelValues.some((value) => !value) ||
    new Set(buttonValues).size !== buttonValues.length ||
    new Set(panelValues).size !== panelValues.length
  ) {
    throw new TypeError("tab and panel values must be unique and nonempty");
  }
  const panelsByValue = new Map(panels.map((panel, index) => [panelValues[index]!, panel]));
  if (buttons.length !== panels.length || buttonValues.some((value) => !panelsByValue.has(value))) {
    throw new TypeError("tabs require matched button and panel values");
  }

  return { buttons, list, panels, panelByValue: panelsByValue };
}

export const BwcTabsElement = defineComponent<TabsApi>(BWC_TABS_TAG, () => {
  const host = useHost<TabsApi>();
  const assignedValue = Object.hasOwn(host, "value");
  const controlled = signal(host.hasAttribute("value") || assignedValue);
  const currentValue = signal("");
  const itemDisabled = new WeakMap<HTMLButtonElement, boolean>();
  const appliedDisabled = new WeakMap<HTMLButtonElement, boolean>();
  const previousButtonValues = new WeakMap<HTMLButtonElement, string>();
  let initialized = false;

  const orientation = useProp<Orientation>(
    "orientation",
    enumProp("orientation", orientations, "horizontal"),
  );
  const activationMode = useProp<ActivationMode>(
    "activationMode",
    enumProp("activation-mode", activationModes, "automatic"),
  );
  const disabled = useProp("disabled", booleanProp("disabled"));
  const defaultValue = useProp("defaultValue", stringProp("default-value"));
  const value = useProp("value", {
    ...stringProp("value"),
    defaultValue: "",
    fromAttribute: (raw) => {
      controlled(raw !== null);
      if (initialized && raw === null) currentValue("");
      return raw ?? "";
    },
    toAttribute: (next) => (controlled() ? next : null),
    get: () => currentValue(),
    onSet: (next, commit) => {
      if (!next) throw new TypeError("value must be nonempty");
      controlled(true);
      commit(next);
      currentValue(next);
    },
  });
  const onValueChange = useProp<ChangeCallback<string>>(
    "onValueChange",
    callbackProp<string>("onValueChange"),
  );

  const sync = () => {
    const parts = tabsParts(host);
    if (!controlled()) {
      for (const button of parts.buttons) {
        const previousValue = previousButtonValues.get(button);
        if (previousValue === currentValue() && previousValue !== button.value) {
          currentValue(button.value);
          break;
        }
      }
    }

    if (!initialized) {
      initialized = true;
      if (controlled()) currentValue(value());
      else {
        const preferred = defaultValue();
        const initial = preferred
          ? parts.buttons.find((button) => button.value === preferred && !button.disabled)
          : parts.buttons.find((button) => !button.disabled);
        currentValue(initial?.value ?? "");
      }
    } else if (controlled()) {
      currentValue(value());
    }

    const rootDisabled = disabled();
    const selected = currentValue();
    host.toggleAttribute("data-disabled", rootDisabled);
    parts.list.classList.add("tabs-list");
    parts.list.dataset.testid ||= "bwc-tabs-list";
    parts.list.setAttribute("role", "tablist");
    parts.list.setAttribute("aria-orientation", orientation());

    for (const button of parts.buttons) {
      const previouslyApplied = appliedDisabled.get(button);
      if (previouslyApplied === undefined || button.disabled !== previouslyApplied) {
        itemDisabled.set(button, button.disabled);
      }
      const effectiveDisabled = rootDisabled || itemDisabled.get(button) === true;
      const active = selected === button.value;
      const panel = parts.panelByValue.get(button.value)!;
      button.disabled = effectiveDisabled;
      appliedDisabled.set(button, effectiveDisabled);
      previousButtonValues.set(button, button.value);
      button.id ||= nextId("bwc-tab");
      panel.id ||= nextId("bwc-tab-panel");
      button.classList.add("tab");
      button.dataset.testid ||= `bwc-tab-${button.value}`;
      button.type = "button";
      button.style.cursor = effectiveDisabled ? "not-allowed" : "pointer";
      button.setAttribute("role", "tab");
      button.setAttribute("aria-selected", String(active));
      button.setAttribute("aria-controls", panel.id);
      button.tabIndex = active ? 0 : -1;
      button.toggleAttribute("data-active", active);
      button.toggleAttribute("data-inactive", !active);
      button.toggleAttribute("data-disabled", effectiveDisabled);
      panel.classList.add("tab-panel");
      panel.dataset.testid ||= `bwc-tab-panel-${button.value}`;
      panel.setAttribute("role", "tabpanel");
      panel.setAttribute("aria-labelledby", button.id);
      panel.hidden = !active;
      panel.toggleAttribute("data-active", active);
      panel.toggleAttribute("data-inactive", !active);
      panel.toggleAttribute("data-disabled", effectiveDisabled);
    }
  };

  const buttonFromEvent = (event: Event): HTMLButtonElement | undefined => {
    const target = event.composedPath().find((entry) => entry instanceof HTMLButtonElement);
    if (!(target instanceof HTMLButtonElement)) return undefined;
    const { buttons } = tabsParts(host);
    return buttons.includes(target) && target.closest(BWC_TABS_TAG) === host ? target : undefined;
  };

  const select = (button: HTMLButtonElement) => {
    if (disabled() || button.disabled) return;
    const next = button.value;
    if (!next || (!controlled() && next === currentValue())) return;
    emit(host, onValueChange(), "value-change", "value", next);
    if (!controlled()) currentValue(next);
    sync();
  };
  let pointerDownButton: HTMLButtonElement | undefined;
  let pointerFocusSelection: HTMLButtonElement | undefined;

  const pointerdown = (event: PointerEvent) => {
    pointerDownButton = buttonFromEvent(event);
    pointerFocusSelection = undefined;
  };
  const click = (event: Event) => {
    const button = buttonFromEvent(event);
    if (!button) return;
    const selectedOnPointerFocus =
      event instanceof MouseEvent && event.detail > 0 && pointerFocusSelection === button;
    pointerDownButton = undefined;
    pointerFocusSelection = undefined;
    if (!selectedOnPointerFocus) select(button);
  };
  const focus = (event: FocusEvent) => {
    const button = buttonFromEvent(event);
    if (!button || activationMode() !== "automatic") return;
    if (pointerDownButton === button) pointerFocusSelection = button;
    select(button);
  };
  const keydown = (event: KeyboardEvent) => {
    const button = buttonFromEvent(event);
    if (!button) return;
    const { buttons } = tabsParts(host);
    const enabled = buttons.filter((candidate) => !candidate.disabled);
    const index = enabled.indexOf(button);
    if (index < 0 || enabled.length === 0) return;
    const previousKey = orientation() === "horizontal" ? "ArrowLeft" : "ArrowUp";
    const nextKey = orientation() === "horizontal" ? "ArrowRight" : "ArrowDown";
    let next: HTMLButtonElement | undefined;
    if (event.key === previousKey) next = enabled[(index - 1 + enabled.length) % enabled.length];
    if (event.key === nextKey) next = enabled[(index + 1) % enabled.length];
    if (event.key === "Home") next = enabled[0];
    if (event.key === "End") next = enabled.at(-1);
    if (next) {
      event.preventDefault();
      next.focus();
    } else if (activationMode() === "manual" && (event.key === "Enter" || event.key === " ")) {
      event.preventDefault();
      select(button);
    }
  };

  onMount(() => {
    sync();
    const stopEffect = effect(sync);
    let stopObserving: (() => void) | undefined;
    try {
      stopObserving = observeSlotSubtree(host, sync, ["slot", "value", "data-value", "disabled"]);
      host.addEventListener("pointerdown", pointerdown);
      host.addEventListener("click", click);
      host.addEventListener("focusin", focus);
      host.addEventListener("keydown", keydown);
    } catch (error) {
      stopObserving?.();
      stopEffect();
      host.removeEventListener("pointerdown", pointerdown);
      host.removeEventListener("click", click);
      host.removeEventListener("focusin", focus);
      host.removeEventListener("keydown", keydown);
      throw error;
    }

    return () => {
      pointerDownButton = undefined;
      pointerFocusSelection = undefined;
      host.removeEventListener("pointerdown", pointerdown);
      host.removeEventListener("click", click);
      host.removeEventListener("focusin", focus);
      host.removeEventListener("keydown", keydown);
      stopObserving?.();
      stopEffect();
    };
  });

  return html`<slot name="list"></slot><slot name="panel"></slot>`;
});
