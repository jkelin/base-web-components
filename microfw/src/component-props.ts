import { effect, signal } from "alien-signals";

export type PropSignal = {
  (): string | null;
  (value: string | null): void;
};
type Prop = [value: PropSignal, attribute: string | null, dispose?: () => void];
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

function reconcile(context: PropContext): void {
  for (const [name, prop] of context[1]) {
    const attribute = context[0].getAttribute(name);
    if (attribute !== prop[1]) {
      prop[1] = attribute;
      prop[0](attribute);
    }
  }
}

function start(context: PropContext): void {
  if (context[1].size === 0) {
    return;
  }

  try {
    reconcile(context);
    for (const [name, prop] of context[1]) {
      prop[2] = effect(() => {
        const next = prop[0]();
        validate(next);
        if (context[0].getAttribute(name) !== next) {
          if (next === null) {
            context[0].removeAttribute(name);
          } else {
            context[0].setAttribute(name, next);
          }
        }
        prop[1] = next;
      });
    }

    const observer = new MutationObserver(() => reconcile(context));
    observer.observe(context[0], {
      attributeFilter: [...context[1].keys()],
    });
    context[2] = observer;
  } catch (error) {
    stop(context);
    throw error;
  }
}

function stop(context: PropContext): void {
  context[2]?.disconnect();
  delete context[2];
  for (const prop of context[1].values()) {
    prop[2]?.();
    delete prop[2];
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
        if (context[2]) {
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

  const existing = context[1].get(name);
  if (existing) {
    return existing[0];
  }

  const host = context[0];
  const descriptor = Object.getOwnPropertyDescriptor(host, name);
  if (descriptor && (!descriptor.configurable || !("value" in descriptor))) {
    throw new TypeError("Prop cannot be replaced.");
  }
  const attribute = host.getAttribute(name);
  const initial: unknown = descriptor ? descriptor.value : attribute;
  validate(initial);

  const value = signal<string | null>(initial);
  const prop: Prop = [value, attribute];
  context[1].set(name, prop);
  Object.defineProperty(host, name, {
    configurable: true,
    enumerable: true,
    get: value,
    set: (next: unknown) => {
      validate(next);
      value(next);
    },
  });

  return value;
}
