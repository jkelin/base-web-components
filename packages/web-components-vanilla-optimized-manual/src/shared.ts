import { effect, signal } from "alien-signals";

let currentParent: string | undefined = undefined;

export type Signal<Value> = {
  (): Value;
  (value: Value): void;
};

export function defineComponent<
  TContext,
  BaseElement extends HTMLElement,
  const ObservedProp extends string,
>(
  tag: string,
  BaseElement: new () => BaseElement,
  observedProps: readonly ObservedProp[],
  render: (
    element: BaseElement,
    props: Record<ObservedProp, Signal<string | null>>,
    context: Signal<TContext>,
  ) => void,
  defineChildren?: () => void,
) {
  const parent = currentParent;
  const ElementBase = BaseElement as new () => HTMLElement;

  const element = class extends ElementBase {
    static observedAttributes = ["class", ...observedProps];

    #parentElement: HTMLElement | null = null;
    #props = Object.fromEntries(
      observedProps.map((prop) => [prop, signal(this.getAttribute(prop))]),
    ) as Record<ObservedProp, Signal<string | null>>;
    context?: Signal<TContext>;

    connectedCallback(): void {
      if (parent) {
        this.#parentElement = this.closest(parent);

        if (!this.#parentElement) {
          throw new Error(`Could not find ${parent} in parent chain of ${this.localName}`);
        }
      }

      this.context = (this.#parentElement as any)?.context || signal({} as TContext);
      render(this as unknown as BaseElement, this.#props, this.context!);
    }

    attributeChangedCallback(
      attributeName: string,
      _previousValue: string | null,
      nextValue: string | null,
    ): void {
      // The reserved class observer has no prop signal; every declared prop updates independently.
      if (attributeName !== "class") {
        this.#props[attributeName as ObservedProp](nextValue);
      }
    }
  };

  const name = parent ? parent + "-" + tag : tag;
  console.log("defining", name);
  // Customized built-ins require their native tag at registration; reject unsupported bases.
  const basePrototype = BaseElement.prototype;
  const baseTag =
    basePrototype === HTMLButtonElement.prototype
      ? "button"
      : basePrototype === HTMLSpanElement.prototype
        ? "span"
        : undefined;

  if (basePrototype !== HTMLElement.prototype && !baseTag) {
    throw new TypeError(`Unsupported base element ${BaseElement.name}`);
  }

  if (baseTag) {
    customElements.define(name, element, { extends: baseTag });
  } else {
    customElements.define(name, element);
  }

  currentParent = name;

  defineChildren?.();

  currentParent = parent;
}
