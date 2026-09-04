import { createEffect } from "solid-js";
import { customElement } from "solid-element";
import { classProp, reflectedProp, type SolidElementHost, useLightDom } from "./shared";
import { SOLID_COUNTER_LABEL_TAG, SOLID_COUNTER_TAG, parseCounterValue } from "./counter";

interface CounterLabelProps {
  value?: unknown;
  hostClass: string;
}

export const SolidCounterLabelElement = customElement<CounterLabelProps>(
  SOLID_COUNTER_LABEL_TAG,
  {
    value: reflectedProp<unknown>(undefined, "value"),
    hostClass: classProp,
  },
  (props, { element }) => {
    useLightDom();
    const host = element as unknown as SolidElementHost;
    const control = document.createElement("span");
    const owner = host.closest(SOLID_COUNTER_TAG) as (HTMLElement & { value?: unknown }) | null;

    createEffect(() => {
      const value = props.value === undefined ? owner?.value : props.value;
      control.setAttribute("aria-live", "polite");
      control.dataset.testid = SOLID_COUNTER_LABEL_TAG;
      control.className = props.hostClass ? `counter-label ${props.hostClass}` : "counter-label";
      control.textContent = String(parseCounterValue(value));
    });

    return control;
  },
);
