// Standalone consumers must use this bundled factory; separate copies cannot share subscriptions.
export { signal } from "alien-signals";
import { renderWithProps } from "./component-props";
export { useProp } from "./component-props";
import {
  bindTemplateBindings,
  extractAttributeBindings,
  extractTextBindings,
  MARKER_TERMINATOR,
  SETUP_INDEX_OFFSET,
  type HtmlValue,
  type TemplateBinding,
} from "./template-bindings";

type HtmlTemplate = {
  fragment: DocumentFragment;
  bind: () => () => void;
};
const MARKER_SEPARATOR = ":";
// Decimal ids plus ":" are literal-safe in the extraction regex.
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
          this.classList.add(...propertySlot.classList);
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
  let entityDecoder: HTMLTemplateElement | undefined;
  let marker: string;
  let templateElement: HTMLTemplateElement;
  let bindings: TemplateBinding[];
  for (;;) {
    marker = `${templateId++}${MARKER_SEPARATOR}`;
    let collision = false;
    for (const part of template) {
      if (part.includes(marker)) {
        collision = true;
        break;
      }
      if (part.includes("&")) {
        // Decode as text; incomplete HTML chunks must not discard entity evidence.
        entityDecoder ??= document.createElement("template");
        entityDecoder.innerHTML = part.replaceAll("<", "&lt;");
        if (entityDecoder.content.textContent!.includes(marker)) {
          collision = true;
          break;
        }
      }
    }
    if (collision) {
      continue;
    }

    let markup = template[0]!;
    for (let index = 0; index < values.length; index += 1) {
      markup += `${marker}${index}${MARKER_TERMINATOR}${template[index + 1]}`;
    }

    templateElement = document.createElement("template");
    templateElement.innerHTML = markup;
    bindings = extractAttributeBindings(templateElement.content, values.length, marker);
    extractTextBindings(templateElement.content, values.length, marker, bindings);
    let unsupported =
      bindings.length !== values.length || templateElement.innerHTML.includes(marker);
    if (!unsupported && values.length > 1) {
      const seen = new Uint8Array(values.length);
      for (const [encodedIndex] of bindings) {
        const index = encodedIndex < 0 ? -encodedIndex - SETUP_INDEX_OFFSET : encodedIndex;
        if (seen[index]) {
          unsupported = true;
          break;
        }
        seen[index] = 1;
      }
    }
    // Equal count plus unique indices proves every interpolation survived parsing exactly once.
    if (unsupported) {
      throw new Error("Unsupported interpolation context.");
    }
    break;
  }

  return {
    fragment: templateElement.content,
    bind: () => bindTemplateBindings(bindings, values),
  };
}
