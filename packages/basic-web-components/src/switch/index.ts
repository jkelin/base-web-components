import { defineComponent, effect, html, onMount, signal, useHost, useProp } from "microfw";
import {
  booleanProp,
  callbackProp,
  createPartClassController,
  emit,
  nextId,
  setAttributeValue,
  removeAttributeValue,
  stringProp,
  toggleState,
  type ChangeCallback,
} from "../shared";

export const BWC_SWITCH_BUTTON_TEST_ID = "bwc-switch-button";
export const BWC_SWITCH_THUMB_TEST_ID = "bwc-switch-thumb";
export const BWC_SWITCH_INPUT_TEST_ID = "bwc-switch-input";

type ClassController = (partClass?: string | null) => void;

export const BwcSwitchElement = defineComponent("bwc-switch", () => {
  const host = useHost();
  const checked = signal(false);
  let controlled = host.hasAttribute("checked");
  let initialized = false;
  const checkedProp = useProp("checked", {
    ...booleanProp("checked"),
    get: () => checked(),
    onSet: (next, commit) => {
      controlled = true;
      checked(next);
      commit(next);
    },
  });
  const defaultChecked = useProp("defaultChecked", booleanProp("default-checked"));
  const disabled = useProp("disabled", booleanProp("disabled"));
  const readOnly = useProp("readOnly", booleanProp("readonly"));
  const required = useProp("required", booleanProp("required"));
  const name = useProp("name", stringProp("name"));
  const value = useProp("value", stringProp("value", "on"));
  const form = useProp("form", stringProp("form"));
  const ariaLabel = useProp("ariaLabel", stringProp("aria-label"));
  const buttonClass = useProp("buttonClass", stringProp("button-class"));
  const thumbClass = useProp("thumbClass", stringProp("thumb-class"));
  const inputClass = useProp("inputClass", stringProp("input-class"));
  const onCheckedChange = useProp<ChangeCallback<boolean>>(
    "onCheckedChange",
    callbackProp<boolean>("onCheckedChange"),
  );

  const partsTemplate = html`
    <button slot="control" data-testid="bwc-switch-button" type="button" role="switch">
      <span data-testid="bwc-switch-thumb"></span>
    </button>
    <input
      slot="form-control"
      data-testid="bwc-switch-input"
      type="checkbox"
      tabindex="-1"
      aria-hidden="true"
    />
  `;
  const button = partsTemplate.fragment.querySelector("button");
  const thumb = partsTemplate.fragment.querySelector("span");
  const input = partsTemplate.fragment.querySelector("input");
  if (!button || !thumb || !input) throw new TypeError("bwc-switch template is invalid");
  let applyButtonClass: ClassController | undefined;
  let applyThumbClass: ClassController | undefined;
  let applyInputClass: ClassController | undefined;
  let associatedForm: HTMLFormElement | null = null;
  const reset = () => {
    if (controlled || host.hasAttribute("checked")) return;
    const next = defaultChecked();
    if (next === checked()) {
      input.checked = next;
    } else {
      checked(next);
    }
  };
  const updateFormListener = () => {
    const nextForm = input.form;
    if (nextForm === associatedForm) return;
    associatedForm?.removeEventListener("reset", reset);
    associatedForm = nextForm;
    associatedForm?.addEventListener("reset", reset);
  };
  const requestChecked = (next: boolean) => {
    // Native checkbox activation precedes change; rejected requests restore rendered state.
    if (disabled() || readOnly() || next === checked()) {
      if (input.checked !== checked()) input.checked = checked();
      return;
    }
    emit(host, onCheckedChange(), "checked-change", "checked", next);
    if (!controlled) checked(next);
    else if (input.checked !== checked()) input.checked = checked();
  };
  const click = () => requestChecked(!checked());
  const change = () => requestChecked(input.checked);

  onMount(() => {
    host.id ||= nextId("bwc-switch");
    button.id ||= `${host.id}-button`;
    button.style.userSelect = "none";
    thumb.style.userSelect = "none";
    input.id ||= nextId(BWC_SWITCH_INPUT_TEST_ID);
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
    if (thumb.parentElement !== button) button.append(thumb);
    if (button.parentElement !== host) host.append(button);
    if (input.parentElement !== host) host.append(input);
    const disposeTemplate = partsTemplate.bind();
    try {
      applyButtonClass ??= createPartClassController(button, "switch-button", buttonClass());
      applyThumbClass ??= createPartClassController(thumb, "switch-thumb", thumbClass());
      applyInputClass ??= createPartClassController(input, "switch-input", inputClass());
      const stopControl = effect(() => {
        const requestedChecked = checkedProp();
        if (host.hasAttribute("checked")) controlled = true;
        if (!initialized) {
          initialized = true;
          checked(controlled ? requestedChecked : defaultChecked());
        } else if (controlled) {
          checked(requestedChecked);
        }
      });
      const stopClasses = effect(() => {
        applyButtonClass?.(buttonClass());
        applyThumbClass?.(thumbClass());
        applyInputClass?.(inputClass());
      });
      const stopState = effect(() => {
        const isChecked = checked();
        const isDisabled = disabled();
        const isReadOnly = readOnly();
        const isRequired = required();
        if (button.disabled !== isDisabled) button.disabled = isDisabled;
        const cursor = isDisabled ? "not-allowed" : "pointer";
        if (button.style.cursor !== cursor) button.style.cursor = cursor;
        setAttributeValue(button, "aria-checked", String(isChecked));
        setAttributeValue(button, "aria-disabled", String(isDisabled));
        setAttributeValue(button, "aria-readonly", String(isReadOnly));
        setAttributeValue(button, "aria-required", String(isRequired));
        const label = ariaLabel();
        if (label) setAttributeValue(button, "aria-label", label);
        else removeAttributeValue(button, "aria-label");

        for (const node of [host, button, thumb]) {
          toggleState(node, "data-checked", isChecked);
          toggleState(node, "data-unchecked", !isChecked);
          toggleState(node, "data-disabled", isDisabled);
          toggleState(node, "data-readonly", isReadOnly);
          toggleState(node, "data-required", isRequired);
        }
      });
      const stopFormState = effect(() => {
        const isChecked = checked();
        const isDisabled = disabled();
        const isRequired = required();
        const nextDefault = controlled ? isChecked : defaultChecked();
        if (input.defaultChecked !== nextDefault) input.defaultChecked = nextDefault;
        if (input.checked !== isChecked) input.checked = isChecked;
        if (input.disabled !== isDisabled) input.disabled = isDisabled;
        if (input.required !== isRequired) input.required = isRequired;
      });
      const stopFormIdentity = effect(() => {
        const nextValue = value();
        if (input.value !== nextValue) input.value = nextValue;
        for (const [attribute, next] of [
          ["name", name()],
          ["form", form()],
        ] as const) {
          if (next) setAttributeValue(input, attribute, next);
          else removeAttributeValue(input, attribute);
        }
        updateFormListener();
      });
      button.addEventListener("click", click);
      input.addEventListener("change", change);

      return () => {
        stopFormIdentity();
        stopFormState();
        stopState();
        stopClasses();
        stopControl();
        button.removeEventListener("click", click);
        input.removeEventListener("change", change);
        associatedForm?.removeEventListener("reset", reset);
        associatedForm = null;
        disposeTemplate();
      };
    } catch (error) {
      disposeTemplate();
      throw error;
    }
  });

  return html`<slot name="control"></slot><slot name="form-control"></slot>`;
});
