import { defineComponent, effect, html, onMount, useHost, useProp } from "microfw";
import {
  booleanProp,
  callbackProp,
  createPartClassController,
  emit,
  nextId,
  stringProp,
  type ChangeCallback,
} from "../shared";

export const BWC_SWITCH_TAG = "bwc-switch";
export const BWC_SWITCH_BUTTON_TEST_ID = "bwc-switch-button";
export const BWC_SWITCH_THUMB_TEST_ID = "bwc-switch-thumb";
export const BWC_SWITCH_INPUT_TEST_ID = "bwc-switch-input";

type ClassController = (partClass?: string | null) => void;

export const BwcSwitchElement = defineComponent(BWC_SWITCH_TAG, () => {
  const host = useHost();
  let checked = false;
  let controlled = host.hasAttribute("checked");
  let initialized = false;
  const checkedProp = useProp("checked", {
    ...booleanProp("checked"),
    get: () => checked,
    onSet: (next, commit) => {
      controlled = true;
      checked = next;
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

  const button = document.createElement("button");
  const thumb = document.createElement("span");
  const input = document.createElement("input");
  let applyButtonClass: ClassController | undefined;
  let applyThumbClass: ClassController | undefined;
  let applyInputClass: ClassController | undefined;
  let associatedForm: HTMLFormElement | null = null;
  const reset = () => {
    if (controlled || host.hasAttribute("checked")) return;
    checked = defaultChecked();
    sync();
  };
  const updateFormListener = () => {
    const nextForm = input.form;
    if (nextForm === associatedForm) return;
    associatedForm?.removeEventListener("reset", reset);
    associatedForm = nextForm;
    associatedForm?.addEventListener("reset", reset);
  };
  const sync = () => {
    const requestedChecked = checkedProp();
    if (host.hasAttribute("checked")) controlled = true;
    if (!initialized) {
      initialized = true;
      checked = controlled ? requestedChecked : defaultChecked();
    } else if (controlled) {
      checked = requestedChecked;
    }

    const isDisabled = disabled();
    const isReadOnly = readOnly();
    const isRequired = required();
    applyButtonClass?.(buttonClass());
    applyThumbClass?.(thumbClass());
    applyInputClass?.(inputClass());

    button.disabled = isDisabled;
    button.style.cursor = isDisabled ? "not-allowed" : "pointer";
    button.setAttribute("aria-checked", String(checked));
    button.setAttribute("aria-disabled", String(isDisabled));
    button.setAttribute("aria-readonly", String(isReadOnly));
    button.setAttribute("aria-required", String(isRequired));
    const label = ariaLabel();
    if (label) button.setAttribute("aria-label", label);
    else button.removeAttribute("aria-label");

    input.value = value();
    input.defaultChecked = controlled ? checked : defaultChecked();
    input.checked = checked;
    input.disabled = isDisabled;
    input.required = isRequired;
    for (const [attribute, next] of [
      ["name", name()],
      ["form", form()],
    ] as const) {
      if (next) input.setAttribute(attribute, next);
      else input.removeAttribute(attribute);
    }

    for (const node of [host, button, thumb]) {
      node.toggleAttribute("data-checked", checked);
      node.toggleAttribute("data-unchecked", !checked);
      node.toggleAttribute("data-disabled", isDisabled);
      node.toggleAttribute("data-readonly", isReadOnly);
      node.toggleAttribute("data-required", isRequired);
    }
    updateFormListener();
  };
  const requestChecked = (next: boolean) => {
    // Native checkbox activation precedes change; rejected requests restore rendered state.
    if (disabled() || readOnly() || next === checked) {
      sync();
      return;
    }
    emit(host, onCheckedChange(), "checked-change", "checked", next);
    if (!controlled) checked = next;
    sync();
  };
  const click = () => requestChecked(!checked);
  const change = () => requestChecked(input.checked);

  onMount(() => {
    host.id ||= nextId(BWC_SWITCH_TAG);
    button.id ||= `${host.id}-button`;
    button.dataset.testid ||= BWC_SWITCH_BUTTON_TEST_ID;
    button.type = "button";
    button.slot = "control";
    button.setAttribute("role", "switch");
    button.style.userSelect = "none";
    thumb.dataset.testid ||= BWC_SWITCH_THUMB_TEST_ID;
    thumb.style.userSelect = "none";
    input.dataset.testid ||= BWC_SWITCH_INPUT_TEST_ID;
    input.id ||= nextId(BWC_SWITCH_INPUT_TEST_ID);
    input.type = "checkbox";
    input.slot = "form-control";
    input.tabIndex = -1;
    input.setAttribute("aria-hidden", "true");
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

    applyButtonClass ??= createPartClassController(button, "switch-button", buttonClass());
    applyThumbClass ??= createPartClassController(thumb, "switch-thumb", thumbClass());
    applyInputClass ??= createPartClassController(input, "switch-input", inputClass());
    const dispose = effect(sync);
    button.addEventListener("click", click);
    input.addEventListener("change", change);

    return () => {
      dispose();
      button.removeEventListener("click", click);
      input.removeEventListener("change", change);
      associatedForm?.removeEventListener("reset", reset);
      associatedForm = null;
    };
  });

  return html`<slot name="control"></slot><slot name="form-control"></slot>`;
});
