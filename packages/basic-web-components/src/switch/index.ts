import {
  booleanValue,
  callbackValue,
  createPartClassController,
  defineComponent,
  emit,
  nextId,
  useEffects,
  type ChangeCallback,
} from "../shared";

export const BWC_SWITCH_TAG = "bwc-switch";
export const BWC_SWITCH_BUTTON_TEST_ID = "bwc-switch-button";
export const BWC_SWITCH_THUMB_TEST_ID = "bwc-switch-thumb";
export const BWC_SWITCH_INPUT_TEST_ID = "bwc-switch-input";

type ClassController = (partClass?: string | null) => void;
type SwitchState = {
  button: HTMLButtonElement;
  buttonClassController: ClassController | undefined;
  checked: boolean;
  controlled: boolean;
  initialized: boolean;
  input: HTMLInputElement;
  inputClassController: ClassController | undefined;
  onCheckedChange: ChangeCallback<boolean>;
  thumb: HTMLSpanElement;
  thumbClassController: ClassController | undefined;
};

const switchProperties = {
  checked: "checked",
  defaultChecked: "default-checked",
  disabled: "disabled",
  readOnly: "readonly",
  required: "required",
  name: "name",
  value: "value",
  form: "form",
  ariaLabel: "aria-label",
  buttonClass: "button-class",
  thumbClass: "thumb-class",
  inputClass: "input-class",
  onCheckedChange: null,
} as const;

