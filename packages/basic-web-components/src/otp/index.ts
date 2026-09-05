import { defineComponent, effect, html, onMount, useHost, useProp } from "microfw";
import {
  booleanProp,
  callbackProp,
  createPartClassController,
  emit,
  enumProp,
  finiteNumber,
  nextId,
  numberProp,
  stringProp,
  type ChangeCallback,
} from "../shared";

export const BWC_OTP_TAG = "bwc-otp";
export const BWC_OTP_INPUT_TEST_ID = "bwc-otp-input";
export const BWC_OTP_HIDDEN_INPUT_TEST_ID = "bwc-otp-hidden-input";

type ValidationType = "numeric" | "alpha" | "alphanumeric" | "none";
type ClassController = (partClass?: string | null) => void;

const validationTypes = ["numeric", "alpha", "alphanumeric", "none"] as const;

function positiveInteger(raw: unknown, name: string): number {
  const value = finiteNumber(raw, name);
  if (!Number.isInteger(value) || value < 1) {
    throw new TypeError(`${name} must be a positive integer`);
  }
  return value;
}

export function normalizeOtpValue(
  raw: string,
  validationType: ValidationType,
  length: number,
): string {
  // Length is the hard capacity; invalid lengths fail at the public boundary.
  positiveInteger(length, "length");
  const pattern =
    validationType === "numeric"
      ? /[^0-9]/g
      : validationType === "alpha"
        ? /[^a-z]/gi
        : validationType === "alphanumeric"
          ? /[^a-z0-9]/gi
          : null;
  return (pattern ? raw.replace(pattern, "") : raw).slice(0, length);
}

