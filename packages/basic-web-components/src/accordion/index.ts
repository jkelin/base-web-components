import {
  booleanValue,
  callbackValue,
  decorateButton,
  defineComponent,
  emit,
  nextId,
  observeChildren,
  parseJsonStrings,
  useEffects,
  type ChangeCallback,
} from "../shared";

export const BWC_ACCORDION_TAG = "bwc-accordion";
export const BWC_ACCORDION_ITEM_TAG = `${BWC_ACCORDION_TAG}-item`;
export const BWC_ACCORDION_TRIGGER_TAG = `${BWC_ACCORDION_TAG}-trigger`;
export const BWC_ACCORDION_PANEL_TAG = `${BWC_ACCORDION_TAG}-panel`;

type AccordionApi = HTMLElement & {
  value: string[];
  defaultValue: string[];
  multiple: boolean;
  disabled: boolean;
  onValueChange: ChangeCallback<string[]>;
};

type AccordionState = {
  controlled: boolean;
  initialized: boolean;
  onValueChange: ChangeCallback<string[]>;
  value: string[];
};

const accordionProperties = {
  value: "value",
  defaultValue: "default-value",
  multiple: "multiple",
  disabled: "disabled",
  onValueChange: null,
} as const;

export const BwcAccordionElement = defineComponent<
  AccordionState,
  HTMLElement,
  typeof accordionProperties
>(
  BWC_ACCORDION_TAG,
  HTMLElement,
  accordionProperties,
  (element, props, context, properties) => {
    const previous = context();
    // Defaults initialize once; reconnects retain the last uncontrolled expansion state.
    const state: AccordionState =
      "value" in previous
        ? previous
        : {
            controlled: props.value() !== null,
            initialized: false,
            onValueChange: null,
            value: [],
          };
    context(state);

    const sync = () => {
      const items = [...element.querySelectorAll<HTMLElement>(BWC_ACCORDION_ITEM_TAG)];
      const values = items.map((item) => item.getAttribute("value") ?? "");
      if (values.some((itemValue) => !itemValue) || new Set(values).size !== values.length) {
        throw new TypeError("accordion item values must be unique and nonempty");
      }
      if (!state.initialized) {
        state.initialized = true;
        if (!state.controlled) {
          state.value = parseJsonStrings(props.defaultValue(), "defaultValue");
        }
      }
      const multiple = props.multiple() !== null;
      if (!multiple && state.value.length > 1) {
        throw new TypeError("single accordion accepts at most one value");
      }
      const disabled = props.disabled() !== null;
      for (const item of items) {
        const trigger = item.querySelector<HTMLButtonElement>(
          `button[is="${BWC_ACCORDION_TRIGGER_TAG}"]`,
        );
        const panel = item.querySelector<HTMLElement>(`:scope > ${BWC_ACCORDION_PANEL_TAG}`);
        if (!trigger || !panel) continue;
        const open = state.value.includes(item.getAttribute("value") ?? "");
        trigger.id ||= nextId(`${BWC_ACCORDION_TRIGGER_TAG}-button`);
        panel.id ||= nextId(BWC_ACCORDION_PANEL_TAG);
        trigger.setAttribute("aria-expanded", String(open));
        trigger.setAttribute("aria-controls", panel.id);
        trigger.disabled = disabled || item.hasAttribute("disabled");
        decorateButton(
          trigger,
          "accordion-trigger",
          BWC_ACCORDION_TRIGGER_TAG,
          trigger.className.replace(/(?:^| )accordion-trigger(?: |$)/g, " ").trim(),
        );
        panel.setAttribute("role", "region");
        panel.setAttribute("aria-labelledby", trigger.id);
        panel.hidden = !open;
        for (const node of [item, trigger, panel]) {
          node.toggleAttribute("data-open", open);
          node.toggleAttribute("data-closed", !open);
          node.toggleAttribute("data-disabled", disabled || item.hasAttribute("disabled"));
        }
      }
    };

    properties.install({
      value: {
        get: () => [...state.value],
        set: (next) => {
          state.controlled = true;
          element.setAttribute(
            "value",
            JSON.stringify(parseJsonStrings(JSON.stringify(next), "value")),
          );
        },
      },
      defaultValue: {
        get: () => parseJsonStrings(props.defaultValue(), "defaultValue"),
        set: (next) =>
          element.setAttribute(
            "default-value",
            JSON.stringify(parseJsonStrings(JSON.stringify(next), "defaultValue")),
          ),
      },
      multiple: {
        get: () => props.multiple() !== null,
        set: (next) => element.toggleAttribute("multiple", booleanValue(next, "multiple")),
      },
      disabled: {
        get: () => props.disabled() !== null,
        set: (next) => element.toggleAttribute("disabled", booleanValue(next, "disabled")),
      },
      onValueChange: {
        get: () => state.onValueChange,
        set: (next) => {
          state.onValueChange = callbackValue<string[]>(next, "onValueChange");
        },
      },
    });

    const click = (event: Event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const trigger = target.closest(`button[is="${BWC_ACCORDION_TRIGGER_TAG}"]`);
      const item = trigger?.closest(BWC_ACCORDION_ITEM_TAG);
      if (
        !(item instanceof HTMLElement) ||
        props.disabled() !== null ||
        item.hasAttribute("disabled")
      ) {
        return;
      }
      const itemValue = item.getAttribute("value") ?? "";
      const next = state.value.includes(itemValue)
        ? state.value.filter((current) => current !== itemValue)
        : props.multiple() !== null
          ? [...state.value, itemValue]
          : [itemValue];
      emit(element, state.onValueChange, "value-change", "value", next);
      if (!state.controlled) {
        state.value = next;
        sync();
      }
    };
    element.addEventListener("click", click);
    const observer = observeChildren(element, sync);
    const dispose = useEffects(() => {
      const controlledValue = props.value();
      if (controlledValue !== null) {
        state.controlled = true;
        state.value = parseJsonStrings(controlledValue, "value");
      } else if (state.controlled) {
        state.value = [];
      }
      sync();
    });

    return {
      disconnect() {
        dispose();
        element.removeEventListener("click", click);
        observer.disconnect();
      },
    };
  },
  () => {
    const itemProperties = { value: "value", disabled: "disabled" } as const;
    defineComponent<unknown, HTMLElement, typeof itemProperties>(
      "item",
      HTMLElement,
      itemProperties,
      (element, props, _context, properties) => {
        properties.install({
          value: {
            get: () => props.value() ?? "",
            set: (next) => {
              if (typeof next !== "string" || !next) {
                throw new TypeError("accordion item value must be nonempty");
              }
              element.setAttribute("value", next);
            },
          },
          disabled: {
            get: () => props.disabled() !== null,
            set: (next) => element.toggleAttribute("disabled", booleanValue(next, "disabled")),
          },
        });
      },
    );
    const emptyProperties = {} as const;
    defineComponent<unknown, HTMLButtonElement, typeof emptyProperties>(
      "trigger",
      HTMLButtonElement,
      emptyProperties,
      (element) => {
        decorateButton(element, "accordion-trigger", BWC_ACCORDION_TRIGGER_TAG, element.className);
        return {
          attributeChanged: () =>
            decorateButton(
              element,
              "accordion-trigger",
              BWC_ACCORDION_TRIGGER_TAG,
              element.className.replace(/(?:^| )accordion-trigger(?: |$)/g, " ").trim(),
            ),
        };
      },
    );
    defineComponent<unknown, HTMLElement, typeof emptyProperties>(
      "panel",
      HTMLElement,
      emptyProperties,
      () => undefined,
    );
  },
) as unknown as { new (): AccordionApi };
