import { c, useEffect, useHost, useState } from "atomico";

export type ChangeCallback<T> = ((value: T) => void) | null;

export const nextId = (() => {
  let value = 0;
  return (tag: string) => `${tag}-${++value}`;
})();

export function boolAttr(element: Element, name: string): boolean {
  return element.hasAttribute(name);
}

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

// Empty attributes initialize to an empty selection; malformed JSON fails instead of coercing.
export function parseJsonStrings(raw: string | null, name: string): string[] {
  if (raw === null || raw === "") return [];
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    throw new TypeError(`${name} must be a JSON string array`);
  }
  if (
    !Array.isArray(value) ||
    value.some((item) => typeof item !== "string" || item.length === 0)
  ) {
    throw new TypeError(`${name} must be a JSON string array`);
  }
  return value;
}

// Numeric strings are accepted, but NaN and infinities are never valid public state.
export function finiteNumber(raw: unknown, name: string): number {
  const value = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(value)) throw new TypeError(`${name} must be finite`);
  return value;
}

// Missing enum attributes use the documented default; unknown spellings fail clearly.
export function enumValue<T extends string>(
  raw: string | null,
  values: readonly T[],
  fallback: T,
  name: string,
): T {
  if (raw === null || raw === "") return fallback;
  if (!values.includes(raw as T))
    throw new TypeError(`${name} must be one of ${values.join(", ")}`);
  return raw as T;
}

interface ControllerHost extends HTMLElement {
  atomicoSync(): void;
}

function Controller() {
  const host = useHost<ControllerHost>();
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    const requestSync = () => setRevision((current) => current + 1);
    host.current.addEventListener("atomico-suite-sync", requestSync);
    return () => host.current.removeEventListener("atomico-suite-sync", requestSync);
  }, []);
  useEffect(() => {
    void revision;
    host.current.atomicoSync();
  }, [revision]);

  return <host />;
}

const ControllerBase = c(Controller);
const controllerLifecycle = ControllerBase.prototype as unknown as {
  connectedCallback(this: HTMLElement): void;
  disconnectedCallback(this: HTMLElement): void;
};

export function upgradeProperties(host: HTMLElement, names: readonly string[]): void {
  // Pre-definition assignments create own properties that would otherwise shadow accessors after upgrade.
  const target = host as unknown as Record<string, unknown>;
  for (const name of names) {
    if (!Object.prototype.hasOwnProperty.call(host, name)) continue;
    const value = target[name];
    delete target[name];
    target[name] = value;
  }
}

export abstract class DeferredElement extends ControllerBase implements ControllerHost {
  #observer: MutationObserver | null = null;

  connectedCallback(): void {
    upgradeProperties(this, [
      "value",
      "defaultValue",
      "open",
      "defaultOpen",
      "multiple",
      "disabled",
      "side",
      "sideOffset",
      "orientation",
      "activationMode",
    ]);
    controllerLifecycle.connectedCallback.call(this);
    this.#observer = new MutationObserver((records) => {
      const relevant = records.some(
        (record) =>
          record.type === "childList" ||
          (record.target instanceof HTMLElement &&
            record.target.localName.includes("-") &&
            (record.attributeName === "value" || record.attributeName === "disabled")),
      );
      if (relevant) this.deferSync();
    });
    this.#observer.observe(this, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["value", "disabled"],
    });
    this.deferSync();
  }

  disconnectedCallback(): void {
    this.#observer?.disconnect();
    this.#observer = null;
    controllerLifecycle.disconnectedCallback.call(this);
  }

  atomicoSync(): void {
    if (this.isConnected) this.sync();
  }

  protected deferSync(): void {
    this.dispatchEvent(new CustomEvent("atomico-suite-sync"));
    queueMicrotask(() => this.atomicoSync());
  }

  protected abstract sync(): void;
}

export abstract class ControlLeaf extends HTMLElement {
  static marker = "component-control";
  static kind: "button" | "dialog" | "div" = "button";
  #observer: MutationObserver | null = null;
  protected control: HTMLElement | null = null;
  connectedCallback(): void {
    if (!this.control) {
      const children = Array.from(this.childNodes);
      const node = document.createElement((this.constructor as typeof ControlLeaf).kind);
      node.append(...children);
      this.replaceChildren(node);
      this.control = node;
    }
    this.syncControl();
    this.#observer = new MutationObserver(() => this.syncControl());
    this.#observer.observe(this, { attributes: true, attributeFilter: ["class"], childList: true });
  }
  disconnectedCallback(): void {
    this.#observer?.disconnect();
    this.#observer = null;
  }
  protected syncControl(): void {
    if (!this.control) return;
    const looseChildren = Array.from(this.childNodes).filter((node) => node !== this.control);
    this.control.append(...looseChildren);
    const ctor = this.constructor as typeof ControlLeaf;
    this.control.className = `${ctor.marker}${this.className ? ` ${this.className}` : ""}`;
    this.control.dataset.testid = this.localName;
    if (this.control instanceof HTMLButtonElement) {
      this.control.style.userSelect = "none";
      this.control.type = "button";
      this.control.style.cursor = this.control.disabled ? "not-allowed" : "pointer";
    }
  }
}
export abstract class OpenController extends DeferredElement {
  onOpenChange: ChangeCallback<boolean> = null;
  protected openState = false;
  protected controlled = false;
  protected initialized = false;
  get open(): boolean {
    return this.openState;
  }
  set open(value: boolean) {
    this.controlled = true;
    this.toggleAttribute("open", value);
  }
  get defaultOpen(): boolean {
    return boolAttr(this, "default-open");
  }
  set defaultOpen(value: boolean) {
    this.toggleAttribute("default-open", value);
  }
  get disabled(): boolean {
    return boolAttr(this, "disabled");
  }
  set disabled(value: boolean) {
    this.toggleAttribute("disabled", value);
  }
  protected requestOpen(next: boolean): void {
    if (this.disabled || next === this.openState) return;
    emit(this, this.onOpenChange, "open-change", "open", next);
    if (!this.controlled) {
      this.openState = next;
      this.sync();
    }
  }
  protected initializeOpen(): void {
    if (this.initialized) return;
    this.initialized = true;
    if (!this.controlled) this.openState = this.defaultOpen;
  }
}
