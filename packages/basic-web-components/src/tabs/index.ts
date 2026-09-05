import { signal } from "alien-signals";
import {
  booleanValue,
  callbackValue,
  defineComponent,
  emit,
  enumValue,
  nextId,
  useEffects,
  type ChangeCallback,
  type Signal,
} from "../shared";

export const BWC_TABS_TAG = "bwc-tabs";
export const BWC_TABS_LIST_TAG = `${BWC_TABS_TAG}-list`;
export const BWC_TAB_TAG = "bwc-tab";
export const BWC_TAB_PANEL_TAG = "bwc-tab-panel";

type Orientation = "horizontal" | "vertical";
type ActivationMode = "automatic" | "manual";

type TabsContext = {
  activationMode: Signal<ActivationMode>;
  controlled: boolean;
  disabled: Signal<boolean>;
  orientation: Signal<Orientation>;
  revision: Signal<number>;
  value: Signal<string>;
  onValueChange: ChangeCallback<string>;
  ownsTab: (tab: HTMLButtonElement) => boolean;
  panelFor: (value: string) => HTMLElement | undefined;
  tabFor: (value: string) => HTMLButtonElement | undefined;
  registerList: (list: HTMLElement) => void;
  unregisterList: (list: HTMLElement) => void;
  registerPanel: (panel: HTMLElement, value: string) => void;
  updatePanel: (panel: HTMLElement, value: string) => void;
  unregisterPanel: (panel: HTMLElement) => void;
  registerTab: (tab: HTMLButtonElement, value: string) => void;
  updateTab: (tab: HTMLButtonElement, value: string) => void;
  unregisterTab: (tab: HTMLButtonElement) => void;
  select: (tab: HTMLButtonElement) => void;
  moveFocus: (tab: HTMLButtonElement, key: string) => boolean;
};

type TabsProperties = {
  value: string;
  defaultValue: string;
  orientation: Orientation;
  activationMode: ActivationMode;
  disabled: boolean;
  onValueChange: ChangeCallback<string>;
};

const tabsProperties = {
  value: "value",
  defaultValue: "default-value",
  orientation: "orientation",
  activationMode: "activation-mode",
  disabled: "disabled",
  onValueChange: null,
} as const;

const orientations = ["horizontal", "vertical"] as const;
const activationModes = ["automatic", "manual"] as const;

