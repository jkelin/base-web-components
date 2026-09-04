import { createEffect, onCleanup } from "solid-js";
import { customElement } from "solid-element";
import {
  type ChangeCallback,
  booleanProp,
  classProp,
  emit,
  enumValue,
  finiteNumber,
  initializeBooleanProps,
  reflectedProp,
  type SolidElementHost,
  useLightDom,
} from "./shared";

export const SOLID_OTP_FIELD_TAG = "solid-otp-field";
type ValidationType = "numeric" | "alpha" | "alphanumeric" | "none";
const VALIDATION_TYPES = ["numeric", "alpha", "alphanumeric", "none"] as const;

interface OtpProps {
  value?: unknown;
  defaultValue?: unknown;
  length?: unknown;
  validationType: ValidationType;
  mask: boolean;
  disabled: boolean;
  readOnly: boolean;
  required: boolean;
  name: string;
  form: string;
  autocomplete: string;
  inputMode: string;
  hostClass: string;
  onValueChange: ChangeCallback<string>;
  onValueComplete: ChangeCallback<string>;
}

export const SolidOtpFieldElement = customElement<OtpProps>(
  SOLID_OTP_FIELD_TAG,
  {
    value: reflectedProp<unknown>(undefined, "value"),
    defaultValue: reflectedProp<unknown>(undefined, "default-value"),
    length: reflectedProp<unknown>(undefined, "length"),
    validationType: reflectedProp<ValidationType>("numeric", "validation-type"),
    mask: booleanProp("mask"),
    disabled: booleanProp("disabled"),
    readOnly: booleanProp("readonly"),
    required: booleanProp("required"),
    name: reflectedProp("", "name"),
    form: reflectedProp("", "form"),
    autocomplete: reflectedProp("", "autocomplete"),
    inputMode: reflectedProp("", "inputmode"),
    hostClass: classProp,
    onValueChange: null,
    onValueComplete: null,
  },
  (props, { element }) => {
    useLightDom();
    const host = element as unknown as SolidElementHost & OtpProps;
    initializeBooleanProps(host, {
      mask: "mask",
      disabled: "disabled",
      readOnly: "readonly",
      required: "required",
    });
    let inputs: HTMLInputElement[] = [];
    let hidden: HTMLInputElement | null = null;
    let controlled = host.hasAttribute("value");
    let internalWrite = false;

    const length = (): number => {
      const value = finiteNumber(props.length, "length");
      if (!Number.isInteger(value) || value < 1)
        throw new TypeError("length must be a positive integer");
      return value;
    };
    const validationType = (): ValidationType =>
      enumValue(props.validationType, VALIDATION_TYPES, "numeric", "validationType");
    // Filtering happens before slicing so punctuation never consumes an OTP slot.
    const normalize = (raw: unknown): string => {
      const value = typeof raw === "string" ? raw : raw == null ? "" : String(raw);
      const pattern =
        validationType() === "numeric"
          ? /[^0-9]/g
          : validationType() === "alpha"
            ? /[^a-z]/gi
            : validationType() === "alphanumeric"
              ? /[^a-z0-9]/gi
              : null;
      return (pattern ? value.replace(pattern, "") : value).slice(0, length());
    };

    host.addPropertyChangedCallback((name) => {
      if (name === "value" && !internalWrite) controlled = true;
    });
    const setValue = (value: string): void => {
      internalWrite = true;
      host.value = value;
      internalWrite = false;
    };
    setValue(normalize(controlled ? props.value : props.defaultValue));

    const removeInputListeners = (): void => {
      for (const input of inputs) {
        input.removeEventListener("input", onInput);
        input.removeEventListener("keydown", onKey);
        input.removeEventListener("paste", onPaste);
      }
    };
    const commit = (raw: string): void => {
      const next = normalize(raw);
      emit(host, props.onValueChange, "value-change", "value", next);
      if (next.length === length())
        emit(host, props.onValueComplete, "value-complete", "value", next);
      if (controlled) sync();
      else setValue(next);
    };
    const onInput = (event: Event): void => {
      const input = event.currentTarget as HTMLInputElement;
      const index = inputs.indexOf(input);
      const chars = normalize(input.value);
      const current = normalize(props.value);
      commit((current.slice(0, index) + chars + current.slice(index + 1)).slice(0, length()));
      if (chars && index < length() - 1) inputs[index + 1]?.focus();
    };
    const onKey = (event: KeyboardEvent): void => {
      const input = event.currentTarget as HTMLInputElement;
      const index = inputs.indexOf(input);
      if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
        event.preventDefault();
        const delta = event.key === "ArrowLeft" ? -1 : 1;
        inputs[(index + delta + length()) % length()]?.focus();
      }
      if (event.key === "Backspace") {
        event.preventDefault();
        const current = normalize(props.value);
        const previous = current[index] ? index : Math.max(0, index - 1);
        commit(current.slice(0, previous) + current.slice(previous + 1));
        if (previous !== index) inputs[previous]?.focus();
      }
    };
    const onPaste = (event: ClipboardEvent): void => {
      event.preventDefault();
      const index = inputs.indexOf(event.currentTarget as HTMLInputElement);
      const text = normalize(event.clipboardData?.getData("text") ?? "");
      const current = normalize(props.value);
      commit(
        (current.slice(0, index) + text + current.slice(index + text.length)).slice(0, length()),
      );
      inputs[Math.min(length() - 1, index + text.length)]?.focus();
    };
    const sync = (): void => {
      const count = length();
      const value = normalize(props.value);
      if (inputs.length !== count) {
        removeInputListeners();
        inputs = Array.from({ length: count }, () => {
          const input = document.createElement("input");
          input.maxLength = 1;
          input.dataset.testid = host.localName;
          input.addEventListener("input", onInput);
          input.addEventListener("keydown", onKey);
          input.addEventListener("paste", onPaste);
          return input;
        });
        hidden = document.createElement("input");
        hidden.type = "hidden";
        host.replaceChildren(...inputs, hidden);
      }
      const disabled = host.hasAttribute("disabled");
      const readOnly = host.hasAttribute("readonly");
      const mask = host.hasAttribute("mask");
      inputs.forEach((input, index) => {
        input.type = mask ? "password" : "text";
        input.value = value[index] ?? "";
        input.className = props.hostClass
          ? `otp-field-input ${props.hostClass}`
          : "otp-field-input";
        input.style.cursor = disabled ? "not-allowed" : "text";
        input.disabled = disabled;
        input.readOnly = readOnly;
        input.required = host.hasAttribute("required");
        input.setAttribute("autocomplete", props.autocomplete || "one-time-code");
        input.inputMode = props.inputMode || (validationType() === "numeric" ? "numeric" : "text");
        input.setAttribute("aria-label", `Character ${index + 1} of ${count}`);
        input.toggleAttribute("data-complete", Boolean(value[index]));
        input.toggleAttribute("data-disabled", disabled);
      });
      if (hidden) {
        hidden.value = value;
        for (const [name, attr] of [
          ["name", props.name],
          ["form", props.form],
        ] as const) {
          if (attr) hidden.setAttribute(name, attr);
          else hidden.removeAttribute(name);
        }
      }
      host.toggleAttribute("data-complete", value.length === count);
      host.toggleAttribute("data-disabled", disabled);
    };
    createEffect(sync);
    onCleanup(removeInputListeners);
  },
);
