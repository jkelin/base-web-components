import { signal } from "alien-signals";
import {
  callbackValue,
  decorateButton,
  defineComponent,
  emit,
  useEffects,
  type Signal,
} from "../shared";

export const BWC_COUNTER_TAG = "bwc-counter";
export const BWC_COUNTER_MINUS_TAG = `${BWC_COUNTER_TAG}-minus-button`;
export const BWC_COUNTER_LABEL_TAG = `${BWC_COUNTER_TAG}-label`;
export const BWC_COUNTER_PLUS_TAG = `${BWC_COUNTER_TAG}-plus-button`;

export function parseCounterValue(raw: unknown): number {
  const number =
    typeof raw === "number" ? raw : Number(typeof raw === "string" ? raw.trim() : Number.NaN);
  return Number.isFinite(number) ? Math.trunc(number) : 0;
}

type CounterContext = {
  count: Signal<number>;
  controlled: boolean;
  initialized: boolean;
  onChange: ((value: number) => void) | null;
};
const counterProperties = {
  value: "value",
  defaultValue: "default-value",
  onChange: null,
} as const;

export const BwcCounterElement = defineComponent<
  CounterContext,
  HTMLElement,
  typeof counterProperties
>(
  BWC_COUNTER_TAG,
  HTMLElement,
  counterProperties,
  (element, props, context, properties) => {
    const previous = context();
    // The context signal outlives each connection; only initialize state for the first connection.
    const state: CounterContext =
      "count" in previous
        ? previous
        : {
            count: signal(
              props.value() !== null
                ? parseCounterValue(props.value())
                : parseCounterValue(props.defaultValue()),
            ),
            controlled: props.value() !== null,
            initialized: false,
            onChange: null,
          };
    const { count } = state;
    context(state);

    properties.install({
      defaultValue: {
        get: () => parseCounterValue(props.defaultValue()),
        set: (value) => element.setAttribute("default-value", String(parseCounterValue(value))),
      },
      value: {
        get: () => count(),
        set: (value) => {
          state.controlled = true;
          element.setAttribute("value", String(parseCounterValue(value)));
        },
      },
      onChange: {
        get: () => state.onChange,
        set: (callback) => {
          state.onChange = callbackValue<number>(callback, "onChange");
        },
      },
    });

    const dispose = useEffects(() => {
      const raw = props.value();
      if (raw !== null) {
        state.controlled = true;
        count(parseCounterValue(raw));
      } else if (!state.initialized) {
        count(parseCounterValue(props.defaultValue()));
      } else if (state.controlled) {
        count(0);
      }
      state.initialized = true;
    });
    return { disconnect: dispose };
  },
  () => {
    const defineButton = (tag: "minus-button" | "plus-button", delta: number) => {
      const buttonProperties = {} as const;
      defineComponent<CounterContext, HTMLButtonElement, typeof buttonProperties>(
        tag,
        HTMLButtonElement,
        buttonProperties,
        (element, _props, context) => {
          const marker = delta < 0 ? "counter-minus-button" : "counter-plus-button";
          element.setAttribute("aria-label", delta < 0 ? "Decrement count" : "Increment count");
          const buttonText = delta < 0 ? "−" : "+";
          element.textContent = buttonText;
          queueMicrotask(() => {
            element.textContent = buttonText;
          });
          decorateButton(
            element,
            marker,
            delta < 0 ? BWC_COUNTER_MINUS_TAG : BWC_COUNTER_PLUS_TAG,
            element.className,
          );
          const click = () => {
            const state = context();
            const next = state.count() + delta;
            emit(
              element.closest(BWC_COUNTER_TAG) as HTMLElement,
              state.onChange,
              "change",
              "value",
              next,
            );
            if (!state.controlled) state.count(next);
          };
          element.addEventListener("click", click);
          return {
            attributeChanged(name) {
              if (name === "class")
                decorateButton(
                  element,
                  marker,
                  delta < 0 ? BWC_COUNTER_MINUS_TAG : BWC_COUNTER_PLUS_TAG,
                  element.className,
                );
            },
            disconnect: () => element.removeEventListener("click", click),
          };
        },
      );
    };

    defineButton("minus-button", -1);
    const labelProperties = {} as const;
    defineComponent<CounterContext, HTMLSpanElement, typeof labelProperties>(
      "label",
      HTMLSpanElement,
      labelProperties,
      (element, _props, context) => {
        element.setAttribute("aria-live", "polite");
        element.dataset.testid ||= BWC_COUNTER_LABEL_TAG;
        element.className = element.className
          ? `counter-label ${element.className}`
          : "counter-label";
        const dispose = useEffects(() => {
          element.textContent = String(context().count());
        });
        return { disconnect: dispose };
      },
    );
    defineButton("plus-button", 1);
  },
);