export const BwcTabsElement = defineComponent<TabsContext, HTMLElement, typeof tabsProperties>(
  BWC_TABS_TAG,
  HTMLElement,
  tabsProperties,
  (element, props, context, properties) => {
    const previous = context();
    let state: TabsContext;

    if ("value" in previous) {
      state = previous;
    } else {
      const value = signal(props.value() ?? "");
      const orientation = signal<Orientation>(
        enumValue(props.orientation(), orientations, "horizontal", "orientation"),
      );
      const activationMode = signal<ActivationMode>(
        enumValue(props.activationMode(), activationModes, "automatic", "activationMode"),
      );
      const disabled = signal(props.disabled() !== null);
      const revision = signal(0);
      const lists = new Set<HTMLElement>();
      const tabs = new Map<HTMLButtonElement, string>();
      const panels = new Map<HTMLElement, string>();

      const touch = () => revision(revision() + 1);
      const validate = (
        records: ReadonlyMap<HTMLElement, string>,
        owner: HTMLElement,
        next: string,
        kind: "tab" | "tab panel",
      ) => {
        // A reconnect may re-register the same owner; only another owner is a duplicate.
        if (!next) throw new TypeError(`${kind} value must be nonempty`);
        for (const [candidate, candidateValue] of records) {
          if (candidate !== owner && candidateValue === next) {
            throw new TypeError("tab and panel values must be unique and nonempty");
          }
        }
      };
      const registerTab = (tab: HTMLButtonElement, tabValue: string) => {
        validate(tabs, tab, tabValue, "tab");
        tabs.set(tab, tabValue);
        if (!state.controlled && !value()) {
          const preferred = props.defaultValue();
          if ((!preferred || preferred === tabValue) && !tab.hasAttribute("disabled")) {
            value(tabValue);
          }
        }
        touch();
      };
      const updateTab = (tab: HTMLButtonElement, tabValue: string) => {
        const previousValue = tabs.get(tab);
        validate(tabs, tab, tabValue, "tab");
        tabs.set(tab, tabValue);
        if (!state.controlled && previousValue === value()) value(tabValue);
        touch();
      };
      const unregisterTab = (tab: HTMLButtonElement) => {
        tabs.delete(tab);
        touch();
      };
      const registerPanel = (panel: HTMLElement, panelValue: string) => {
        validate(panels, panel, panelValue, "tab panel");
        panels.set(panel, panelValue);
        touch();
      };
      const updatePanel = (panel: HTMLElement, panelValue: string) => {
        validate(panels, panel, panelValue, "tab panel");
        panels.set(panel, panelValue);
        touch();
      };
      const unregisterPanel = (panel: HTMLElement) => {
        panels.delete(panel);
        touch();
      };
      const select = (tab: HTMLButtonElement) => {
        const next = tabs.get(tab);
        if (!next || disabled() || tab.disabled) return;
        emit(element, state.onValueChange, "value-change", "value", next);
        if (!state.controlled) value(next);
      };
      const enabledTabs = () => [...tabs.keys()].filter((tab) => !tab.disabled);
      const moveFocus = (tab: HTMLButtonElement, key: string) => {
        const enabled = enabledTabs();
        const index = enabled.indexOf(tab);
        if (index < 0 || enabled.length === 0) return false;
        const previousKey = orientation() === "horizontal" ? "ArrowLeft" : "ArrowUp";
        const nextKey = orientation() === "horizontal" ? "ArrowRight" : "ArrowDown";
        let next: HTMLButtonElement | undefined;
        if (key === previousKey) next = enabled[(index - 1 + enabled.length) % enabled.length];
        if (key === nextKey) next = enabled[(index + 1) % enabled.length];
        if (key === "Home") next = enabled[0];
        if (key === "End") next = enabled.at(-1);
        next?.focus();
        return Boolean(next);
      };

      state = {
        activationMode,
        controlled: props.value() !== null,
        disabled,
        onValueChange: null,
        orientation,
        revision,
        ownsTab: (tab) => tabs.has(tab),
        value,
        panelFor: (panelValue) => {
          revision();
          for (const [panel, registeredValue] of panels) {
            if (registeredValue === panelValue) return panel;
          }
          return undefined;
        },
        tabFor: (tabValue) => {
          revision();
          for (const [tab, registeredValue] of tabs) {
            if (registeredValue === tabValue) return tab;
          }
          return undefined;
        },
        registerList: (list) => {
          if (lists.size > 0 && !lists.has(list)) throw new TypeError("tabs accepts one list");
          lists.add(list);
          touch();
        },
        unregisterList: (list) => {
          lists.delete(list);
          touch();
        },
        registerPanel,
        updatePanel,
        unregisterPanel,
        registerTab,
        updateTab,
        unregisterTab,
        select,
        moveFocus,
      };
      context(state);
    }

    // Reconnects retain context state while rebuilding only connection-scoped effects and listeners.
    const { activationMode, disabled, orientation, value } = state;

    properties.install({
      value: {
        get: () => value(),
        set: (next) => {
          if (typeof next !== "string" || !next) {
            throw new TypeError("tabs value must be nonempty");
          }
          state.controlled = true;
          element.setAttribute("value", next);
        },
      },
      defaultValue: {
        get: () => props.defaultValue() ?? "",
        set: (next) => element.setAttribute("default-value", String(next)),
      },
      orientation: {
        get: () => orientation(),
        set: (next) => {
          const parsed = enumValue(String(next), orientations, "horizontal", "orientation");
          element.setAttribute("orientation", parsed);
        },
      },
      activationMode: {
        get: () => activationMode(),
        set: (next) => {
          const parsed = enumValue(String(next), activationModes, "automatic", "activationMode");
          element.setAttribute("activation-mode", parsed);
        },
      },
      disabled: {
        get: () => disabled(),
        set: (next) => element.toggleAttribute("disabled", booleanValue(next, "disabled")),
      },
      onValueChange: {
        get: () => state.onValueChange,
        set: (next) => {
          state.onValueChange = callbackValue<string>(next, "onValueChange");
        },
      },
    });

    const dispose = useEffects(() => {
      const controlledValue = props.value();
      if (controlledValue !== null) {
        state.controlled = true;
        value(controlledValue);
      } else if (state.controlled) {
        value("");
      }
      orientation(enumValue(props.orientation(), orientations, "horizontal", "orientation"));
      activationMode(
        enumValue(props.activationMode(), activationModes, "automatic", "activationMode"),
      );
      disabled(props.disabled() !== null);
    });
    const registeredTab = (event: Event) =>
      event
        .composedPath()
        .find(
          (target): target is HTMLButtonElement =>
            target instanceof HTMLButtonElement && state.ownsTab(target),
        );
    const click = (event: Event) => {
      const tab = registeredTab(event);
      if (tab) state.select(tab);
    };
    const focus = (event: FocusEvent) => {
      const tab = registeredTab(event);
      if (tab && activationMode() === "automatic") state.select(tab);
    };
    const keydown = (event: KeyboardEvent) => {
      const tab = registeredTab(event);
      if (!tab) return;
      if (state.moveFocus(tab, event.key)) event.preventDefault();
      if (activationMode() === "manual" && (event.key === "Enter" || event.key === " ")) {
        event.preventDefault();
        state.select(tab);
      }
    };
    element.addEventListener("click", click);
    element.addEventListener("focusin", focus);
    element.addEventListener("keydown", keydown);

    return {
      disconnect() {
        dispose();
        element.removeEventListener("click", click);
        element.removeEventListener("focusin", focus);
        element.removeEventListener("keydown", keydown);
      },
    };
  },
  () => {
    const listProperties = {} as const;
    defineComponent<TabsContext, HTMLElement, typeof listProperties>(
      "list",
      HTMLElement,
      listProperties,
      (element, _props, context) => {
        const state = context();
        state.registerList(element);
        element.classList.add("tabs-list");
        element.dataset.testid ||= BWC_TABS_LIST_TAG;
        element.style.userSelect = "none";
        const dispose = useEffects(() => {
          element.setAttribute("role", "tablist");
          element.setAttribute("aria-orientation", context().orientation());
        });
        return {
          disconnect() {
            dispose();
            state.unregisterList(element);
          },
        };
      },
    );
  },
) as unknown as { new (): HTMLElement & TabsProperties };

