import { effect, effectScope, isSignal, signal } from "alien-signals";
import {
  extractAttributeBindings,
  extractTextBindings,
  interpolationMarkerPrefix,
  type HtmlPrimitive,
  type TemplateBinding,
} from "./template-bindings";

type HtmlValue = HtmlPrimitive | EventListener | (() => HtmlPrimitive);

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
      readonly #renderedTemplate = render();
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
    bind: () => {
      const boundEventHandlers: TemplateBinding[] = [];
      const disposeEffects = effectScope(() => {
        for (const binding of bindings) {
          const value = values[binding.index];
          if (value === undefined && !(binding.index in values)) {
            throw new Error(`Missing template value at index ${binding.index}.`);
          }

          if (typeof value === "function" && isSignal(value as () => void)) {
            effect(() => {
              binding.set((value as () => HtmlPrimitive)());
            });
            continue;
          }

          binding.set(value as HtmlPrimitive | EventListener);
          if (binding.isEventHandler) {
            boundEventHandlers.push(binding);
          }
        }
      });

      return () => {
        disposeEffects();

        for (const binding of boundEventHandlers) {
          binding.set(null);
        }
      };
    },
  };
}

defineComponent(
  "my-paragraph",
  () => {
    // Every component instance owns its signal, including after sibling updates.
    const disabled = signal(false);
    const textValue = signal("");

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
          onchange=${(event: Event) => {
            // currentTarget is validated because synthetic callers may provide another target.
            if (!(event.currentTarget instanceof HTMLInputElement)) {
              throw new TypeError("Checkbox change handler requires an input currentTarget.");
            }

            disabled(event.currentTarget.checked);
          }}
        />
      </div>

      <div>
        <input
          id="paragraph-input"
          class="paragraph-input"
          data-testid="paragraph-input"
          type="text"
          oninput=${(event: Event) => {
            // currentTarget remains the bound input even when the event bubbles.
            if (!(event.currentTarget instanceof HTMLInputElement)) {
              throw new TypeError("Text input handler requires an input currentTarget.");
            }

            textValue(event.currentTarget.value);
          }}
        />
        <div data-testid="paragraph-value">value: ${textValue}</div>
      </div>
    `;
  },
  "p",
);
