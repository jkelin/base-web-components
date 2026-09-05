import { signal } from "alien-signals";
import { renderWithProps, useProp } from "./component-props";
import {
  bindTemplateBindings,
  extractAttributeBindings,
  extractTextBindings,
  interpolationMarkerPrefix,
  type HtmlValue,
} from "./template-bindings";

type HtmlTemplate = {
  fragment: DocumentFragment;
  bind: () => () => void;
};

// A render result is reusable across disconnects; reconnecting only recreates bindings.
function defineComponent(
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
      readonly #renderedTemplate = renderWithProps(this, render);
      readonly #shadowRoot = this.attachShadow({ mode: "open" });
      #unbind: (() => void) | undefined;

      constructor() {
        super();

        this.#shadowRoot.append(this.#renderedTemplate.fragment);

        const propertySlot = this.#shadowRoot.querySelector<HTMLSlotElement>(
          'slot[name="__properties"]',
        );
        if (!propertySlot) {
          return;
        }

        for (const className of propertySlot.classList) {
          this.classList.add(className);
        }

        for (const attribute of propertySlot.attributes) {
          // The reserved slot name locates metadata; it is not a host default.
          if (attribute.name === "name") {
            continue;
          }

          if (!this.hasAttribute(attribute.name)) {
            this.setAttribute(attribute.name, attribute.value);
          }
        }
      }

      connectedCallback(): void {
        // Duplicate connection callbacks replace bindings instead of stacking effects.
        this.#unbind?.();
        this.#unbind = this.#renderedTemplate.bind();
      }

      disconnectedCallback(): void {
        // Disconnecting before the first connection has nothing to dispose.
        this.#unbind?.();
        this.#unbind = undefined;
      }
    },
    elementName ? { extends: elementName } : undefined,
  );
}

// Attributes require complete markers; text supports markers mixed with static content.
function html(template: TemplateStringsArray, ...values: HtmlValue[]): HtmlTemplate {
  const templateElement = document.createElement("template");
  templateElement.innerHTML = template
    .map(
      (part, index) => part + (index < values.length ? `${interpolationMarkerPrefix}${index}` : ""),
    )
    .join("");

  const bindings = [
    ...extractAttributeBindings(templateElement.content, values.length),
    ...extractTextBindings(templateElement.content, values.length),
  ];

  return {
    fragment: templateElement.content,
    bind: () => bindTemplateBindings(bindings, values),
  };
}

defineComponent(
  "my-paragraph",
  () => {
    // Every component instance owns its signal, including after sibling updates.
    const disabled = signal(false);
    const textValue = signal("");
    const label = useProp("label");

    return html`
      <slot name="__properties" disabled></slot>

      <slot></slot>
      <style>
        .paragraph-action,
        .paragraph-toggle {
          cursor: pointer;
        }

        .paragraph-input {
          cursor: text;
        }

        .paragraph-action:disabled,
        .paragraph-toggle:disabled {
          cursor: not-allowed;
        }
      </style>

      <div>
        <button
          id="paragraph-action"
          class="paragraph-action"
          data-testid="paragraph-action"
          disabled=${disabled}
        >
          click me
        </button>
        <input
          id="paragraph-toggle"
          class="paragraph-toggle"
          data-testid="paragraph-toggle"
          type="checkbox"
          bind:onchange:checked=${disabled}
        />
      </div>

      <div>
        <input
          id="paragraph-input"
          class="paragraph-input"
          data-testid="paragraph-input"
          type="text"
          bind:oninput:value=${textValue}
        />
        <div data-testid="paragraph-value">value: ${textValue}</div>
        <p data-testid="paragraph-label">Component label: ${label}</p>
        <button
          id="paragraph-label-update"
          class="paragraph-action"
          data-testid="paragraph-label-update"
          onclick=${() => label("Changed through the signal")}
        >
          Update label signal
        </button>
      </div>
    `;
  },
  "p",
);

const showcase = document.querySelector<HTMLElement & { label: string | null }>("#prop-showcase");
const setProperty = document.querySelector<HTMLButtonElement>("#set-label-property");
const setAttribute = document.querySelector<HTMLButtonElement>("#set-label-attribute");
const removeAttribute = document.querySelector<HTMLButtonElement>("#remove-label-attribute");
if (!showcase || !setProperty || !setAttribute || !removeAttribute) {
  throw new Error("Missing prop showcase host or controls.");
}

setProperty.addEventListener("click", () => {
  showcase.label = "Changed through the property";
});
setAttribute.addEventListener("click", () => {
  showcase.setAttribute("label", "Changed through the attribute");
});
removeAttribute.addEventListener("click", () => {
  showcase.removeAttribute("label");
});
