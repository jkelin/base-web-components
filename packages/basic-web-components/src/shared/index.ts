import { effect, signal } from "alien-signals";

let currentParent: string | undefined;

export type Signal<Value> = {
  (): Value;
  (value: Value): void;
};

export type ComponentLifecycle = {
  attributeChanged?: (name: string) => void;
  disconnect?: () => void;
};

export type ComponentConstructor<Element extends HTMLElement> = CustomElementConstructor &
  (new () => Element);

type PropertyDeclarations = Readonly<Record<string, string | null>>;

type ObservedSignals<Declarations extends PropertyDeclarations> = {
  [Name in keyof Declarations as Declarations[Name] extends string ? Name : never]: Signal<
    string | null
  >;
};

type RuntimeDescriptor = {
  get: () => unknown;
  set: (value: unknown) => void;
};

type RuntimeDescriptors<Declarations extends PropertyDeclarations> = {
  [Name in keyof Declarations]: RuntimeDescriptor;
};

export type PropertyRuntime<Declarations extends PropertyDeclarations> = {
  install: (descriptors: RuntimeDescriptors<Declarations>) => void;
};

export function defineComponent<
  Context,
  Element extends HTMLElement,
  const Declarations extends PropertyDeclarations,
>(
  tag: string,
  BaseElement: new () => Element,
  declarations: Declarations,
  render: (
    element: Element,
    props: ObservedSignals<Declarations>,
    context: Signal<Context>,
    properties: PropertyRuntime<Declarations>,
  ) => ComponentLifecycle | void,
  defineChildren?: () => void,
  options?: { contextParent?: string; flat?: boolean },
): ComponentConstructor<Element> {
  const definitionParent = currentParent;
  const contextParent = options?.contextParent ?? definitionParent;
  const ElementBase = BaseElement as new () => HTMLElement;
  const entries = Object.entries(declarations);
  const observedEntries = entries.filter((entry): entry is [string, string] => entry[1] !== null);
  const observedAttributes = ["class", ...observedEntries.map(([, name]) => name)];
  const propertyByAttribute = Object.fromEntries(
    observedEntries.map(([property, name]) => [name, property]),
  ) as Record<string, string>;

  const ComponentElement = class extends ElementBase {
    static observedAttributes = observedAttributes;

    readonly props = Object.fromEntries(
      observedEntries.map(([property, attribute]) => [
        property,
        signal(this.getAttribute(attribute)),
      ]),
    ) as ObservedSignals<Declarations>;
    context?: Signal<Context>;
    #captured: Array<readonly [string, unknown]> = [];
    #installed = false;
    #lifecycle: ComponentLifecycle | undefined;

    constructor() {
      super();
      const target = this as unknown as Record<string, unknown>;
      // Upgrade candidates can shadow accessors. Capture then delete every declared public property.
      for (const [name] of entries) {
        if (!Object.prototype.hasOwnProperty.call(this, name)) continue;
        this.#captured.push([name, target[name]]);
        if (!delete target[name]) throw new TypeError(`Could not hydrate ${tag}.${name}`);
      }
    }

    connectedCallback(): void {
      if (this.#lifecycle) return;
      const target = this as unknown as Record<string, unknown>;
      if (this.#installed) {
        // Reconnects keep callback-only values; attribute-backed state is rebuilt from attributes.
        for (const [name, attribute] of entries) {
          if (!Object.prototype.hasOwnProperty.call(this, name)) continue;
          if (attribute === null) this.#captured.push([name, target[name]]);
          if (!delete target[name]) throw new TypeError(`Could not reconnect ${tag}.${name}`);
        }
      } else {
        // Defined-but-disconnected elements can receive own properties after construction.
        for (const [name] of entries) {
          if (!Object.prototype.hasOwnProperty.call(this, name)) continue;
          this.#captured.push([name, target[name]]);
          if (!delete target[name]) throw new TypeError(`Could not hydrate ${tag}.${name}`);
        }
      }
      const parentElement = contextParent
        ? (this.closest(contextParent) as (HTMLElement & { context?: Signal<Context> }) | null)
        : null;
      if (contextParent && !parentElement) {
        throw new Error(`Could not find ${contextParent} in parent chain of ${this.localName}`);
      }
      if (parentElement && !parentElement.context) {
        // Some custom-element registries connect descendants first; initialize the connected parent once.
        const parentCallback = (parentElement as HTMLElement & { connectedCallback?: () => void })
          .connectedCallback;
        parentCallback?.call(parentElement);
      }
      // Descendants may connect first; seed one signal on the parent so both upgrade orders share it.
      if (parentElement) parentElement.context ??= signal({} as Context);
      this.context ??= parentElement?.context ?? signal({} as Context);
      let installedDuringRender = false;
      const properties: PropertyRuntime<Declarations> = {
        install: (descriptors) => {
          if (installedDuringRender) throw new TypeError(`${tag} properties were installed twice`);
          const descriptorNames = Object.keys(descriptors);
          const declaredNames = entries.map(([name]) => name);
          if (
            descriptorNames.length !== declaredNames.length ||
            declaredNames.some((name) => !Object.prototype.hasOwnProperty.call(descriptors, name))
          ) {
            throw new TypeError(`${tag} must install every declared property exactly once`);
          }
          Object.defineProperties(
            this,
            Object.fromEntries(
              Object.entries(descriptors).map(([name, descriptor]) => [
                name,
                { ...descriptor, configurable: true, enumerable: true },
              ]),
            ),
          );
          installedDuringRender = true;
          this.#installed = true;
          const target = this as unknown as Record<string, unknown>;
          // Declaration order is stable; restoring through setters preserves public semantics.
          for (const [name, value] of this.#captured) target[name] = value;
          this.#captured = [];
        },
      };
      this.#lifecycle =
        render(this as unknown as Element, this.props, this.context, properties) ?? {};
      if (entries.length > 0 && !this.#installed) {
        throw new TypeError(`${tag} did not install its declared properties`);
      }
    }
    disconnectedCallback(): void {
      this.#lifecycle?.disconnect?.();
      this.#lifecycle = undefined;
    }

    attributeChangedCallback(
      attributeName: string,
      _previousValue: string | null,
      nextValue: string | null,
    ): void {
      const property = propertyByAttribute[attributeName];
      if (property) {
        (this.props as Record<string, Signal<string | null>>)[property]?.(nextValue);
      }
      this.#lifecycle?.attributeChanged?.(attributeName);
    }
  };

  const name = options?.flat || !definitionParent ? tag : `${definitionParent}-${tag}`;
  const basePrototype = BaseElement.prototype;
  const nativeTag =
    basePrototype === HTMLButtonElement.prototype
      ? "button"
      : basePrototype === HTMLSpanElement.prototype
        ? "span"
        : basePrototype === HTMLDialogElement.prototype
          ? "dialog"
          : basePrototype === HTMLDivElement.prototype
            ? "div"
            : basePrototype === HTMLInputElement.prototype
              ? "input"
              : undefined;

  if (basePrototype !== HTMLElement.prototype && !nativeTag) {
    throw new TypeError(`Unsupported base element ${BaseElement.name}`);
  }
  if (!customElements.get(name)) {
    if (nativeTag) customElements.define(name, ComponentElement, { extends: nativeTag });
    else customElements.define(name, ComponentElement);
  }

  currentParent = name;
  defineChildren?.();
  currentParent = definitionParent;
  return ComponentElement as unknown as ComponentConstructor<Element>;
}

export type ChangeCallback<Value> = ((value: Value) => void) | null;

export const nextId = (() => {
  let value = 0;
  return (tag: string) => `${tag}-${++value}`;
})();

export function boolAttr(element: Element, name: string): boolean {
  return element.hasAttribute(name);
}

export function emit<Value>(
  host: HTMLElement,
  callback: ChangeCallback<Value> | undefined,
  eventName: string,
  key: string,
  value: Value,
): void {
  callback?.(value);
  host.dispatchEvent(
    new CustomEvent(eventName, { bubbles: true, composed: true, detail: { [key]: value } }),
  );
}

export function parseJsonStrings(raw: string | null, name: string): string[] {
  if (raw === null || raw === "") return [];
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    throw new TypeError(`${name} must be a JSON string array`);
  }
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string" || !item)) {
    throw new TypeError(`${name} must be a JSON string array`);
  }
  return value;
}

