import { defineComponent, effect, html, onMount, signal, useHost, useProp } from "microfw";
import {
  booleanProp,
  callbackProp,
  emit,
  nextId,
  observeSlotSubtree,
  parseJsonStrings,
  slottedElements,
} from "../shared";

export const BWC_ACCORDION_TAG = "bwc-accordion";

type ChangeCallback<Value> = ((value: Value) => void) | null;

type AccordionApi = HTMLElement & {
  value: string[];
  defaultValue: string[];
  multiple: boolean;
  disabled: boolean;
  onValueChange: ChangeCallback<string[]>;
};

type AccordionItem = {
  details: HTMLDetailsElement;
  panel: HTMLDivElement;
  summary: HTMLElement;
  value: string;
};

function stringArray(raw: unknown, name: string): string[] {
  // Property input may already be an array; malformed values share attribute parsing semantics.
  const encoded = typeof raw === "string" ? raw : JSON.stringify(raw);
  return parseJsonStrings(encoded ?? null, name);
}

function accordionItems(host: HTMLElement): AccordionItem[] {
  const details = slottedElements(host, "item", HTMLDetailsElement);
  const values = details.map((item) => item.dataset.value ?? "");
  if (values.some((value) => !value) || new Set(values).size !== values.length) {
    throw new TypeError("accordion item values must be unique and nonempty");
  }

  return details.map((item, index) => {
    const summary = item.querySelector<HTMLElement>(":scope > summary");
    const panel = item.querySelector<HTMLDivElement>(":scope > div");
    if (!summary || !panel) {
      throw new TypeError("accordion items require a direct summary and div");
    }
    return { details: item, panel, summary, value: values[index]! };
  });
}

export const BwcAccordionElement = defineAccordion();

function defineAccordion(): { new (): AccordionApi } {
  return defineComponent<AccordionApi>(BWC_ACCORDION_TAG, () => {
    const host = useHost<AccordionApi>();
    const assignedValue = Object.hasOwn(host, "value");
    const controlled = signal(host.hasAttribute("value") || assignedValue);
    const currentValue = signal<string[]>([]);
    let initialized = false;
    const setCurrentValue = (next: string[]) => {
      const previous = currentValue();
      if (
        previous.length !== next.length ||
        previous.some((entry, index) => entry !== next[index])
      ) {
        currentValue([...next]);
      }
    };

    const multiple = useProp("multiple", booleanProp("multiple"));
    const disabled = useProp("disabled", booleanProp("disabled"));
    const defaultValue = useProp("defaultValue", {
      attribute: "default-value",
      defaultValue: [] as string[],
      fromAttribute: (raw) => parseJsonStrings(raw, "defaultValue"),
      fromProperty: (raw) => stringArray(raw, "defaultValue"),
      toAttribute: (value) => JSON.stringify(value),
      get: (value) => [...value],
    });
    const value = useProp("value", {
      attribute: "value",
      defaultValue: [] as string[],
      fromAttribute: (raw) => {
        controlled(raw !== null);
        const next = parseJsonStrings(raw, "value");
        if (initialized && raw === null) setCurrentValue([]);
        return next;
      },
      fromProperty: (raw) => stringArray(raw, "value"),
      toAttribute: (next) => (controlled() ? JSON.stringify(next) : null),
      get: () => [...currentValue()],
      onSet: (next, commit) => {
        if (!multiple() && next.length > 1) {
          throw new TypeError("single accordion accepts at most one value");
        }
        controlled(true);
        commit(next);
        setCurrentValue(next);
      },
    });
    const onValueChange = useProp<ChangeCallback<string[]>>(
      "onValueChange",
      callbackProp<string[]>("onValueChange"),
    );
    const sync = () => {
      const items = accordionItems(host);
      if (!initialized) {
        initialized = true;
        setCurrentValue(controlled() ? value() : defaultValue());
      } else if (controlled()) {
        setCurrentValue(value());
      }

      const selected = currentValue();
      if (!multiple() && selected.length > 1) {
        throw new TypeError("single accordion accepts at most one value");
      }
      const rootDisabled = disabled();
      host.toggleAttribute("data-disabled", rootDisabled);

      for (const item of items) {
        const open = selected.includes(item.value);
        const itemDisabled = rootDisabled || item.details.hasAttribute("disabled");
        if (item.details.open !== open) item.details.open = open;
        item.summary.id ||= nextId("bwc-accordion-summary");
        item.panel.id ||= nextId("bwc-accordion-panel");
        item.summary.classList.add("accordion-trigger");
        item.summary.dataset.testid ||= `bwc-accordion-summary-${item.value}`;
        item.summary.setAttribute("aria-controls", item.panel.id);
        item.summary.setAttribute("aria-disabled", String(itemDisabled));
        item.summary.style.cursor = itemDisabled ? "not-allowed" : "pointer";
        item.panel.setAttribute("role", "region");
        item.panel.setAttribute("aria-labelledby", item.summary.id);

        for (const node of [item.details, item.summary, item.panel]) {
          node.toggleAttribute("data-open", open);
          node.toggleAttribute("data-closed", !open);
          node.toggleAttribute("data-disabled", itemDisabled);
        }
      }
    };

    const toggle = (event: Event) => {
      const details = event.target;
      if (!(details instanceof HTMLDetailsElement)) return;
      const item = accordionItems(host).find((candidate) => candidate.details === details);
      if (!item) return;

      const selected = currentValue();
      const alreadySynchronized = details.open === selected.includes(item.value);
      if (disabled() || details.hasAttribute("disabled") || alreadySynchronized) {
        sync();
        return;
      }
      const next = details.open
        ? multiple()
          ? [...selected.filter((entry) => entry !== item.value), item.value]
          : [item.value]
        : selected.filter((entry) => entry !== item.value);

      emit(host, onValueChange(), "value-change", "value", [...next]);
      if (!controlled()) currentValue(next);
      sync();
    };

    onMount(() => {
      sync();
      const stopEffect = effect(sync);
      let stopObserving: (() => void) | undefined;
      try {
        stopObserving = observeSlotSubtree(host, sync, ["data-value", "disabled", "slot"]);
        host.addEventListener("toggle", toggle, true);
      } catch (error) {
        stopObserving?.();
        stopEffect();
        host.removeEventListener("toggle", toggle, true);
        throw error;
      }

      return () => {
        host.removeEventListener("toggle", toggle, true);
        stopObserving?.();
        stopEffect();
      };
    });

    return html`<slot name="item"></slot>`;
  });
}
