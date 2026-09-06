import { defineComponent, effect, html, onMount, signal, useHost, useProp } from "microfw";
import {
  booleanProp,
  callbackProp,
  emit,
  nextId,
  observeSlotSubtree,
  parseJsonStrings,
  slottedElements,
  setAttributeValue,
  toggleState,
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
    const parts = signal<AccordionItem[] | null>(null);
    const topologyRevision = signal(0);
    const disabledRevision = signal(0);
    let topologyVersion = 0;
    let disabledVersion = 0;
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

    const toggle = (event: Event) => {
      const details = event.target;
      const currentParts = parts();
      if (!(details instanceof HTMLDetailsElement) || !currentParts) return;
      const item = currentParts.find((candidate) => candidate.details === details);
      if (!item) return;

      const selected = currentValue();
      const alreadySynchronized = details.open === selected.includes(item.value);
      if (disabled() || details.hasAttribute("disabled") || alreadySynchronized) {
        details.open = selected.includes(item.value);
        return;
      }
      const next = details.open
        ? multiple()
          ? [...selected.filter((entry) => entry !== item.value), item.value]
          : [item.value]
        : selected.filter((entry) => entry !== item.value);

      emit(host, onValueChange(), "value-change", "value", [...next]);
      if (!controlled()) setCurrentValue(next);
      else details.open = selected.includes(item.value);
    };

    onMount(() => {
      let stopObserver: (() => void) | undefined;
      let stopTopology: (() => void) | undefined;
      let stopControl: (() => void) | undefined;
      let stopState: (() => void) | undefined;
      const cleanup = () => {
        host.removeEventListener("toggle", toggle, true);
        stopObserver?.();
        stopState?.();
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
                  record.attributeName === "data-value",
              )
            ) {
              topologyRevision(++topologyVersion);
            } else {
              disabledRevision(++disabledVersion);
            }
          },
          ["data-value", "disabled", "slot"],
        );
        stopTopology = effect(() => {
          topologyRevision();
          parts(null);
          const nextParts = accordionItems(host);
          for (const item of nextParts) {
            item.summary.id ||= nextId("bwc-accordion-summary");
            item.panel.id ||= nextId("bwc-accordion-panel");
            item.summary.classList.add("accordion-trigger");
            item.summary.dataset.testid ||= `bwc-accordion-summary-${item.value}`;
            setAttributeValue(item.summary, "aria-controls", item.panel.id);
            setAttributeValue(item.panel, "role", "region");
            setAttributeValue(item.panel, "aria-labelledby", item.summary.id);
          }
          parts(nextParts);
        });
        stopControl = effect(() => {
          const isControlled = controlled();
          const next = isControlled ? value() : defaultValue();
          if (!initialized) {
            initialized = true;
            setCurrentValue(next);
          } else if (isControlled) {
            setCurrentValue(next);
          }
        });
        stopState = effect(() => {
          disabledRevision();
          const currentParts = parts();
          if (!currentParts) return;
          const selected = currentValue();
          if (!multiple() && selected.length > 1) {
            throw new TypeError("single accordion accepts at most one value");
          }
          const rootDisabled = disabled();
          toggleState(host, "data-disabled", rootDisabled);

          for (const item of currentParts) {
            const open = selected.includes(item.value);
            const itemDisabled = rootDisabled || item.details.hasAttribute("disabled");
            if (item.details.open !== open) item.details.open = open;
            setAttributeValue(item.summary, "aria-disabled", String(itemDisabled));
            const cursor = itemDisabled ? "not-allowed" : "pointer";
            if (item.summary.style.cursor !== cursor) item.summary.style.cursor = cursor;
            for (const node of [item.details, item.summary, item.panel]) {
              toggleState(node, "data-open", open);
              toggleState(node, "data-closed", !open);
              toggleState(node, "data-disabled", itemDisabled);
            }
          }
        });
        host.addEventListener("toggle", toggle, true);
        return cleanup;
      } catch (error) {
        cleanup();
        throw error;
      }
    });

    return html`<slot name="item"></slot>`;
  });
}
