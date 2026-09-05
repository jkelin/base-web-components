import { effect, effectScope, signal } from "alien-signals";

export type Signal<Value> = {
  (): Value;
  (value: Value): void;
};

export type PropSignal = Signal<string | null>;

export type ReflectedPropOptions<Value> = {
  attribute: string;
  defaultValue: Value;
  fromAttribute: (raw: string | null) => Value;
  fromProperty: (raw: unknown) => Value;
  toAttribute: (value: Value) => string | null;
  get?: (stored: Value) => Value;
  onSet?: (value: Value, commit: (value: Value) => void) => void;
};

export type PropertyPropOptions<Value> = {
  attribute: null;
  defaultValue: Value;
  fromProperty: (raw: unknown) => Value;
  get?: (stored: Value) => Value;
  onSet?: (value: Value, commit: (value: Value) => void) => void;
};

export type PropOptions<Value> = ReflectedPropOptions<Value> | PropertyPropOptions<Value>;

type AnySignal = Signal<unknown>;
type AnyOptions = PropOptions<unknown>;
type Prop = {
  attribute: string | null;
  reconciling?: boolean;
  dirty?: boolean;
  dispose?: () => void;
  lastAttribute: string | null;
  options?: AnyOptions;
  value: AnySignal;
};
type MountSetup = () => void | (() => void);
type PropContext = {
  host: HTMLElement;
  mounts: MountSetup[];
  mountDisposers: Array<() => void>;
  observer?: MutationObserver;
  props: Map<string, Prop>;
};

export type PropRender<Result> = {
  result: Result;
  reconnect: () => void;
  mount: () => void;
  dispose: () => void;
};

let currentContext: PropContext | undefined;

function validateName(name: string, typed: boolean): void {
  const valid = typed ? /^[a-z][A-Za-z0-9]*$/.test(name) : /^[a-z][a-z0-9-]*$/.test(name);
  if (!valid || (!typed && name.startsWith("on"))) {
    throw new TypeError("Invalid prop name.");
  }
}

function validateAttributeName(name: string): void {
  if (!/^[a-z][a-z0-9-]*$/.test(name) || name.startsWith("on")) {
    throw new TypeError("Invalid prop attribute.");
  }
}

function validateRaw(value: unknown): asserts value is string | null {
  if (value !== null && typeof value !== "string") {
    throw new TypeError("Prop must be a string or null.");
  }
}

function parseAttribute(prop: Prop, raw: string | null): unknown {
  if (!prop.options) return raw;
  if (prop.options.attribute === null) return prop.value();
  return prop.options.fromAttribute(raw);
}

function serialize(prop: Prop, value: unknown): string | null {
  if (!prop.options) {
    validateRaw(value);
    return value;
  }
  if (prop.options.attribute === null) return null;
  return prop.options.toAttribute(value);
}

function reflectProp(context: PropContext, prop: Prop, next: unknown): void {
  const attribute = prop.attribute;
  if (attribute === null) return;
  const serialized = serialize(prop, next);
  const host = context.host;
  if (host.getAttribute(attribute) !== serialized) {
    if (serialized === null) host.removeAttribute(attribute);
    else host.setAttribute(attribute, serialized);
  }
  prop.dirty = false;
  prop.lastAttribute = serialized;
}

function reconcile(context: PropContext): void {
  for (const prop of context.props.values()) {
    if (prop.attribute === null) continue;
    const attribute = context.host.getAttribute(prop.attribute);
    if (attribute !== prop.lastAttribute) {
      const next = parseAttribute(prop, attribute);
      prop.lastAttribute = attribute;
      prop.reconciling = true;
      try {
        prop.value(next);
      } finally {
        prop.reconciling = false;
      }
    }
  }
}

function stopProps(context: PropContext): void {
  context.observer?.disconnect();
  delete context.observer;
  let failed = false;
  let failure: unknown;
  for (const prop of context.props.values()) {
    const dispose = prop.dispose;
    delete prop.dispose;
    try {
      dispose?.();
    } catch (error) {
      if (!failed) {
        failed = true;
        failure = error;
      }
    }
  }
  try {
    reconcile(context);
  } catch (error) {
    if (!failed) {
      failed = true;
      failure = error;
    }
  }
  if (failed) throw failure;
}

function startProps(context: PropContext): void {
  const reflected = [...context.props.values()].filter((prop) => prop.attribute !== null);
  if (reflected.length === 0) return;

  try {
    reconcile(context);
    for (const prop of reflected) {
      if (prop.dirty) reflectProp(context, prop, prop.value());
      let initialized = false;
      prop.dispose = effect(() => {
        const next = prop.value();
        if (initialized && !prop.reconciling) reflectProp(context, prop, next);
      });
      initialized = true;
    }

    const observer = new MutationObserver(() => reconcile(context));
    observer.observe(context.host, {
      attributes: true,
      attributeFilter: reflected.map((prop) => prop.attribute!),
    });
    context.observer = observer;
  } catch (error) {
    try {
      stopProps(context);
    } catch {
      // Preserve the connection failure after exhausting cleanup.
    }
    throw error;
  }
}
function stopMounts(context: PropContext): void {
  const disposers = context.mountDisposers;
  context.mountDisposers = [];
  let failed = false;
  let failure: unknown;
  for (let index = disposers.length - 1; index >= 0; index -= 1) {
    try {
      disposers[index]!();
    } catch (error) {
      if (!failed) {
        failed = true;
        failure = error;
      }
    }
  }
  if (failed) throw failure;
}

