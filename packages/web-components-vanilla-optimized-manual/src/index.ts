// const registry = customElements;
// const ElementBase = HTMLElement;
// const valueAttribute = "value";
// const defaultAttribute = "default-value";
// const counts = new WeakMap<HTMLElement, number>();

// // Strings (including whitespace) coerce numerically; fractions truncate; invalid/non-finite values become zero.
// const parseValue = (raw: unknown): number =>
//   /^n|^st/.test(typeof raw)
//     ? Math.trunc(raw as number) % Infinity || 0
//     : 0;

// // A missing label still records state so any later child upgrade can pull the current value.
// const render = (host: HTMLElement, next = counts.get(host) ?? 0): void => {
//   counts.set(host, next);
//   const label = host.querySelector("span");
//   if (label) label.textContent = "" + next;
// };

// // A missing inner element is valid before the child has rendered.
// const syncClass = (host: HTMLElement, marker: string): void => {
//   const inner = host.children[0] as HTMLElement | undefined;
//   if (!inner) return;
//   inner.className = "counter-" + marker + (host.className && ` ${host.className}`);
// };

// registry.define("o-c", class extends ElementBase {
//   static observedAttributes = [valueAttribute];

//   declare onChange?: (value: number) => void;

//   get defaultValue(): number {
//     return parseValue(this.getAttribute(defaultAttribute));
//   }

//   set defaultValue(next: number) {
//     this.setAttribute(defaultAttribute, "" + parseValue(next));
//   }

//   get value(): number {
//     return counts.get(this) ?? 0;
//   }

//   set value(next: number) {
//     this.setAttribute(valueAttribute, "" + parseValue(next));
//   }

//   connectedCallback(): void {
//     this.addEventListener("click", this.#handleClick);
//     // Initial render plus each child's owner pull covers every parser/upgrade order.
//     render(this, parseValue(this.getAttribute(valueAttribute) ?? this.getAttribute(defaultAttribute)));
//   }

//   disconnectedCallback(): void {
//     this.removeEventListener("click", this.#handleClick);
//   }

//   attributeChangedCallback(
//     attributeName: string,
//     previousValue: string | null,
//     next: string | null,
//   ): void {
//     render(this, parseValue(next));
//   }

//   #handleClick = (event: MouseEvent): void => {
//     const origin = (event.target as Element).closest("o-m,o-p");
//     if (origin) {
//       const next = this.value + (origin.matches("o-p") ? 1 : -1);
//       if (!this.hasAttribute(valueAttribute)) render(this, next);
//       this.onChange?.(next);
//       // This light-DOM-only variant needs bubbling, not cross-shadow composition.
//       this.dispatchEvent(new CustomEvent("change", {
//         bubbles: true,
//         detail: { value: next },
//       }));
//     }
//   };
// });

// // Empty authored children are rendered once; existing content remains untouched.
// const defineChild = (tag: string, marker: string, word?: string, symbol?: string): void =>
//   registry.define(tag, class extends ElementBase {
//     static observedAttributes = ["class"];

//     connectedCallback(): void {
//       this.innerHTML ||= word
//         ? `<button type=button aria-label="${word} count" data-testid=${tag} style=cursor:pointer>${symbol}`
//         : `<span aria-live=polite data-testid=${tag}>`;
//       syncClass(this, marker);
//       const owner = this.closest("o-c") as HTMLElement | null;
//       if (!word && owner) render(owner);
//     }

//     attributeChangedCallback(): void {
//       syncClass(this, marker);
//     }
//   });

// defineChild("o-m", "minus-button", "Decrement", "−");
// defineChild("o-l", "label");
// defineChild("o-p", "plus-button", "Increment", "+");

let currentParent: any | undefined = undefined;
let currentChildren: any[] = [];
let currentUpdate: undefined | (() => void) = undefined;
let currentLoadContext: undefined | (() => void) = undefined;

const setUpdate = (update: typeof currentUpdate) => (currentUpdate = update);
const setLoadContext = (loadContext: typeof currentLoadContext) =>
  (currentLoadContext = loadContext);

function defineComponent(
  tag: string,
  render: (e: HTMLElement) => void,
  defineChildren?: () => void,
) {
  const parent = currentParent;
  let update: typeof currentUpdate = undefined;
  let loadContext: typeof currentLoadContext = undefined;

  const element = class extends HTMLElement {
    static observedAttributes = ["class"];

    #parentElement: HTMLElement | undefined;

    connectedCallback(): void {
      if (1 == 1) {
        currentUpdate = undefined;
      }

      if (parent) {
        this.#parentElement = this.closest(parent.name);

        if (!this.#parentElement) {
          throw new Error(`Could not find ${parent.name} in parent chain of ${this.name}`);
        }
      }

      render(this);
      update = currentUpdate;
      loadContext = currentLoadContext;
      loadContext?.();
      update?.();
    }

    attributeChangedCallback(): void {
      loadContext?.();
      update?.();
    }
  };

  (element as any).name = parent ? parent.name + "-" + tag : tag;
  customElements.define(element.name, element);

  currentChildren = [];
  currentParent = element;

  defineChildren?.();

  currentParent = parent;
}

let ctx = {
  count: 0,
};
defineComponent(
  "manually-optimized-counter",
  (e) => {},
  () => {
    defineComponent("plus-button", (e) => {
      e.innerHTML = `<button type=button aria-label="Add count" style=cursor:pointer>+`;
    });

    defineComponent("minus-button", (e) => {
      e.innerHTML = `<button type=button aria-label="Remove count" style=cursor:pointer>-`;
    });

    defineComponent("label", (e) => {
      e.innerHTML = `<span aria-live=polite>`;
    });
  },
);