export const BwcOtpElement = defineComponent(BWC_OTP_TAG, () => {
  const host = useHost();
  let currentValue = "";
  let controlled = host.hasAttribute("value");
  let initialized = false;

  const length = useProp("length", {
    ...numberProp("length"),
    fromAttribute: (raw) => (raw === null ? 0 : positiveInteger(raw, "length")),
    fromProperty: (raw) => positiveInteger(raw, "length"),
  });
  const validationType = useProp<ValidationType>(
    "validationType",
    enumProp("validation-type", validationTypes, "numeric"),
  );
  const normalize = (raw: string) => normalizeOtpValue(raw, validationType(), length());
  const value = useProp("value", {
    ...stringProp("value"),
    fromAttribute: (raw) => raw ?? "",
    fromProperty: (raw) => normalize(String(raw)),
    get: () => currentValue,
    onSet: (next, commit) => {
      controlled = true;
      commit(next);
    },
  });
  const defaultValue = useProp("defaultValue", {
    ...stringProp("default-value"),
    fromAttribute: (raw) => raw ?? "",
    fromProperty: (raw) => normalize(String(raw)),
    get: (stored) => normalize(stored),
  });
  const mask = useProp("mask", booleanProp("mask"));
  const disabled = useProp("disabled", booleanProp("disabled"));
  const readOnly = useProp("readOnly", booleanProp("readonly"));
  const required = useProp("required", booleanProp("required"));
  const name = useProp("name", stringProp("name"));
  const form = useProp("form", stringProp("form"));
  const autocomplete = useProp("autocomplete", stringProp("autocomplete", "one-time-code"));
  const inputMode = useProp("inputMode", {
    ...stringProp("inputmode"),
    get: (stored) => stored || (validationType() === "numeric" ? "numeric" : "text"),
  });
  const fieldClass = useProp("fieldClass", stringProp("field-class"));
  const hiddenInputClass = useProp("hiddenInputClass", stringProp("hidden-input-class"));
  const onValueChange = useProp<ChangeCallback<string>>(
    "onValueChange",
    callbackProp<string>("onValueChange"),
  );
  const onValueComplete = useProp<ChangeCallback<string>>(
    "onValueComplete",
    callbackProp<string>("onValueComplete"),
  );

  const fields: HTMLInputElement[] = [];
  const classControllers = new WeakMap<HTMLInputElement, ClassController>();
  const hiddenInput = document.createElement("input");
  let hiddenClassController: ClassController | undefined;
  let associatedForm: HTMLFormElement | null = null;

  const applyFieldClass = (field: HTMLInputElement) => {
    let apply = classControllers.get(field);
    if (!apply) {
      apply = createPartClassController(field, "otp-field", fieldClass());
      classControllers.set(field, apply);
    }
    apply(fieldClass());
  };
  const reset = () => {
    if (controlled) return;
    currentValue = defaultValue();
    sync();
  };
  const updateFormListener = () => {
    const nextForm = hiddenInput.form;
    if (nextForm === associatedForm) return;
    associatedForm?.removeEventListener("reset", reset);
    associatedForm = nextForm;
    associatedForm?.addEventListener("reset", reset);
  };
  const reconcileFields = (count: number) => {
    // Surviving fields retain IDs, focus targets, and author classes.
    while (fields.length < count) {
      const field = document.createElement("input");
      field.id = nextId(BWC_OTP_INPUT_TEST_ID);
      field.dataset.testid = BWC_OTP_INPUT_TEST_ID;
      field.slot = "field";
      field.maxLength = 1;
      fields.push(field);
      host.insertBefore(field, hiddenInput.parentElement === host ? hiddenInput : null);
    }
    while (fields.length > count) {
      fields.pop()?.remove();
    }
    for (const field of fields) {
      if (field.parentElement !== host) host.insertBefore(field, hiddenInput);
    }
  };
  const sync = () => {
    const count = length();
    reconcileFields(count);
    const requestedValue = value();
    if (requestedValue !== "") controlled = true;
    if (!initialized) {
      initialized = true;
      currentValue = controlled ? normalize(requestedValue) : normalize(defaultValue());
    } else if (controlled) {
      currentValue = normalize(requestedValue);
    } else {
      currentValue = normalize(currentValue);
    }

    const isDisabled = disabled();
    const isReadOnly = readOnly();
    const isRequired = required();
    const fieldAutocomplete = autocomplete();
    const fieldInputMode = inputMode() || (validationType() === "numeric" ? "numeric" : "text");
    const fieldForm = form();
    const masked = mask();
    const normalizedDefault = controlled ? currentValue : defaultValue();
    fields.forEach((field, index) => {
      applyFieldClass(field);
      field.type = masked ? "password" : "text";
      field.value = currentValue[index] ?? "";
      field.defaultValue = normalizedDefault[index] ?? "";
      field.disabled = isDisabled;
      field.readOnly = isReadOnly;
      field.required = isRequired;
      field.setAttribute("autocomplete", fieldAutocomplete);
      field.inputMode = fieldInputMode;
      field.style.cursor = isDisabled ? "not-allowed" : "text";
      field.setAttribute("aria-label", `Character ${index + 1} of ${count}`);
      if (fieldForm) field.setAttribute("form", fieldForm);
      else field.removeAttribute("form");
      field.toggleAttribute("data-complete", Boolean(field.value));
      field.toggleAttribute("data-disabled", isDisabled);
      field.toggleAttribute("data-readonly", isReadOnly);
      field.toggleAttribute("data-required", isRequired);
    });

    hiddenClassController?.(hiddenInputClass());
    hiddenInput.defaultValue = normalizedDefault;
    hiddenInput.value = currentValue;
    hiddenInput.disabled = isDisabled;
    const hiddenName = name();
    if (hiddenName) hiddenInput.name = hiddenName;
    else hiddenInput.removeAttribute("name");
    if (fieldForm) hiddenInput.setAttribute("form", fieldForm);
    else hiddenInput.removeAttribute("form");

    host.toggleAttribute("data-complete", currentValue.length === count);
    host.toggleAttribute("data-disabled", isDisabled);
    host.toggleAttribute("data-readonly", isReadOnly);
    host.toggleAttribute("data-required", isRequired);
    updateFormListener();
  };
  const commit = (next: string) => {
    const normalized = normalize(next);
    if (normalized === currentValue) {
      sync();
      return;
    }
    emit(host, onValueChange(), "value-change", "value", normalized);
    if (normalized.length === length()) {
      emit(host, onValueComplete(), "value-complete", "value", normalized);
    }
    if (!controlled) currentValue = normalized;
    sync();
  };
  const updateFromField = (field: HTMLInputElement, raw: string) => {
    const index = fields.indexOf(field);
    if (index < 0 || disabled() || readOnly()) {
      sync();
      return;
    }
    const characters = normalize(raw);
    commit(
      (currentValue.slice(0, index) + characters + currentValue.slice(index + 1)).slice(
        0,
        length(),
      ),
    );
    if (characters) fields[Math.min(fields.length - 1, index + characters.length)]?.focus();
  };
  const input = (event: Event) => {
    if (event.target instanceof HTMLInputElement) {
      updateFromField(event.target, event.target.value);
    }
  };
  const keydown = (event: KeyboardEvent) => {
    if (!(event.target instanceof HTMLInputElement)) return;
    const index = fields.indexOf(event.target);
    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      event.preventDefault();
      const direction = event.key === "ArrowLeft" ? -1 : 1;
      fields[(index + direction + fields.length) % fields.length]?.focus();
    } else if (event.key === "Backspace" || event.key === "Delete") {
      event.preventDefault();
      if (disabled() || readOnly()) {
        sync();
        return;
      }
      if (event.key === "Delete" || currentValue[index]) {
        commit(currentValue.slice(0, index) + currentValue.slice(index + 1));
      } else {
        const previousIndex = Math.max(0, index - 1);
        commit(currentValue.slice(0, previousIndex) + currentValue.slice(previousIndex + 1));
        fields[previousIndex]?.focus();
      }
    }
  };
  const paste = (event: ClipboardEvent) => {
    if (!(event.target instanceof HTMLInputElement)) return;
    event.preventDefault();
    updateFromField(event.target, event.clipboardData?.getData("text") ?? "");
  };

  onMount(() => {
    hiddenInput.type = "hidden";
    hiddenInput.slot = "form-control";
    hiddenInput.dataset.testid ||= BWC_OTP_HIDDEN_INPUT_TEST_ID;
    hiddenInput.id ||= nextId(BWC_OTP_HIDDEN_INPUT_TEST_ID);
    if (hiddenInput.parentElement !== host) host.append(hiddenInput);
    hiddenClassController ??= createPartClassController(
      hiddenInput,
      "otp-hidden-input",
      hiddenInputClass(),
    );
    const dispose = effect(sync);
    host.addEventListener("input", input);
    host.addEventListener("keydown", keydown);
    host.addEventListener("paste", paste);

    return () => {
      dispose();
      host.removeEventListener("input", input);
      host.removeEventListener("keydown", keydown);
      host.removeEventListener("paste", paste);
      associatedForm?.removeEventListener("reset", reset);
      associatedForm = null;
    };
  });

  return html`<slot name="field"></slot><slot name="form-control"></slot>`;
});