const tabProperties = { value: "value", disabled: "disabled" } as const;

export const BwcTabElement = defineComponent<TabsContext, HTMLButtonElement, typeof tabProperties>(
  BWC_TAB_TAG,
  HTMLButtonElement,
  tabProperties,
  (element, props, context, properties) => {
    const state = context();
    let itemDisabled = props.disabled() !== null;
    let settingDisabled = false;
    element.id ||= nextId(`${BWC_TAB_TAG}-button`);
    const forwardedClass = element.className.replace(/(?:^| )tab(?: |$)/g, " ").trim();

    properties.install({
      value: {
        get: () => props.value() ?? "",
        set: (next) => {
          if (typeof next !== "string" || !next) throw new TypeError("tab value must be nonempty");
          state.updateTab(element, next);
          element.setAttribute("value", next);
        },
      },
      disabled: {
        get: () => element.hasAttribute("disabled"),
        set: (next) => {
          itemDisabled = booleanValue(next, "disabled");
          element.toggleAttribute("data-item-disabled", itemDisabled);
          state.revision(state.revision() + 1);
        },
      },
    });
    state.registerTab(element, props.value() ?? "");

    const dispose = useEffects(() => {
      state.revision();
      const active = state.value() === (props.value() ?? "");
      const panel = state.panelFor(props.value() ?? "");
      const effectiveDisabled = state.disabled() || itemDisabled;
      settingDisabled = true;
      element.toggleAttribute("disabled", effectiveDisabled);
      settingDisabled = false;
      element.className = forwardedClass ? `tab ${forwardedClass}` : "tab";
      element.dataset.testid ||= BWC_TAB_TAG;
      element.type = "button";
      element.style.userSelect = "none";
      element.style.cursor = effectiveDisabled ? "not-allowed" : "pointer";
      element.setAttribute("role", "tab");
      element.setAttribute("aria-selected", String(active));
      if (panel) element.setAttribute("aria-controls", panel.id);
      else element.removeAttribute("aria-controls");
      element.tabIndex = active ? 0 : -1;
      element.toggleAttribute("data-active", active);
      element.toggleAttribute("data-inactive", !active);
      element.toggleAttribute("data-disabled", effectiveDisabled);
    });

    return {
      attributeChanged(name) {
        if (name === "value") state.updateTab(element, props.value() ?? "");
        if (name === "disabled" && !settingDisabled) {
          itemDisabled = props.disabled() !== null;
          element.toggleAttribute("data-item-disabled", itemDisabled);
          state.revision(state.revision() + 1);
        }
      },
      disconnect() {
        dispose();
        state.unregisterTab(element);
      },
    };
  },
  undefined,
  { contextParent: BWC_TABS_TAG, flat: true },
);

const panelProperties = { value: "value" } as const;

export const BwcTabPanelElement = defineComponent<TabsContext, HTMLElement, typeof panelProperties>(
  BWC_TAB_PANEL_TAG,
  HTMLElement,
  panelProperties,
  (element, props, context, properties) => {
    const state = context();
    element.id ||= nextId(BWC_TAB_PANEL_TAG);
    element.classList.add("tab-panel");
    element.dataset.testid ||= BWC_TAB_PANEL_TAG;

    properties.install({
      value: {
        get: () => props.value() ?? "",
        set: (next) => {
          if (typeof next !== "string" || !next) {
            throw new TypeError("tab panel value must be nonempty");
          }
          state.updatePanel(element, next);
          element.setAttribute("value", next);
        },
      },
    });
    state.registerPanel(element, props.value() ?? "");

    const dispose = useEffects(() => {
      state.revision();
      const panelValue = props.value() ?? "";
      const active = state.value() === panelValue;
      const tab = state.tabFor(panelValue);
      const labelledBy = tab?.id;
      element.setAttribute("role", "tabpanel");
      if (labelledBy) element.setAttribute("aria-labelledby", labelledBy);
      else element.removeAttribute("aria-labelledby");
      element.hidden = !active;
      element.toggleAttribute("data-active", active);
      element.toggleAttribute("data-inactive", !active);
      element.toggleAttribute("data-disabled", tab?.disabled ?? state.disabled());
    });

    return {
      attributeChanged(name) {
        if (name === "value") state.updatePanel(element, props.value() ?? "");
      },
      disconnect() {
        dispose();
        state.unregisterPanel(element);
      },
    };
  },
  undefined,
  { contextParent: BWC_TABS_TAG, flat: true },
);
