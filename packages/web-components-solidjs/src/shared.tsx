import { createEffect, onCleanup } from "solid-js";
import { noShadowDOM } from "solid-element";

export type ChangeCallback<T> = ((value: T) => void) | null;

export interface SolidElementHost extends HTMLElement {
  addPropertyChangedCallback(callback: (name: string, value: unknown) => void): void;
  addReleaseCallback(callback: () => void): void;
}

let id = 0;
export const nextId = (tag: string): string => `${tag}-${++id}`;
export const boolAttr = (element: Element, name: string): boolean => element.hasAttribute(name);

export function emit<T>(
  host: HTMLElement,
  callback: ChangeCallback<T> | undefined,
  eventName: string,
  key: string,
  value: T,
): void {
  callback?.(value);
  host.dispatchEvent(
    new CustomEvent(eventName, { bubbles: true, composed: true, detail: { [key]: value } }),
  );
}

// Empty attributes mean no selection; malformed arrays fail at the public boundary.
export function parseJsonStrings(raw: unknown, name: string): string[] {
  let value = raw;
  if (typeof raw === "string") {
    if (!raw) return [];
    try {
      value = JSON.parse(raw);
    } catch {
      throw new TypeError(`${name} must be a JSON string array`);
    }
  }
  if (value == null) return [];
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string" || !item))
    throw new TypeError(`${name} must be a JSON string array`);
  return [...value];
}

// NaN and infinities are invalid public state even though Number accepts them.
export function finiteNumber(raw: unknown, name: string): number {
  const value = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(value)) throw new TypeError(`${name} must be finite`);
  return value;
}

export function enumValue<T extends string>(
  raw: unknown,
  values: readonly T[],
  fallback: T,
  name: string,
): T {
  if (raw == null || raw === "") return fallback;
  if (typeof raw !== "string" || !values.includes(raw as T))
    throw new TypeError(`${name} must be one of ${values.join(", ")}`);
  return raw as T;
}

/** Normalize presence attributes to boolean properties after solid-element maps them. */
export function initializeBooleanProps(
  host: SolidElementHost,
  attributes: Record<string, string>,
): void {
  const target = host as unknown as Record<string, unknown>;
  for (const [property, attribute] of Object.entries(attributes))
    target[property] = host.hasAttribute(attribute);
}
/** Select light DOM before solid-element first reads renderRoot. */
export function useLightDom(): void {
  noShadowDOM();
}

/** solid-element clears renderRoot on release; retain consumer-authored light-DOM nodes. */
export function preserveChildren(
  host: SolidElementHost,
  children: () => readonly Node[] = () => [...host.childNodes],
): void {
  let saved: readonly Node[] = [];
  host.addReleaseCallback(() => {
    saved = children();
  });
  onCleanup(() => host.append(...saved));
}

/** Observe only authored structure/state and disconnect with the Solid owner. */
export function watchChildren(host: HTMLElement, sync: () => void): void {
  let active = true;
  const observer = new MutationObserver(sync);
  observer.observe(host, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["value", "disabled"],
  });
  queueMicrotask(() => {
    if (active && host.isConnected) sync();
  });
  onCleanup(() => {
    active = false;
    observer.disconnect();
  });
}

interface ControlProps {
  hostClass?: string;
  disabled?: boolean;
}

/** Render a control while adopting parser-late authored children exactly once. */
export function createControl<K extends "button" | "dialog" | "div">(
  host: SolidElementHost,
  props: ControlProps,
  kind: K,
  marker: string,
  defaultText = "",
): HTMLElementTagNameMap[K] {
  useLightDom();
  const control = document.createElement(kind);
  const authored = new Set<Node>(host.childNodes);
  initializeBooleanProps(host, { disabled: "disabled" });
  let fallback: Text | null = null;

  if (kind === "button") (control as HTMLButtonElement).type = "button";
  control.append(...authored);
  if (!authored.size && defaultText) {
    fallback = document.createTextNode(defaultText);
    control.append(fallback);
  }

  const adopt = (): void => {
    const added = [...host.childNodes].filter((node) => node !== control);
    if (!added.length) return;
    fallback?.remove();
    fallback = null;
    for (const node of added) authored.add(node);
    control.append(...added);
  };
  const observer = new MutationObserver(adopt);
  observer.observe(host, { childList: true });
  onCleanup(() => observer.disconnect());
  preserveChildren(host, () => [...authored]);
  createEffect(() => {
    const className = props.hostClass;
    control.className = className ? `${marker} ${className}` : marker;
    control.dataset.testid = host.localName;
    if (control instanceof HTMLButtonElement) {
      const disabled = Boolean(props.disabled) || host.hasAttribute("disabled");
      control.disabled = disabled;
      control.style.cursor = disabled ? "not-allowed" : "pointer";
      control.style.userSelect = "none";
    }
  });

  return control;
}

export const classProp = {
  value: "",
  attribute: "class",
  notify: false,
  reflect: false,
  parse: false,
} as const;

export const booleanProp = (attribute: string, reflect = true) =>
  ({
    value: false,
    attribute,
    notify: false,
    reflect,
    parse: false,
  }) as const;

export const reflectedProp = <T,>(value: T, attribute: string) =>
  ({
    value,
    attribute,
    notify: false,
    reflect: false,
    parse: typeof value !== "string",
  }) as const;
