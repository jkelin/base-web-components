import { effect, signal } from "alien-signals";

export type PropSignal = {
  (): string | null;
  (value: string | null): void;
};
type Prop = {
  name: string;
  value: PropSignal;
  attribute: string | null;
  dispose?: () => void;
};
type PropContext = {
  host: HTMLElement;
  props: Map<string, Prop>;
  observer?: MutationObserver;
};

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
  for (const prop of context.props.values()) {
    const attribute = context.host.getAttribute(prop.name);
    if (attribute !== prop.attribute) {
      prop.attribute = attribute;
      prop.value(attribute);
    }
  }
}

function start(context: PropContext): void {
  if (context.props.size === 0) {
    return;
  }

  try {
    reconcile(context);
    for (const prop of context.props.values()) {
      validate(prop.value());
      prop.dispose = effect(() => {
        const next = prop.value();
        validate(next);
        if (context.host.getAttribute(prop.name) !== next) {
          if (next === null) {
            context.host.removeAttribute(prop.name);
          } else {
            context.host.setAttribute(prop.name, next);
          }
        }
        prop.attribute = next;
      });
    }

    const observer = new MutationObserver(() => reconcile(context));
    observer.observe(context.host, {
      attributes: true,
      attributeFilter: Array.from(context.props.keys()),
    });
    context.observer = observer;
  } catch (error) {
    stop(context);
    throw error;
  }
}

function stop(context: PropContext): void {
  context.observer?.disconnect();
  delete context.observer;
  for (const prop of context.props.values()) {
    prop.dispose?.();
    delete prop.dispose;
  }
  reconcile(context);
}

// Nested renders restore their parent context; failed renders dispose their subscriptions.
export function renderWithProps<Result>(
  host: HTMLElement,
  render: () => Result,
): PropRender<Result> {
  const previousContext = currentContext;
  const context: PropContext = { host, props: new Map() };
  currentContext = context;

  try {
    const result = render();
    return {
      result,
      reconnect: () => {
        if (context.observer) {
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

  const existing = context.props.get(name);
  if (existing) {
    return existing.value;
  }

  const { host } = context;
  const descriptor = Object.getOwnPropertyDescriptor(host, name);
  if (descriptor && (!descriptor.configurable || !("value" in descriptor))) {
    throw new TypeError("Prop cannot be replaced.");
  }
  const initial: unknown = descriptor ? descriptor.value : host.getAttribute(name);
  validate(initial);

  const value = signal<string | null>(initial);
  const prop: Prop = { name, value, attribute: host.getAttribute(name) };
  context.props.set(name, prop);
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
