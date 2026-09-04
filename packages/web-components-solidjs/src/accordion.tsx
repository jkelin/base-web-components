import { createEffect, onCleanup } from "solid-js";
import { customElement } from "solid-element";
import {
  type ChangeCallback,
  booleanProp,
  classProp,
  createControl,
  emit,
  initializeBooleanProps,
  nextId,
  parseJsonStrings,
  preserveChildren,
  reflectedProp,
  type SolidElementHost,
  useLightDom,
  watchChildren,
} from "./shared";

export const SOLID_ACCORDION_TAG = "solid-accordion";
export const SOLID_ACCORDION_ITEM_TAG = "solid-accordion-item";
export const SOLID_ACCORDION_TRIGGER_TAG = "solid-accordion-trigger";
export const SOLID_ACCORDION_PANEL_TAG = "solid-accordion-panel";

interface ItemProps {
  value: string;
  disabled: boolean;
}

export const SolidAccordionItemElement = customElement<ItemProps>(
  SOLID_ACCORDION_ITEM_TAG,
  { value: reflectedProp("", "value"), disabled: booleanProp("disabled") },
  (_props, { element }) => {
    useLightDom();
    const host = element as unknown as SolidElementHost;
    initializeBooleanProps(host, { disabled: "disabled" });
    preserveChildren(host);
  },
);

interface ControlProps {
  hostClass: string;
  disabled: boolean;
}

export const SolidAccordionTriggerElement = customElement<ControlProps>(
  SOLID_ACCORDION_TRIGGER_TAG,
  { hostClass: classProp, disabled: booleanProp("disabled") },
  (props, { element }) =>
    createControl(element as unknown as SolidElementHost, props, "button", "accordion-trigger"),
);

export const SolidAccordionPanelElement = customElement(
  SOLID_ACCORDION_PANEL_TAG,
  (_props, { element }) => {
    useLightDom();
    preserveChildren(element as unknown as SolidElementHost);
  },
);

interface AccordionProps {
  value?: unknown;
  defaultValue?: unknown;
  multiple: boolean;
  disabled: boolean;
  onValueChange: ChangeCallback<string[]>;
}

export const SolidAccordionElement = customElement<AccordionProps>(
  SOLID_ACCORDION_TAG,
  {
    value: reflectedProp<unknown>(undefined, "value"),
    defaultValue: reflectedProp<unknown>(undefined, "default-value"),
    multiple: booleanProp("multiple"),
    disabled: booleanProp("disabled"),
    onValueChange: null,
  },
  (props, { element }) => {
    useLightDom();
    const host = element as unknown as SolidElementHost & AccordionProps;
    preserveChildren(host);
    initializeBooleanProps(host, { multiple: "multiple", disabled: "disabled" });

    let controlled = host.hasAttribute("value");
    let internalWrite = false;
    host.addPropertyChangedCallback((name) => {
      if (name === "value" && !internalWrite) controlled = true;
    });
    const setValue = (value: string[]): void => {
      internalWrite = true;
      host.value = [...value];
      internalWrite = false;
    };
    setValue(
      parseJsonStrings(
        controlled ? props.value : props.defaultValue,
        controlled ? "value" : "defaultValue",
      ),
    );

    const sync = (): void => {
      const value = parseJsonStrings(props.value, "value");
      const items = [...host.querySelectorAll<HTMLElement>(SOLID_ACCORDION_ITEM_TAG)];
      const values = items.map((item) => String((item as HTMLElement & ItemProps).value ?? ""));
      if (values.some((item) => !item) || new Set(values).size !== values.length)
        throw new TypeError("accordion item values must be unique and nonempty");
      if (!host.hasAttribute("multiple") && value.length > 1)
        throw new TypeError("single accordion accepts at most one value");

      for (const item of items) {
        const trigger = item.querySelector<HTMLElement>(`:scope > ${SOLID_ACCORDION_TRIGGER_TAG}`);
        const panel = item.querySelector<HTMLElement>(`:scope > ${SOLID_ACCORDION_PANEL_TAG}`);
        const button = trigger?.querySelector<HTMLButtonElement>("button");
        if (!trigger || !panel || !button) continue;
        const open = value.includes(String((item as HTMLElement & ItemProps).value));
        const disabled = host.hasAttribute("disabled") || item.hasAttribute("disabled");
        button.id ||= nextId(`${SOLID_ACCORDION_TRIGGER_TAG}-button`);
        panel.id ||= nextId(SOLID_ACCORDION_PANEL_TAG);
        button.setAttribute("aria-expanded", String(open));
        button.setAttribute("aria-controls", panel.id);
        button.toggleAttribute("disabled", disabled);
        button.style.cursor = disabled ? "not-allowed" : "pointer";
        panel.setAttribute("role", "region");
        panel.setAttribute("aria-labelledby", button.id);
        panel.hidden = !open;
        for (const node of [item, trigger, panel]) {
          node.toggleAttribute("data-open", open);
          node.toggleAttribute("data-closed", !open);
          node.toggleAttribute("data-disabled", disabled);
        }
      }
    };
    createEffect(sync);
    watchChildren(host, sync);

    const onClick = (event: Event): void => {
      const button = (event.target as Element).closest(`${SOLID_ACCORDION_TRIGGER_TAG} > button`);
      const item = button?.parentElement?.parentElement as (HTMLElement & ItemProps) | null;
      if (
        !item ||
        item.localName !== SOLID_ACCORDION_ITEM_TAG ||
        host.hasAttribute("disabled") ||
        item.hasAttribute("disabled")
      )
        return;
      const current = parseJsonStrings(props.value, "value");
      const next = current.includes(item.value)
        ? current.filter((value) => value !== item.value)
        : host.hasAttribute("multiple")
          ? [...current, item.value]
          : [item.value];
      emit(host, props.onValueChange, "value-change", "value", next);
      if (!controlled) setValue(next);
    };
    host.addEventListener("click", onClick);
    onCleanup(() => host.removeEventListener("click", onClick));
  },
);
