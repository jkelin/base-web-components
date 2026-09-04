import { createEffect, onCleanup } from "solid-js";
import { customElement } from "solid-element";
import {
  type ChangeCallback,
  booleanProp,
  classProp,
  emit,
  initializeBooleanProps,
  reflectedProp,
  type SolidElementHost,
  useLightDom,
} from "./shared";

export const SOLID_TOGGLE_CHECKBOX_TAG = "solid-toggle-checkbox";

interface CheckboxProps {
  checked: boolean;
  defaultChecked: boolean;
  indeterminate: boolean;
  disabled: boolean;
  readOnly: boolean;
  required: boolean;
  name: string;
  value: string;
  form: string;
  ariaLabel: string;
  hostClass: string;
  onCheckedChange: ChangeCallback<boolean>;
}

export const SolidToggleCheckboxElement = customElement<CheckboxProps>(
  SOLID_TOGGLE_CHECKBOX_TAG,
  {
    checked: booleanProp("checked", false),
    defaultChecked: booleanProp("default-checked"),
    indeterminate: booleanProp("indeterminate"),
    disabled: booleanProp("disabled"),
    readOnly: booleanProp("readonly"),
    required: booleanProp("required"),
    name: reflectedProp("", "name"),
    value: reflectedProp("", "value"),
    form: reflectedProp("", "form"),
    ariaLabel: reflectedProp("", "aria-label"),
    hostClass: classProp,
    onCheckedChange: null,
  },
  (props, { element }) => {
    useLightDom();
    const host = element as unknown as SolidElementHost & CheckboxProps;
    const input = document.createElement("input");
    input.type = "checkbox";
    initializeBooleanProps(host, {
      checked: "checked",
      defaultChecked: "default-checked",
      indeterminate: "indeterminate",
      disabled: "disabled",
      readOnly: "readonly",
      required: "required",
    });

    let controlled = host.hasAttribute("checked");
    let internalWrite = false;
    host.addPropertyChangedCallback((name) => {
      if (name === "checked" && !internalWrite) controlled = true;
    });
    const setChecked = (checked: boolean): void => {
      internalWrite = true;
      host.checked = checked;
      internalWrite = false;
    };
    setChecked(controlled ? host.hasAttribute("checked") : host.hasAttribute("default-checked"));

    const sync = (): void => {
      const checked = Boolean(props.checked);
      const disabled = host.hasAttribute("disabled");
      input.className = props.hostClass ? `toggle-checkbox ${props.hostClass}` : "toggle-checkbox";
      input.dataset.testid = host.localName;
      input.style.cursor = disabled ? "not-allowed" : "pointer";
      input.checked = checked;
      input.indeterminate = host.hasAttribute("indeterminate");
      input.disabled = disabled;
      input.readOnly = host.hasAttribute("readonly");
      input.required = host.hasAttribute("required");
      for (const [name, value] of [
        ["name", props.name],
        ["value", props.value],
        ["form", props.form],
        ["aria-label", props.ariaLabel],
      ] as const) {
        if (value) input.setAttribute(name, value);
        else input.removeAttribute(name);
      }
      for (const node of [host, input]) {
        node.toggleAttribute("data-checked", checked);
        node.toggleAttribute("data-unchecked", !checked);
        node.toggleAttribute("data-disabled", disabled);
      }
    };
    createEffect(sync);

    const onChange = (): void => {
      if (host.hasAttribute("disabled") || host.hasAttribute("readonly")) {
        sync();
        return;
      }
      const next = input.checked;
      emit(host, props.onCheckedChange, "checked-change", "checked", next);
      if (controlled) sync();
      else setChecked(next);
    };
    input.addEventListener("change", onChange);
    onCleanup(() => input.removeEventListener("change", onChange));

    return input;
  },
);
