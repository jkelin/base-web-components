import { effect, effectScope, signal } from "alien-signals";

function defineComponent(
  componentName: string,
  template: HTMLTemplateElement,
  defaultState: () => any,
  elementName?: string,
) {
  const templateContent = template.content;

  const elementConstructor = elementName
    ? (document.createElement(elementName).constructor as typeof HTMLElement)
    : HTMLElement;
  const propertySlot = templateContent.querySelector<HTMLSlotElement>('slot[name="__properties"]');

  customElements.define(
    componentName,
    class extends elementConstructor {
      readonly #shadowRoot: ShadowRoot;
      unbind: (() => void) | undefined;
      readonly #state = defaultState();

      constructor() {
        super();

        this.#shadowRoot = this.attachShadow({ mode: "open" });
        this.#shadowRoot.append(document.importNode(templateContent, true));

        if (propertySlot) {
          for (const className of propertySlot.classList) {
            this.classList.add(className);
          }

          for (const attribute of propertySlot.attributes) {
            if (!this.hasAttribute(attribute.name)) {
              this.setAttribute(attribute.name, attribute.value);
            }
          }
        }

        const checkbox = this.#shadowRoot.querySelector<HTMLInputElement>('input[type="checkbox"]');
        if (!checkbox) {
          throw new Error('Template "#custom-paragraph" requires a checkbox input.');
        }

        checkbox.addEventListener("change", () => {
          this.#state.disabled(checkbox.checked);
        });
      }

      connectedCallback(): void {
        console.log("connected");

        // Reconnection replaces the prior effect; duplicate connections remain harmless.
        this.unbind?.();
        this.unbind = effectScope(() => {
          for (const node of Array.from(this.#shadowRoot.querySelectorAll("*"))) {
            for (const attribute of Array.from(node.attributes).filter((attribute) =>
              attribute.name.startsWith("bind:"),
            )) {
              const stateKey = attribute.value;
              if (stateKey in this.#state) {
                const name = attribute.name.slice("bind:".length);

                effect(() => {
                  console.log("update");
                  const value = (this.#state as any)[stateKey]();

                  if (value === false) {
                    node.removeAttribute(name);
                  } else {
                    node.setAttribute(name, value);
                  }
                });
              }
            }
          }
        });
      }

      disconnectedCallback(): void {
        // Disconnecting before the first connection has nothing to dispose.
        this.unbind?.();
      }
    },
    elementName ? { extends: elementName } : undefined,
  );
}

const template = document.querySelector<HTMLTemplateElement>("#custom-paragraph")!;
defineComponent(template.dataset.name!, template, () => ({ disabled: signal(false) }), "p");

type AllowedContentTypes = string | number | undefined | null | boolean;
type AllowedSignalType =
  | ReturnType<typeof signal<string>>
  | ReturnType<typeof signal<number>>
  | ReturnType<typeof signal<undefined>>
  | ReturnType<typeof signal<null>>
  | ReturnType<typeof signal<boolean>>;

const htmlRootNode = document.createElement("div");
function html(
  template: TemplateStringsArray,
  ...values: (AllowedContentTypes | AllowedSignalType)[]
) {
  const separator = "=_=:";
  htmlRootNode.innerHTML = template
    .map((x, i) => x + (i < template.length - 1 ? separator + i : ""))
    .join("");
  console.log(htmlRootNode.innerHTML);

  const items: {
    value: string;
    set: (value: any) => void;
    remove: () => void;
    isHandler?: boolean;
  }[] = [];

  for (const node of Array.from(htmlRootNode.querySelectorAll("*"))) {
    for (const attribute of Array.from(node.attributes).filter((attribute) =>
      attribute.value.startsWith(separator),
    )) {
      node.removeAttribute(attribute.name);
      if (attribute.name.startsWith("on")) {
        items.push({
          value: attribute.value,
          set: (value) => ((node as any)[attribute.name] = value),
          remove: () => ((node as any)[attribute.name] = null),
          isHandler: true,
        });
      } else {
        items.push({
          value: attribute.value,
          set: node.setAttribute.bind(node, attribute.name),
          remove: node.removeAttribute.bind(node, attribute.name),
        });
      }
    }

    if ((node as any).innerText?.startsWith(separator)) {
      items.push({
        value: (node as any).innerText,
        set: (value) => ((node as any).innerText = value),
        remove: () => ((node as any).innerText = ""),
      });
    }
  }

  const unbind = effectScope(() => {
    for (const item of items) {
      const index = parseInt(item.value.slice(separator.length));
      const value = values[index];
      if (typeof value === undefined) {
        throw new Error(`value at index ${index} not found in values`);
      }

      if (typeof value === "function" && !item.isHandler) {
        effect(() => {
          item.set(value());
        });
      } else {
        item.set(value);
      }
    }
  });

  return { children: Array.from(htmlRootNode.children), unbind };
}

const x = "value attr";
const y = "counter";
const z = signal(1);
const element = html`<a name="sdfsdf" value="${x}">
  <div>${y}</div>
  <div>${z}</div>
</a>`;
element.children.forEach((c) => document.body.appendChild(c));

const element2 = html`<button
  onClick=${() => {
    z(z() + 1);
  }}
>
  click me
</button>`;
element2.children.forEach((c) => document.body.appendChild(c));
