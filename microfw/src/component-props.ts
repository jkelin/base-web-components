import { effect, signal } from "alien-signals";

export type PropSignal = {
  (): string | null;
  (value: string | null): void;
};
type PropContext = {
  host: HTMLElement;
  props: Map<string, PropSignal>;
  cleanup: (() => void)[];
};

let currentContext: PropContext | undefined;

// Nested renders restore their parent context; failed renders dispose their subscriptions.
export function renderWithProps<Result>(host: HTMLElement, render: () => Result): Result {
  const previousContext = currentContext;
  const context: PropContext = { host, props: new Map(), cleanup: [] };
  currentContext = context;

  try {
    return render();
  } catch (error) {
    for (const dispose of context.cleanup) {
      dispose();
    }
    throw error;
  } finally {
    currentContext = previousContext;
  }
}

// Missing attributes are null; empty attributes are "". Repeated use returns the same signal.
export function useProp(name: string): PropSignal {
  const context = currentContext;
  if (!context) {
    throw new Error("useProp must be called synchronously inside a component render.");
  }
  if (!/^[a-z][a-z0-9-]*$/.test(name) || name.startsWith("on")) {
    throw new TypeError(`Invalid component prop name "${name}".`);
  }

  const existing = context.props.get(name);
  if (existing) {
    return existing;
  }

  const { host } = context;
  const descriptor = Object.getOwnPropertyDescriptor(host, name);
  if (descriptor && (!descriptor.configurable || !("value" in descriptor))) {
    throw new TypeError(`Cannot replace component property "${name}".`);
  }
  const initial: unknown = descriptor ? descriptor.value : host.getAttribute(name);
  if (initial !== null && typeof initial !== "string") {
    throw new TypeError(`Component prop "${name}" requires a string or null.`);
  }

  const value = signal<string | null>(initial);
  context.props.set(name, value);
  Object.defineProperty(host, name, {
    configurable: true,
    enumerable: true,
    get: value,
    set: (next: unknown) => {
      if (next !== null && typeof next !== "string") {
        throw new TypeError(`Component prop "${name}" requires a string or null.`);
      }
      value(next);
    },
  });

  const disposeEffect = effect(() => {
    const next = value();
    if (next !== null && typeof next !== "string") {
      throw new TypeError(`Component prop "${name}" requires a string or null.`);
    }
    if (host.getAttribute(name) === next) {
      return;
    }
    if (next === null) {
      host.removeAttribute(name);
    } else {
      host.setAttribute(name, next);
    }
  });
  context.cleanup.push(disposeEffect);

  // Observe only this host, including while detached. Read final values to avoid feedback loops.
  const observer = new MutationObserver(() => {
    value(host.getAttribute(name));
  });
  observer.observe(host, { attributes: true, attributeFilter: [name] });
  context.cleanup.push(() => observer.disconnect());

  return value;
}
