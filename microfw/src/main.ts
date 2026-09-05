import { renderWithProps } from "./component-props";
export { useProp } from "./component-props";
import {
  bindTemplateBindings,
  extractAttributeBindings,
  extractTextBindings,
  type HtmlValue,
} from "./template-bindings";

type HtmlTemplate = {
  fragment: DocumentFragment;
  bind: () => () => void;
};
let templateId = 0;

// A render result is reusable across disconnects; reconnecting only recreates bindings.
export function defineComponent(
  componentName: string,
  render: () => HtmlTemplate,
  elementName?: string,
): void {
  const elementConstructor = elementName
    ? (document.createElement(elementName).constructor as typeof HTMLElement)
    : HTMLElement;

  customElements.define(
    componentName,
    class extends elementConstructor {
      readonly #rendered = renderWithProps(this, render);
      #propertySlot: HTMLSlotElement | null;
      #unbind: (() => void) | undefined;

      constructor() {
        super();

        const shadowRoot = this.attachShadow({ mode: "open" });
        shadowRoot.append(this.#rendered.result.fragment);
        this.#propertySlot = shadowRoot.querySelector('slot[name="__properties"]');
      }

      connectedCallback(): void {
        // Host mutation is deferred because custom-element constructors may not add attributes.
        const propertySlot = this.#propertySlot;
        if (propertySlot) {
          this.#propertySlot = null;
          for (const className of propertySlot.classList) {
            this.classList.add(className);
          }
          for (const attribute of propertySlot.attributes) {
            if (attribute.name !== "name" && !this.hasAttribute(attribute.name)) {
              this.setAttribute(attribute.name, attribute.value);
            }
          }
        }

        this.#unbind?.();
        this.#rendered.reconnect();
        try {
          this.#unbind = this.#rendered.result.bind();
        } catch (error) {
          this.#rendered.dispose();
          throw error;
        }
      }

      disconnectedCallback(): void {
        // Template bindings stop before the prop signals they may read.
        this.#unbind?.();
        this.#unbind = undefined;
        this.#rendered.dispose();
      }
    },
    elementName ? { extends: elementName } : undefined,
  );
}

// Attributes require complete markers; text supports markers mixed with static content.
export function html(template: TemplateStringsArray, ...values: HtmlValue[]): HtmlTemplate {
  let marker: string;
  do {
    marker = `microfw:${templateId++}:`;
  } while (template.some((part) => part.includes(marker)));

  let markup = template[0]!;
  for (let index = 0; index < values.length; index += 1) {
    markup += `${marker}${index};${template[index + 1]}`;
  }

  const templateElement = document.createElement("template");
  templateElement.innerHTML = markup;
  const bindings = extractAttributeBindings(templateElement.content, values.length, marker);
  extractTextBindings(templateElement.content, values.length, marker, bindings);

  return {
    fragment: templateElement.content,
    bind: () => bindTemplateBindings(bindings, values),
  };
}
