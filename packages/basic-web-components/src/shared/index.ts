import type { PropOptions } from "microfw";

export type ChangeCallback<Value> = ((value: Value) => void) | null;

type ElementConstructor<ElementType extends Element> = {
  new (): ElementType;
  readonly prototype: ElementType;
};

export const nextId = (() => {
  let value = 0;
  return (tag: string) => `${tag}-${++value}`;
})();

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

export function stringValue(raw: unknown, name: string): string {
  if (typeof raw !== "string") throw new TypeError(`${name} must be string`);
  return raw;
}

export function callbackValue<Value>(raw: unknown, name: string): ChangeCallback<Value> {
  if (raw !== null && typeof raw !== "function") {
    throw new TypeError(`${name} must be a function or null`);
  }
  return raw as ChangeCallback<Value>;
}

export function booleanProp(attribute: string): PropOptions<boolean> & { attribute: string } {
  return {
    attribute,
    defaultValue: false,
    fromAttribute: (raw: string | null) => raw !== null,
    fromProperty: (raw: unknown) => booleanValue(raw, attribute),
    toAttribute: (value: boolean) => (value ? "" : null),
  };
}

export function stringProp(
  attribute: string,
  defaultValue = "",
): PropOptions<string> & { attribute: string } {
  return {
    attribute,
    defaultValue,
    fromAttribute: (raw: string | null) => raw ?? defaultValue,
    fromProperty: (raw: unknown) => stringValue(raw, attribute),
    toAttribute: (value: string) => value,
  };
}

export function numberProp(
  attribute: string,
  defaultValue = 0,
): PropOptions<number> & { attribute: string } {
  return {
    attribute,
    defaultValue,
    fromAttribute: (raw: string | null) =>
      raw === null || raw === "" ? defaultValue : finiteNumber(raw, attribute),
    fromProperty: (raw: unknown) => finiteNumber(raw, attribute),
    toAttribute: String,
  };
}

export function enumProp<Value extends string>(
  attribute: string,
  values: readonly Value[],
  fallback: Value,
): PropOptions<Value> & { attribute: string } {
  return {
    attribute,
    defaultValue: fallback,
    fromAttribute: (raw: string | null) => enumValue(raw, values, fallback, attribute),
    fromProperty: (raw: unknown) => {
      if (typeof raw !== "string") {
        throw new TypeError(`${attribute} must be one of ${values.join(", ")}`);
      }
      return enumValue(raw, values, fallback, attribute);
    },
    toAttribute: (value: Value) => value,
  };
}

export function callbackProp<Value>(
  name: string,
): PropOptions<ChangeCallback<Value>> & { attribute: null } {
  return {
    attribute: null,
    defaultValue: null,
    fromProperty: (raw: unknown) => callbackValue<Value>(raw, name),
  };
}

function directSlottedChildren(host: HTMLElement, slot: string): Element[] {
  return [...host.children].filter((element) => element.getAttribute("slot") === slot);
}

export function slottedElements<ElementType extends Element>(
  host: HTMLElement,
  slot: string,
  Constructor: ElementConstructor<ElementType>,
): ElementType[] {
  return directSlottedChildren(host, slot).filter(
    (element): element is ElementType => element instanceof Constructor,
  );
}

export function requireSlottedElement<ElementType extends Element>(
  host: HTMLElement,
  slot: string,
  Constructor: ElementConstructor<ElementType>,
): ElementType {
  const elements = directSlottedChildren(host, slot);
  const tag = Constructor.name.replace(/^HTML|Element$/g, "").toLowerCase();
  if (elements.length !== 1) {
    throw new TypeError(`${host.localName} requires exactly one ${tag} in slot ${slot}`);
  }
  const element = elements[0]!;
  if (!(element instanceof Constructor)) {
    throw new TypeError(`${host.localName} slot ${slot} must be a ${tag}`);
  }
  return element as ElementType;
}

export function belongsToHost(target: Node, host: HTMLElement): boolean {
  let element = target instanceof Element ? target : target.parentElement;
  while (element && element !== host) {
    if (element.localName.includes("-") && element.shadowRoot) return false;
    element = element.parentElement;
  }
  return element === host;
}

export function observeSlotSubtree(
  host: HTMLElement,
  sync: () => void,
  attributeFilter?: string[],
): () => void {
  sync();

  let active = true;
  let pending = false;
  const observerOptions: MutationObserverInit = {
    attributes: true,
    childList: true,
    subtree: true,
  };
  if (attributeFilter) observerOptions.attributeFilter = attributeFilter;
  let observer: MutationObserver;
  const observe = () => observer.observe(host, observerOptions);
  const run = () => {
    observer.disconnect();
    try {
      sync();
    } finally {
      if (active) observe();
    }
  };
  const schedule = () => {
    if (!active || pending) return;
    pending = true;
    queueMicrotask(() => {
      pending = false;
      if (active) run();
    });
  };
  observer = new MutationObserver((records) => {
    if (records.some((record) => belongsToHost(record.target, host))) schedule();
  });
  observe();
  host.shadowRoot?.addEventListener("slotchange", schedule);

  return () => {
    active = false;
    observer.disconnect();
    host.shadowRoot?.removeEventListener("slotchange", schedule);
  };
}

function classTokens(...values: Array<string | null | undefined>): string[] {
  return values.flatMap((value) => value?.split(/\s+/).filter(Boolean) ?? []);
}

export function partClassName(
  marker: string,
  authorClass: string,
  partClass?: string | null,
): string {
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
  button.id ||= nextId(testId);
  button.type = "button";
  button.style.userSelect = "none";
  button.style.cursor = button.disabled ? "not-allowed" : "pointer";
}