function disposeContext(context: PropContext): void {
  let failed = false;
  let failure: unknown;
  try {
    stopMounts(context);
  } catch (error) {
    failed = true;
    failure = error;
  }
  try {
    stopProps(context);
  } catch (error) {
    if (!failed) {
      failed = true;
      failure = error;
    }
  }
  if (failed) throw failure;
}

export function renderWithProps<Result>(
  host: HTMLElement,
  render: () => Result,
): PropRender<Result> {
  const previousContext = currentContext;
  const context: PropContext = { host, mounts: [], mountDisposers: [], props: new Map() };
  currentContext = context;

  try {
    const result = render();
    return {
      result,
      reconnect: () => {
        if (context.observer) reconcile(context);
        else startProps(context);
      },
      mount: () => {
        stopMounts(context);
        try {
          for (const setup of context.mounts) {
            let resourceDispose: (() => void) | undefined;
            let setupFailed = false;
            let setupError: unknown;
            const scopeDispose = effectScope(() => {
              try {
                resourceDispose = setup() || undefined;
              } catch (error) {
                setupFailed = true;
                setupError = error;
              }
            });
            if (setupFailed) {
              try {
                scopeDispose();
              } catch {
                // Preserve the setup failure after disposing its effect scope.
              }
              throw setupError;
            }
            context.mountDisposers.push(() => {
              try {
                resourceDispose?.();
              } finally {
                scopeDispose();
              }
            });
          }
        } catch (error) {
          try {
            stopMounts(context);
          } catch {
            // Preserve the setup failure after exhausting cleanup.
          }
          throw error;
        }
      },
      dispose: () => disposeContext(context),
    };
  } catch (error) {
    try {
      disposeContext(context);
    } catch {
      // Preserve the render failure after exhausting cleanup.
    }
    throw error;
  } finally {
    currentContext = previousContext;
  }
}

export function useHost<Element extends HTMLElement = HTMLElement>(): Element {
  if (!currentContext) throw new Error("useHost requires render.");
  return currentContext.host as Element;
}

export function onMount(setup: MountSetup): void {
  if (!currentContext) throw new Error("onMount requires render.");
  currentContext.mounts.push(setup);
}

export function useProp(name: string): PropSignal;
export function useProp<Value>(name: string, options: PropOptions<Value>): Signal<Value>;
export function useProp<Value>(
  name: string,
  options?: PropOptions<Value>,
): PropSignal | Signal<Value> {
  const context = currentContext;
  if (!context) throw new Error("useProp requires render.");
  validateName(name, options !== undefined);

  const attribute = options ? options.attribute : name;
  if (attribute !== null) validateAttributeName(attribute);

  const existing = context.props.get(name);
  if (existing) return existing.value as Signal<Value>;

  const host = context.host;
  const descriptor = Object.getOwnPropertyDescriptor(host, name);
  if (descriptor && (!descriptor.configurable || !("value" in descriptor))) {
    throw new TypeError("Prop cannot be replaced.");
  }

  const rawInitial = descriptor?.value;
  if (descriptor) {
    const hydrated = options ? options.fromProperty(rawInitial) : rawInitial;
    if (!options) validateRaw(hydrated);
  }
  let initial: unknown;
  if (!options) {
    initial = descriptor ? rawInitial : host.getAttribute(attribute as string);
  } else if (options.attribute === null) {
    initial = options.defaultValue;
  } else {
    initial = options.fromAttribute(host.getAttribute(options.attribute));
  }
  if (!options) validateRaw(initial);

  let prop: Prop;
  const baseSignal = signal(initial) as AnySignal;
  const validatedSignal = new Proxy(baseSignal, {
    apply(target, thisArgument, argumentsList) {
      if (argumentsList.length > 0) {
        const next = options ? options.fromProperty(argumentsList[0]) : argumentsList[0];
        if (!options) validateRaw(next);
        if (!prop.reconciling) prop.dirty = true;
        return Reflect.apply(target, thisArgument, [next]);
      }
      return Reflect.apply(target, thisArgument, argumentsList);
    },
  }) as AnySignal;
  prop = {
    attribute,
    lastAttribute: attribute === null ? null : host.getAttribute(attribute),
    value: validatedSignal,
  };
  if (options) prop.options = options as AnyOptions;
  context.props.set(name, prop);

  if (descriptor && !delete (host as unknown as Record<string, unknown>)[name]) {
    context.props.delete(name);
    throw new TypeError("Prop cannot be replaced.");
  }

  const commit = (value: unknown) => validatedSignal(value);
  Object.defineProperty(host, name, {
    configurable: true,
    enumerable: true,
    get: () => (options?.get ? options.get(validatedSignal() as Value) : validatedSignal()),
    set: (raw: unknown) => {
      const value = options ? options.fromProperty(raw) : raw;
      if (!options) validateRaw(value);
      if (options?.onSet) options.onSet(value as Value, commit as (value: Value) => void);
      else commit(value);
    },
  });
  if (descriptor) {
    (host as unknown as Record<string, unknown>)[name] = rawInitial;
  }

  return validatedSignal as PropSignal | Signal<Value>;
}
