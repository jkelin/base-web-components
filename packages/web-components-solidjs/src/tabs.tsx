import { createEffect, onCleanup } from "solid-js";
import { customElement } from "solid-element";
import {
  type ChangeCallback,
  booleanProp,
  classProp,
  createControl,
  emit,
  enumValue,
  initializeBooleanProps,
  nextId,
  preserveChildren,
  reflectedProp,
  type SolidElementHost,
  useLightDom,
  watchChildren,
} from "./shared";

export const SOLID_TABS_TAG = "solid-tabs";
export const SOLID_TABS_LIST_TAG = "solid-tabs-list";
export const SOLID_TAB_TAG = "solid-tab";
export const SOLID_TAB_PANEL_TAG = "solid-tab-panel";
type Orientation = "horizontal" | "vertical";
type ActivationMode = "automatic" | "manual";
const ORIENTATIONS = ["horizontal", "vertical"] as const;
const ACTIVATION_MODES = ["automatic", "manual"] as const;

export const SolidTabsListElement = customElement(SOLID_TABS_LIST_TAG, (_props, { element }) => {
  useLightDom();
  preserveChildren(element as unknown as SolidElementHost);
});

interface TabProps {
  value: string;
  disabled: boolean;
  hostClass: string;
}

export const SolidTabElement = customElement<TabProps>(
  SOLID_TAB_TAG,
  {
    value: reflectedProp("", "value"),
    disabled: booleanProp("disabled"),
    hostClass: classProp,
  },
  (props, { element }) =>
    createControl(element as unknown as SolidElementHost, props, "button", "tab"),
);

interface PanelProps {
  value: string;
}

export const SolidTabPanelElement = customElement<PanelProps>(
  SOLID_TAB_PANEL_TAG,
  { value: reflectedProp("", "value") },
  (_props, { element }) => {
    useLightDom();
    preserveChildren(element as unknown as SolidElementHost);
  },
);

interface TabsProps {
  value: string;
  defaultValue: string;
  orientation: Orientation;
  activationMode: ActivationMode;
  disabled: boolean;
  onValueChange: ChangeCallback<string>;
}