export function finiteNumber(raw: unknown, name: string): number {
  const value = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(value)) throw new TypeError(`${name} must be finite`);
  return value;
}

export function enumValue<Value extends string>(
  raw: string | null,
  values: readonly Value[],
  fallback: Value,
  name: string,
): Value {
  if (raw === null || raw === "") return fallback;
  if (!values.includes(raw as Value)) {
    throw new TypeError(`${name} must be one of ${values.join(", ")}`);
  }
  return raw as Value;
}
export function booleanValue(raw: unknown, name: string): boolean {
  if (typeof raw !== "boolean") throw new TypeError(`${name} must be boolean`);
  return raw;
}

export function callbackValue<Value>(raw: unknown, name: string): ChangeCallback<Value> {
  if (raw !== null && typeof raw !== "function") {
    throw new TypeError(`${name} must be a function or null`);
  }
  return raw as ChangeCallback<Value>;
}

export function observeChildren(host: HTMLElement, sync: () => void): MutationObserver {
  const observer = new MutationObserver(sync);
  observer.observe(host, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["class", "value", "disabled", "data-item-disabled"],
  });
  return observer;
}

function classTokens(...values: Array<string | null | undefined>): string[] {
  return values.flatMap((value) => value?.split(/\s+/).filter(Boolean) ?? []);
}

