import { customElement } from "solid-element";
import { booleanProp, classProp, createControl, type SolidElementHost } from "./shared";
import { SOLID_COUNTER_MINUS_TAG, SOLID_COUNTER_PLUS_TAG } from "./counter";

interface CounterButtonProps {
  hostClass: string;
  disabled: boolean;
}

function defineCounterButton(
  tag: string,
  label: string,
  text: string,
  marker: string,
): CustomElementConstructor {
  return customElement<CounterButtonProps>(
    tag,
    { hostClass: classProp, disabled: booleanProp("disabled") },
    (props, { element }) => {
      const button = createControl(
        element as unknown as SolidElementHost,
        props,
        "button",
        marker,
        text,
      );
      button.setAttribute("aria-label", label);
      return button;
    },
  );
}

export const SolidCounterMinusElement = defineCounterButton(
  SOLID_COUNTER_MINUS_TAG,
  "Decrement count",
  "−",
  "counter-minus-button",
);
export const SolidCounterPlusElement = defineCounterButton(
  SOLID_COUNTER_PLUS_TAG,
  "Increment count",
  "+",
  "counter-plus-button",
);
