import {
  defineComponent,
  effect,
  html,
  onMount,
  signal,
  useHost,
  useProp,
  type Signal,
} from "microfw";
import {
  callbackProp,
  decorateButton,
  emit,
  observeSlotSubtree,
  partClassName,
  requireSlottedElement,
  type ChangeCallback,
} from "../shared";

export const BWC_COUNTER_TAG = "bwc-counter";
const DECREMENT_TEST_ID = "bwc-counter-minus-button";
const OUTPUT_TEST_ID = "bwc-counter-label";
const INCREMENT_TEST_ID = "bwc-counter-plus-button";

export function parseCounterValue(raw: unknown): number {
  const number =
    typeof raw === "number" ? raw : Number(typeof raw === "string" ? raw.trim() : Number.NaN);
  return Number.isFinite(number) ? Math.trunc(number) : 0;
}

type CounterApi = HTMLElement & {
  defaultValue: number;
  onChange: ChangeCallback<number>;
  value: number;
};

type CounterState = {
  controlled: boolean;
  count: Signal<number>;
  initialized: boolean;
};

const counterValueCodec = {
  defaultValue: 0,
  fromAttribute: parseCounterValue,
  fromProperty: parseCounterValue,
  toAttribute: String,
};

export const BwcCounterElement = defineComponent<CounterApi>(BWC_COUNTER_TAG, () => {
  const host = useHost<CounterApi>();
  const state: CounterState = {
    controlled: false,
    count: signal(0),
    initialized: false,
  };
  const defaultValue = useProp("defaultValue", {
    ...counterValueCodec,
    attribute: "default-value",
  });
  const value = useProp("value", {
    ...counterValueCodec,
    attribute: "value",
    get: () => state.count(),
    onSet(next, commit) {
      state.controlled = true;
      state.count(next);
      commit(next);
    },
  });
  const onChange = useProp("onChange", callbackProp<number>("onChange"));

  if (!state.controlled) {
    state.controlled = host.hasAttribute("value");
    state.count(state.controlled ? value() : defaultValue());
  }

  onMount(() => {
    let decrement: HTMLButtonElement | undefined;
    let increment: HTMLButtonElement | undefined;
    let output: HTMLOutputElement | undefined;
    const click = (event: MouseEvent) => {
      const path = event.composedPath();
      const delta =
        decrement && path.includes(decrement) ? -1 : increment && path.includes(increment) ? 1 : 0;
      if (delta === 0) return;
      const next = state.count() + delta;
      emit(host, onChange(), "change", "value", next);
      if (!state.controlled) state.count(next);
    };
    const sync = () => {
      decrement = undefined;
      output = undefined;
      increment = undefined;

      const nextDecrement = requireSlottedElement(host, "decrement", HTMLButtonElement);
      const nextOutput = requireSlottedElement(host, "value", HTMLOutputElement);
      const nextIncrement = requireSlottedElement(host, "increment", HTMLButtonElement);

      decrement = nextDecrement;
      output = nextOutput;
      increment = nextIncrement;

      nextDecrement.setAttribute("aria-label", "Decrement count");
      decorateButton(
        nextDecrement,
        "counter-minus-button",
        DECREMENT_TEST_ID,
        nextDecrement.className,
      );
      nextOutput.setAttribute("aria-live", "polite");
      nextOutput.dataset.testid ||= OUTPUT_TEST_ID;
      nextOutput.className = partClassName("counter-label", nextOutput.className);
      nextIncrement.setAttribute("aria-label", "Increment count");
      decorateButton(
        nextIncrement,
        "counter-plus-button",
        INCREMENT_TEST_ID,
        nextIncrement.className,
      );

      const text = String(state.count());
      if (nextOutput.textContent !== text) nextOutput.textContent = text;
    };

    const disposeObserver = observeSlotSubtree(host, sync, ["class", "disabled", "slot"]);
    effect(() => {
      const text = String(state.count());
      if (output && output.textContent !== text) output.textContent = text;
    });
    effect(() => {
      const next = value();
      const hasValue = host.hasAttribute("value");
      if (hasValue) {
        state.controlled = true;
        state.count(next);
      } else if (state.initialized && state.controlled) {
        state.controlled = false;
        state.count(0);
      } else if (!state.initialized && !state.controlled) {
        state.count(defaultValue());
      }
      state.initialized = true;
    });

    host.addEventListener("click", click);
    return () => {
      host.removeEventListener("click", click);
      disposeObserver();
    };
  });

  return html`<slot name="decrement"></slot><slot name="value"></slot
    ><slot name="increment"></slot>`;
});
