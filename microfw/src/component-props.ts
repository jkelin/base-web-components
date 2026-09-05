import { effect, signal } from "alien-signals";

// Tuples remove repeated property keys from production output; named indices document each slot.
const PROP_VALUE = 0;
const PROP_ATTRIBUTE = 1;
const PROP_DISPOSE = 2;
const CONTEXT_HOST = 0;
const CONTEXT_PROPS = 1;
const CONTEXT_OBSERVER = 2;
const WRITE_ARGUMENT_INDEX = 0;

export type PropSignal = {
  (): string | null;
  (value: string | null): void;
};
// PROP_ATTRIBUTE is the last synchronized DOM value; a mismatch gives a detached/external edit precedence.
type Prop = [value: PropSignal, lastAttribute: string | null, dispose?: () => void];
type PropContext = [host: HTMLElement, props: Map<string, Prop>, observer?: MutationObserver];

export type PropRender<Result> = {
  result: Result;
  reconnect: () => void;
  dispose: () => void;
};

let currentContext: PropContext | undefined;
function validate(value: unknown): asserts value is string | null {
  // Empty strings and null are valid; every other non-string value is rejected.
  if (value !== null && typeof value !== "string") {
    throw new TypeError("Prop must be a string or null.");
  }
}

// A failed DOM mutation leaves the snapshot unchanged so setup cleanup or reconnect can retry.
function reflectProp(context: PropContext, name: string, prop: Prop, next: unknown): void {
  validate(next);
  if (context[CONTEXT_HOST].getAttribute(name) !== next) {
    if (next === null) {
      context[CONTEXT_HOST].removeAttribute(name);
    } else {
      context[CONTEXT_HOST].setAttribute(name, next);
    }
  }
  prop[PROP_ATTRIBUTE] = next;
}

function reconcile(context: PropContext): void {
  for (const [name, prop] of context[CONTEXT_PROPS]) {
    const attribute = context[CONTEXT_HOST].getAttribute(name);
    if (attribute !== prop[PROP_ATTRIBUTE]) {
      prop[PROP_ATTRIBUTE] = attribute;
      prop[PROP_VALUE](attribute);
    }
  }
}

function start(context: PropContext): void {
  if (context[CONTEXT_PROPS].size === 0) {
    return;
  }

  try {
    reconcile(context);
    for (const [name, prop] of context[CONTEXT_PROPS]) {
      // Complete fallible reflection before subscribing. The first effect run
      // only tracks the signal, so setup errors cannot leak a live effect.
      reflectProp(context, name, prop, prop[PROP_VALUE]());
      let initialized = false;
      prop[PROP_DISPOSE] = effect(() => {
        const next = prop[PROP_VALUE]();
        if (initialized) {
          reflectProp(context, name, prop, next);
        }
      });
      initialized = true;
    }

    const observer = new MutationObserver(() => reconcile(context));
    observer.observe(context[CONTEXT_HOST], {
      attributeFilter: [...context[CONTEXT_PROPS].keys()],
    });
    context[CONTEXT_OBSERVER] = observer;
  } catch (error) {
    stop(context);
    throw error;
  }
}

function stop(context: PropContext): void {
  context[CONTEXT_OBSERVER]?.disconnect();
  delete context[CONTEXT_OBSERVER];
  for (const prop of context[CONTEXT_PROPS].values()) {
    prop[PROP_DISPOSE]?.();
    delete prop[PROP_DISPOSE];
  }
  reconcile(context);
}

// Nested renders restore their parent context; failed renders dispose their subscriptions.
export function renderWithProps<Result>(
  host: HTMLElement,
  render: () => Result,
): PropRender<Result> {
  const previousContext = currentContext;
  const context: PropContext = [host, new Map()];
  currentContext = context;

  try {
    const result = render();
    return {
      result,
      reconnect: () => {
        if (context[CONTEXT_OBSERVER]) {
          reconcile(context);
        } else {
          start(context);
        }
      },
      dispose: () => stop(context),
    };
  } catch (error) {
    stop(context);
    throw error;
  } finally {
    currentContext = previousContext;
  }
}

// Missing attributes are null; empty attributes are "". Repeated use returns the same signal.
export function useProp(name: string): PropSignal {
  const context = currentContext;
  if (!context) {
    throw new Error("useProp requires render.");
  }
  if (!/^[a-z][a-z0-9-]*$/.test(name) || name.startsWith("on")) {
    throw new TypeError("Invalid prop name.");
  }

  const existing = context[CONTEXT_PROPS].get(name);
  if (existing) {
    return existing[PROP_VALUE];
  }

  const host = context[CONTEXT_HOST];
  const descriptor = Object.getOwnPropertyDescriptor(host, name);
  if (descriptor && (!descriptor.configurable || !("value" in descriptor))) {
    throw new TypeError("Prop cannot be replaced.");
  }
  const attribute = host.getAttribute(name);
  const initial: unknown = descriptor ? descriptor.value : attribute;
  validate(initial);

  // A Proxy preserves alien-signals identity for isSignal(). Calls with arguments
  // validate the write, including explicit undefined, before state mutation.
  const value = new Proxy(signal<string | null>(initial), {
    apply(target, thisArgument, argumentsList) {
      if (argumentsList.length > 0) {
        validate(argumentsList[WRITE_ARGUMENT_INDEX]);
      }
      return Reflect.apply(target, thisArgument, argumentsList);
    },
  }) as PropSignal;
  const prop: Prop = [value, attribute];
  context[CONTEXT_PROPS].set(name, prop);
  Object.defineProperty(host, name, {
    configurable: true,
    enumerable: true,
    get: value,
    set: value,
  });

  return value;
}
