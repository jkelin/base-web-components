import { createEffect, onCleanup } from "solid-js";
import { customElement } from "solid-element";
import {
  preserveChildren,
  reflectedProp,
  type SolidElementHost,
  useLightDom,
  watchChildren,
} from "./shared";

export const SOLID_COUNTER_TAG = "solid-counter";
export const SOLID_COUNTER_MINUS_TAG = "solid-counter-minus-button";
export const SOLID_COUNTER_LABEL_TAG = "solid-counter-label";
export const SOLID_COUNTER_PLUS_TAG = "solid-counter-plus-button";

/** Lenient numeric coercion: non-finite values become 0 and fractions are truncated. */
export function parseCounterValue(raw: unknown): number {
  const value =
    typeof raw === "number" ? raw : Number(typeof raw === "string" ? raw.trim() : Number.NaN);
  return Number.isFinite(value) ? Math.trunc(value) : 0;
}

interface CounterProps {
  value?: unknown;
  defaultValue?: unknown;
  onChange: ((value: number) => void) | null;
}

export const SolidCounterElement = customElement<CounterProps>(
  SOLID_COUNTER_TAG,
  {
    value: reflectedProp<unknown>(undefined, "value"),
    defaultValue: reflectedProp<unknown>(undefined, "default-value"),
    onChange: null,
  },
  (props, { element }) => {
    useLightDom();
    const host = element as unknown as SolidElementHost & CounterProps;
    preserveChildren(host);

    let controlled = host.hasAttribute("value");
    let internalWrite = false;
    host.addPropertyChangedCallback((name) => {
      if (name === "value" && !internalWrite) controlled = true;
    });
    const setValue = (value: number): void => {
      internalWrite = true;
      host.value = value;
      internalWrite = false;
    };
    setValue(parseCounterValue(controlled ? props.value : props.defaultValue));

    const syncLabel = (): void => {
      const label = host.querySelector(SOLID_COUNTER_LABEL_TAG);
      const next = String(parseCounterValue(props.value));
      // Equality prevents observer feedback when the label is already current.
      if (label?.getAttribute("value") !== next) label?.setAttribute("value", next);
    };
    createEffect(syncLabel);
    watchChildren(host, syncLabel);

    const onClick = (event: Event): void => {
      const origin = (event.target as Element).closest(
        `${SOLID_COUNTER_MINUS_TAG},${SOLID_COUNTER_PLUS_TAG}`,
      );
      if (!origin || !host.contains(origin)) return;
      const next =
        parseCounterValue(props.value) + (origin.localName === SOLID_COUNTER_PLUS_TAG ? 1 : -1);
      if (!controlled) setValue(next);
      props.onChange?.(next);
      host.dispatchEvent(
        new CustomEvent("change", { bubbles: true, composed: true, detail: { value: next } }),
      );
    };
    host.addEventListener("click", onClick);
    onCleanup(() => host.removeEventListener("click", onClick));
  },
);