export function partClassName(
  marker: string,
  authorClass: string,
  partClass?: string | null,
): string {
  // Duplicate tokens and marker-like author input collapse without changing first-seen order.
  return [...new Set([marker, ...classTokens(authorClass, partClass)].filter(Boolean))].join(" ");
}

export function createPartClassController(
  element: HTMLElement,
  marker: string,
  initialPartClass?: string | null,
): (partClass?: string | null) => void {
  let previousPartClass = initialPartClass ?? "";
  const generatedTokens = new Set([marker, ...classTokens(previousPartClass)]);
  let authorClass = classTokens(element.className)
    .filter((name) => !generatedTokens.has(name))
    .join(" ");
  let appliedClass = "";

  const apply = (partClass?: string | null) => {
    // A differing DOM class is an author update; remove only tokens generated last time.
    if (appliedClass && element.className !== appliedClass) {
      const previousTokens = new Set([marker, ...classTokens(previousPartClass)]);
      authorClass = classTokens(element.className)
        .filter((name) => !previousTokens.has(name))
        .join(" ");
    }
    previousPartClass = partClass ?? "";
    appliedClass = partClassName(marker, authorClass, previousPartClass);
    if (element.className !== appliedClass) element.className = appliedClass;
  };
  apply(initialPartClass);
  return apply;
}

export function decorateButton(
  button: HTMLButtonElement,
  marker: string,
  testId: string,
  forwardedClass: string,
): void {
  const className = partClassName(marker, forwardedClass);
  if (button.className !== className) button.className = className;
  button.dataset.testid ||= testId;
  button.type = "button";
  button.style.userSelect = "none";
  button.style.cursor = button.disabled ? "not-allowed" : "pointer";
}

export function useEffects(...callbacks: Array<() => void>): () => void {
  const disposers = callbacks.map((callback) => effect(callback));
  return () => {
    for (const dispose of disposers) dispose();
  };
}