export const BwcSwitchElement = defineComponent<SwitchState, HTMLElement, typeof switchProperties>(
  BWC_SWITCH_TAG,
  HTMLElement,
  switchProperties,
  (element, props, context, properties) => {
    const previous = context();
    const state: SwitchState =
      "checked" in previous
        ? previous
        : {
            button: document.createElement("button"),
            buttonClassController: undefined,
            checked: props.checked() !== null,
            controlled: props.checked() !== null,
            initialized: false,
            input: document.createElement("input"),
            inputClassController: undefined,
            onCheckedChange: null,
            thumb: document.createElement("span"),
            thumbClassController: undefined,
          };
    context(state);

    const { button, input, thumb } = state;
    if (button.parentElement !== element || input.parentElement !== element) {
      button.replaceChildren(thumb);
      element.replaceChildren(button, input);
    }
    element.id ||= nextId(BWC_SWITCH_TAG);
    button.id ||= `${element.id}-button`;
    button.dataset.testid ||= BWC_SWITCH_BUTTON_TEST_ID;
    button.type = "button";
    button.setAttribute("role", "switch");
    button.style.userSelect = "none";
    thumb.dataset.testid = BWC_SWITCH_THUMB_TEST_ID;
    thumb.style.userSelect = "none";
    input.dataset.testid = BWC_SWITCH_INPUT_TEST_ID;
    input.id ||= nextId(BWC_SWITCH_INPUT_TEST_ID);
    input.type = "checkbox";
    input.tabIndex = -1;
    input.setAttribute("aria-hidden", "true");
    // Visually hide without display:none so native required validity remains active.
    Object.assign(input.style, {
      border: "0",
      clip: "rect(0 0 0 0)",
      clipPath: "inset(50%)",
      height: "1px",
      margin: "-1px",
      overflow: "hidden",
      padding: "0",
      pointerEvents: "none",
      position: "absolute",
      whiteSpace: "nowrap",
      width: "1px",
    });

    // Controllers survive reconnects so changed part props cannot turn old generated tokens into author classes.
    const applyButtonClass =
      state.buttonClassController ??
      createPartClassController(button, "switch-button", props.buttonClass());
    const applyThumbClass =
      state.thumbClassController ??
      createPartClassController(thumb, "switch-thumb", props.thumbClass());
    const applyInputClass =
      state.inputClassController ??
      createPartClassController(input, "switch-input", props.inputClass());
    state.buttonClassController = applyButtonClass;
    state.thumbClassController = applyThumbClass;
    state.inputClassController = applyInputClass;

    const sync = () => {
      // defaultChecked initializes once; reconnects retain later uncontrolled interaction.
      if (!state.initialized) {
        state.initialized = true;
        if (!state.controlled) state.checked = props.defaultChecked() !== null;
      }
      const disabled = props.disabled() !== null;
      const readOnly = props.readOnly() !== null;
      const required = props.required() !== null;
      applyButtonClass(props.buttonClass());
      applyThumbClass(props.thumbClass());
      applyInputClass(props.inputClass());

      button.disabled = disabled;
      button.style.cursor = disabled ? "not-allowed" : "pointer";
      button.setAttribute("aria-checked", String(state.checked));
      button.setAttribute("aria-disabled", String(disabled));
      button.setAttribute("aria-readonly", String(readOnly));
      button.setAttribute("aria-required", String(required));
      const ariaLabel = props.ariaLabel();
      if (ariaLabel === null) button.removeAttribute("aria-label");
      else button.setAttribute("aria-label", ariaLabel);

      input.value = props.value() ?? "on";
      input.checked = state.checked;
      input.disabled = disabled;
      input.required = required;
      const forwarded = { name: props.name(), form: props.form() };
      for (const [name, value] of Object.entries(forwarded)) {
        if (value === null) input.removeAttribute(name);
        else input.setAttribute(name, value);
      }

      for (const node of [element, button, thumb]) {
        node.toggleAttribute("data-checked", state.checked);
        node.toggleAttribute("data-unchecked", !state.checked);
        node.toggleAttribute("data-disabled", disabled);
        node.toggleAttribute("data-readonly", readOnly);
        node.toggleAttribute("data-required", required);
      }
    };

    properties.install({
      checked: {
        get: () => state.checked,
        set: (next) => {
          state.controlled = true;
          element.toggleAttribute("checked", booleanValue(next, "checked"));
        },
      },
      defaultChecked: {
        get: () => props.defaultChecked() !== null,
        set: (next) =>
          element.toggleAttribute("default-checked", booleanValue(next, "defaultChecked")),
      },
      disabled: {
        get: () => props.disabled() !== null,
        set: (next) => element.toggleAttribute("disabled", booleanValue(next, "disabled")),
      },
      readOnly: {
        get: () => props.readOnly() !== null,
        set: (next) => element.toggleAttribute("readonly", booleanValue(next, "readOnly")),
      },
      required: {
        get: () => props.required() !== null,
        set: (next) => element.toggleAttribute("required", booleanValue(next, "required")),
      },
      name: {
        get: () => props.name() ?? "",
        set: (next) => element.setAttribute("name", String(next)),
      },
      value: {
        get: () => props.value() ?? "on",
        set: (next) => element.setAttribute("value", String(next)),
      },
      form: {
        get: () => props.form() ?? "",
        set: (next) => element.setAttribute("form", String(next)),
      },
      ariaLabel: {
        get: () => props.ariaLabel() ?? "",
        set: (next) => element.setAttribute("aria-label", String(next)),
      },
      buttonClass: {
        get: () => props.buttonClass() ?? "",
        set: (next) => element.setAttribute("button-class", String(next)),
      },
      thumbClass: {
        get: () => props.thumbClass() ?? "",
        set: (next) => element.setAttribute("thumb-class", String(next)),
      },
      inputClass: {
        get: () => props.inputClass() ?? "",
        set: (next) => element.setAttribute("input-class", String(next)),
      },
      onCheckedChange: {
        get: () => state.onCheckedChange,
        set: (next) => {
          state.onCheckedChange = callbackValue<boolean>(next, "onCheckedChange");
        },
      },
    });

    const requestChecked = (next: boolean) => {
      // Native checkbox activation happens before change; rejected requests must restore it.
      if (props.disabled() !== null || props.readOnly() !== null || next === state.checked) {
        sync();
        return;
      }
      emit(element, state.onCheckedChange, "checked-change", "checked", next);
      if (!state.controlled) state.checked = next;
      sync();
    };
    const click = () => requestChecked(!state.checked);
    const change = () => requestChecked(input.checked);
    button.addEventListener("click", click);
    input.addEventListener("change", change);
    const dispose = useEffects(() => {
      if (props.checked() !== null) {
        state.controlled = true;
        state.checked = true;
      } else if (state.controlled) {
        state.checked = false;
      }
      sync();
    });

    return {
      disconnect() {
        dispose();
        button.removeEventListener("click", click);
        input.removeEventListener("change", change);
      },
    };
  },
);
