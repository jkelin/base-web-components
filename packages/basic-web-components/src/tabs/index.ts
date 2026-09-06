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
  setAttributeValue,
  stringProp,
  toggleState,
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
  let controlledSnapshot = host.hasAttribute("value") || assignedValue;
  let currentValueSnapshot = "";
  const controlled = signal(controlledSnapshot);
  const currentValue = signal(currentValueSnapshot);
  const setControlled = (next: boolean) => {
    controlledSnapshot = next;
    controlled(next);
  };
  const setCurrentValue = (next: string) => {
    currentValueSnapshot = next;
    currentValue(next);
  };
  const parts = signal<TabsParts | null>(null);
  const topologyRevision = signal(0);
  const disabledRevision = signal(0);
  const itemDisabled = new WeakMap<HTMLButtonElement, boolean>();
  const appliedDisabled = new WeakMap<HTMLButtonElement, boolean>();
  const previousButtonValues = new WeakMap<HTMLButtonElement, string>();
  let topologyVersion = 0;
  let disabledVersion = 0;
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
      setControlled(raw !== null);
      if (initialized && raw === null) setCurrentValue("");
      return raw ?? "";
    },
    toAttribute: (next) => (controlled() ? next : null),
    get: () => currentValue(),
    onSet: (next, commit) => {
      if (!next) throw new TypeError("value must be nonempty");
      setControlled(true);
      commit(next);
      setCurrentValue(next);
    },
  });
  const onValueChange = useProp<ChangeCallback<string>>(
    "onValueChange",
    callbackProp<string>("onValueChange"),
  );

  const buttonFromEvent = (event: Event): HTMLButtonElement | undefined => {
    const target = event.composedPath().find((entry) => entry instanceof HTMLButtonElement);
    const currentParts = parts();
    if (!(target instanceof HTMLButtonElement) || !currentParts) return undefined;
    return currentParts.buttons.includes(target) && target.closest(BWC_TABS_TAG) === host
      ? target
      : undefined;
  };
  const select = (button: HTMLButtonElement) => {
    if (disabled() || button.disabled) return;
    const next = button.value;
    if (!next || (!controlled() && next === currentValue())) return;
    emit(host, onValueChange(), "value-change", "value", next);
    if (!controlled()) setCurrentValue(next);
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
    const currentParts = parts();
    if (!button || !currentParts) return;
    const enabled = currentParts.buttons.filter((candidate) => !candidate.disabled);
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
    let stopObserver: (() => void) | undefined;
    let stopTopology: (() => void) | undefined;
    let stopControl: (() => void) | undefined;
    let stopOrientation: (() => void) | undefined;
    let stopState: (() => void) | undefined;
    const cleanup = () => {
      pointerDownButton = undefined;
      pointerFocusSelection = undefined;
      host.removeEventListener("pointerdown", pointerdown);
      host.removeEventListener("click", click);
      host.removeEventListener("focusin", focus);
      host.removeEventListener("keydown", keydown);
      stopObserver?.();
      stopState?.();
      stopOrientation?.();
      stopControl?.();
      stopTopology?.();
      parts(null);
    };

    try {
      stopObserver = observeSlotSubtree(
        host,
        (records) => {
          const currentParts = parts();
          if (
            records.length === 0 ||
            records.some(
              (record) =>
                (record.type === "childList" &&
                  (record.target === host || record.target === currentParts?.list)) ||
                (record.target !== host &&
                  (record.attributeName === "slot" ||
                    record.attributeName === "value" ||
                    record.attributeName === "data-value")),
            )
          ) {
            topologyRevision(++topologyVersion);
          } else {
            disabledRevision(++disabledVersion);
          }
        },
        ["slot", "value", "data-value", "disabled"],
      );
      stopTopology = effect(() => {
        topologyRevision();
        parts(null);
        const nextParts = tabsParts(host);
        if (!controlledSnapshot) {
          for (const button of nextParts.buttons) {
            const previousValue = previousButtonValues.get(button);
            if (previousValue === currentValueSnapshot && previousValue !== button.value) {
              setCurrentValue(button.value);
              break;
            }
          }
        }

        nextParts.list.classList.add("tabs-list");
        nextParts.list.dataset.testid ||= "bwc-tabs-list";
        setAttributeValue(nextParts.list, "role", "tablist");
        for (const button of nextParts.buttons) {
          const previouslyApplied = appliedDisabled.get(button);
          if (previouslyApplied === undefined || button.disabled !== previouslyApplied) {
            itemDisabled.set(button, button.disabled);
          }
          previousButtonValues.set(button, button.value);
          const panel = nextParts.panelByValue.get(button.value)!;
          button.id ||= nextId("bwc-tab");
          panel.id ||= nextId("bwc-tab-panel");
          button.classList.add("tab");
          button.dataset.testid ||= `bwc-tab-${button.value}`;
          button.type = "button";
          setAttributeValue(button, "role", "tab");
          setAttributeValue(button, "aria-controls", panel.id);
          panel.classList.add("tab-panel");
          panel.dataset.testid ||= `bwc-tab-panel-${button.value}`;
          setAttributeValue(panel, "role", "tabpanel");
          setAttributeValue(panel, "aria-labelledby", button.id);
        }
        parts(nextParts);
      });
      stopControl = effect(() => {
        const currentParts = parts();
        if (!currentParts) return;
        const isControlled = controlled();
        if (!initialized) {
          initialized = true;
          if (isControlled) {
            setCurrentValue(value());
          } else {
            const preferred = defaultValue();
            const initial = preferred
              ? currentParts.buttons.find(
                  (button) => button.value === preferred && !button.disabled,
                )
              : currentParts.buttons.find((button) => !button.disabled);
            setCurrentValue(initial?.value ?? "");
          }
        } else if (isControlled) {
          setCurrentValue(value());
        }
      });
      stopOrientation = effect(() => {
        const list = parts()?.list;
        if (list) setAttributeValue(list, "aria-orientation", orientation());
      });
      stopState = effect(() => {
        disabledRevision();
        const currentParts = parts();
        if (!currentParts) return;
        const rootDisabled = disabled();
        const selected = currentValue();
        toggleState(host, "data-disabled", rootDisabled);
        for (const button of currentParts.buttons) {
          const previouslyApplied = appliedDisabled.get(button);
          if (previouslyApplied === undefined || button.disabled !== previouslyApplied) {
            itemDisabled.set(button, button.disabled);
          }
          const effectiveDisabled = rootDisabled || itemDisabled.get(button) === true;
          const active = selected === button.value;
          const panel = currentParts.panelByValue.get(button.value)!;
          if (button.disabled !== effectiveDisabled) button.disabled = effectiveDisabled;
          appliedDisabled.set(button, effectiveDisabled);
          const cursor = effectiveDisabled ? "not-allowed" : "pointer";
          if (button.style.cursor !== cursor) button.style.cursor = cursor;
          setAttributeValue(button, "aria-selected", String(active));
          if (button.tabIndex !== (active ? 0 : -1)) button.tabIndex = active ? 0 : -1;
          toggleState(button, "data-active", active);
          toggleState(button, "data-inactive", !active);
          toggleState(button, "data-disabled", effectiveDisabled);
          if (panel.hidden === active) panel.hidden = !active;
          toggleState(panel, "data-active", active);
          toggleState(panel, "data-inactive", !active);
          toggleState(panel, "data-disabled", effectiveDisabled);
        }
      });
      host.addEventListener("pointerdown", pointerdown);
      host.addEventListener("click", click);
      host.addEventListener("focusin", focus);
      host.addEventListener("keydown", keydown);
      return cleanup;
    } catch (error) {
      cleanup();
      throw error;
    }
  });

  return html`<slot name="list"></slot><slot name="panel"></slot>`;
});
