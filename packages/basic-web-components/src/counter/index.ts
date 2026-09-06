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
  setAttributeValue,
  type ChangeCallback,
} from "../shared";

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

export const BwcCounterElement = defineComponent<CounterApi>("bwc-counter", () => {
  const host = useHost<CounterApi>();
  const state: CounterState = {
    controlled: false,
    count: signal(0),
    initialized: false,
  };
  const parts = signal<{
    decrement: HTMLButtonElement;
    increment: HTMLButtonElement;
    output: HTMLOutputElement;
  } | null>(null);
  const topologyRevision = signal(0);
  const decorationRevision = signal(0);
  let topologyVersion = 0;
  let decorationVersion = 0;
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
    let stopTopology: (() => void) | undefined;
    let stopDecoration: (() => void) | undefined;
    let stopContent: (() => void) | undefined;
    let stopControl: (() => void) | undefined;
    let stopObserver: (() => void) | undefined;
    const click = (event: MouseEvent) => {
      const currentParts = parts();
      if (!currentParts) return;
      const path = event.composedPath();
      const delta = path.includes(currentParts.decrement)
        ? -1
        : path.includes(currentParts.increment)
          ? 1
          : 0;
      if (delta === 0) return;
      const next = state.count() + delta;
      emit(host, onChange(), "change", "value", next);
      if (!state.controlled) state.count(next);
    };
    const cleanup = () => {
      host.removeEventListener("click", click);
      stopObserver?.();
      stopControl?.();
      stopContent?.();
      stopDecoration?.();
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
                (record.type === "childList" && record.target === host) ||
                record.attributeName === "slot",
            )
          ) {
            topologyRevision(++topologyVersion);
          } else {
            decorationRevision(++decorationVersion);
          }
        },
        ["class", "disabled", "slot"],
      );
      stopTopology = effect(() => {
        topologyRevision();
        parts(null);
        const decrement = requireSlottedElement(host, "decrement", HTMLButtonElement);
        const output = requireSlottedElement(host, "value", HTMLOutputElement);
        const increment = requireSlottedElement(host, "increment", HTMLButtonElement);
        parts({ decrement, increment, output });
      });
      stopDecoration = effect(() => {
        decorationRevision();
        const currentParts = parts();
        if (!currentParts) return;
        const { decrement, increment, output } = currentParts;
        setAttributeValue(decrement, "aria-label", "Decrement count");
        decorateButton(decrement, "counter-minus-button", DECREMENT_TEST_ID, decrement.className);
        setAttributeValue(output, "aria-live", "polite");
        output.dataset.testid ||= OUTPUT_TEST_ID;
        const outputClass = partClassName("counter-label", output.className);
        if (output.className !== outputClass) output.className = outputClass;
        setAttributeValue(increment, "aria-label", "Increment count");
        decorateButton(increment, "counter-plus-button", INCREMENT_TEST_ID, increment.className);
      });
      stopContent = effect(() => {
        const output = parts()?.output;
        const text = String(state.count());
        if (output && output.textContent !== text) output.textContent = text;
      });
      stopControl = effect(() => {
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
      return cleanup;
    } catch (error) {
      cleanup();
      throw error;
    }
  });

  return html`<slot name="decrement"></slot><slot name="value"></slot
    ><slot name="increment"></slot>`;
});
