import { defineComponent, html, signal, useProp } from "./main";

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