export const SolidTabsElement = customElement<TabsProps>(
  SOLID_TABS_TAG,
  {
    value: reflectedProp("", "value"),
    defaultValue: reflectedProp("", "default-value"),
    orientation: reflectedProp<Orientation>("horizontal", "orientation"),
    activationMode: reflectedProp<ActivationMode>("automatic", "activation-mode"),
    disabled: booleanProp("disabled"),
    onValueChange: null,
  },
  (props, { element }) => {
    useLightDom();
    const host = element as unknown as SolidElementHost & TabsProps;
    preserveChildren(host);
    initializeBooleanProps(host, { disabled: "disabled" });

    let controlled = host.hasAttribute("value");
    let internalWrite = false;
    host.addPropertyChangedCallback((name) => {
      if (name === "value" && !internalWrite) controlled = true;
    });
    const setValue = (value: string): void => {
      internalWrite = true;
      host.value = value;
      internalWrite = false;
    };
    setValue(controlled ? props.value : props.defaultValue);

    const orientation = (): Orientation =>
      enumValue(props.orientation, ORIENTATIONS, "horizontal", "orientation");
    const activationMode = (): ActivationMode =>
      enumValue(props.activationMode, ACTIVATION_MODES, "automatic", "activationMode");
    const tabs = (): Array<HTMLElement & TabProps> => [
      ...host.querySelectorAll<HTMLElement & TabProps>(SOLID_TAB_TAG),
    ];
    const select = (tab: HTMLElement & TabProps): void => {
      if (host.hasAttribute("disabled") || tab.hasAttribute("disabled")) return;
      emit(host, props.onValueChange, "value-change", "value", tab.value);
      if (!controlled) setValue(tab.value);
    };
    const sync = (): void => {
      const currentTabs = tabs();
      const panels = [...host.querySelectorAll<HTMLElement & PanelProps>(SOLID_TAB_PANEL_TAG)];
      if (!props.value && !controlled) {
        const first = currentTabs.find((tab) => !tab.hasAttribute("disabled"));
        if (first) {
          setValue(first.value);
          return;
        }
      }
      const values = currentTabs.map((tab) => tab.value);
      const panelValues = panels.map((panel) => panel.value);
      if (
        values.some((item) => !item) ||
        new Set(values).size !== values.length ||
        panelValues.some((item) => !item) ||
        new Set(panelValues).size !== panelValues.length
      )
        throw new TypeError("tab and panel values must be unique and nonempty");
      const list = host.querySelector(SOLID_TABS_LIST_TAG);
      list?.setAttribute("role", "tablist");
      list?.setAttribute("aria-orientation", orientation());
      activationMode();
      for (const tab of currentTabs) {
        const button = tab.querySelector<HTMLButtonElement>("button");
        const panel = panels.find((candidate) => candidate.value === tab.value);
        if (!button || !panel) continue;
        const active = tab.value === props.value;
        const disabled = host.hasAttribute("disabled") || tab.hasAttribute("disabled");
        button.id ||= nextId(`${SOLID_TAB_TAG}-button`);
        panel.id ||= nextId(SOLID_TAB_PANEL_TAG);
        button.setAttribute("role", "tab");
        button.setAttribute("aria-selected", String(active));
        button.setAttribute("aria-controls", panel.id);
        button.tabIndex = active ? 0 : -1;
        button.toggleAttribute("disabled", disabled);
        button.style.cursor = disabled ? "not-allowed" : "pointer";
        panel.setAttribute("role", "tabpanel");
        panel.setAttribute("aria-labelledby", button.id);
        panel.hidden = !active;
        for (const node of [tab, button, panel]) {
          node.toggleAttribute("data-active", active);
          node.toggleAttribute("data-inactive", !active);
          node.toggleAttribute("data-disabled", disabled);
        }
      }
    };
    createEffect(sync);
    watchChildren(host, sync);

    const onClick = (event: Event): void => {
      const tab = (event.target as Element).closest(`${SOLID_TAB_TAG} > button`)?.parentElement;
      if (tab?.localName === SOLID_TAB_TAG) select(tab as HTMLElement & TabProps);
    };
    const onFocus = (event: FocusEvent): void => {
      const tab = (event.target as Element).closest(SOLID_TAB_TAG);
      if (tab?.localName === SOLID_TAB_TAG && activationMode() === "automatic")
        select(tab as HTMLElement & TabProps);
    };
    const onKey = (event: KeyboardEvent): void => {
      const tab = (event.target as Element).closest(SOLID_TAB_TAG) as
        | (HTMLElement & TabProps)
        | null;
      if (!tab || tab.localName !== SOLID_TAB_TAG) return;
      const enabled = tabs().filter((item) => !item.hasAttribute("disabled"));
      const index = enabled.indexOf(tab);
      const previousKey = orientation() === "horizontal" ? "ArrowLeft" : "ArrowUp";
      const nextKey = orientation() === "horizontal" ? "ArrowRight" : "ArrowDown";
      let next: (HTMLElement & TabProps) | undefined;
      if (event.key === previousKey) next = enabled[(index - 1 + enabled.length) % enabled.length];
      if (event.key === nextKey) next = enabled[(index + 1) % enabled.length];
      if (event.key === "Home") next = enabled[0];
      if (event.key === "End") next = enabled.at(-1);
      if (next) {
        event.preventDefault();
        next.querySelector<HTMLButtonElement>("button")?.focus();
      }
      if (activationMode() === "manual" && (event.key === "Enter" || event.key === " ")) {
        event.preventDefault();
        select(tab);
      }
    };
    host.addEventListener("click", onClick);
    host.addEventListener("keydown", onKey);
    host.addEventListener("focusin", onFocus);
    onCleanup(() => {
      host.removeEventListener("click", onClick);
      host.removeEventListener("keydown", onKey);
      host.removeEventListener("focusin", onFocus);
    });
  },
);
