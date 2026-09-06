import { defineComponent, effect, html, onMount, signal, useHost, useProp } from "microfw";
import {
  booleanProp,
  callbackProp,
  createPartClassController,
  emit,
  enumProp,
  finiteNumber,
  nextId,
  numberProp,
  setAttributeValue,
  removeAttributeValue,
  stringProp,
  toggleState,
  type ChangeCallback,
} from "../shared";

export const BWC_OTP_TAG = "bwc-otp";
export const BWC_OTP_INPUT_TEST_ID = "bwc-otp-input";
export const BWC_OTP_HIDDEN_INPUT_TEST_ID = "bwc-otp-hidden-input";

type ValidationType = "numeric" | "alpha" | "alphanumeric" | "none";
type ClassController = (partClass?: string | null) => void;
type OtpFieldPart = {
  field: HTMLInputElement;
  bind: () => () => void;
  dispose: (() => void) | undefined;
};

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
  const currentValue = signal("");
  const fieldParts = signal<HTMLInputElement[]>([]);
  const paintRevision = signal(0);
  let paintVersion = 0;
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
    get: () => currentValue(),
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

  const fields: OtpFieldPart[] = [];
  const classControllers = new WeakMap<HTMLInputElement, ClassController>();
  const hiddenTemplate = html`
    <input slot="form-control" data-testid="bwc-otp-hidden-input" type="hidden" />
  `;
  const hiddenInput = hiddenTemplate.fragment.querySelector("input");
  if (!hiddenInput) throw new TypeError("bwc-otp hidden input template is invalid");
  let hiddenClassController: ClassController | undefined;
  let associatedForm: HTMLFormElement | null = null;
  let mounted = false;

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
    const next = defaultValue();
    if (next === currentValue()) paintRevision(++paintVersion);
    else currentValue(next);
  };
  const updateFormListener = () => {
    const nextForm = hiddenInput.form;
    if (nextForm === associatedForm) return;
    associatedForm?.removeEventListener("reset", reset);
    associatedForm = nextForm;
    associatedForm?.addEventListener("reset", reset);
  };
  const reconcileFields = (count: number) => {
    // Surviving fields retain IDs, focus, selection, and author classes.
    while (fields.length < count) {
      const template = html` <input slot="field" data-testid="bwc-otp-input" maxlength="1" /> `;
      const field = template.fragment.querySelector("input");
      if (!field) throw new TypeError("bwc-otp field template is invalid");
      field.id = nextId(BWC_OTP_INPUT_TEST_ID);
      const part: OtpFieldPart = { field, bind: template.bind, dispose: undefined };
      fields.push(part);
      host.insertBefore(field, hiddenInput.parentElement === host ? hiddenInput : null);
      if (mounted) part.dispose = template.bind();
    }
    while (fields.length > count) {
      const part = fields.pop();
      part?.dispose?.();
      part?.field.remove();
    }
    for (const { field } of fields) {
      if (field.parentElement !== host) host.insertBefore(field, hiddenInput);
    }
    fieldParts(fields.map(({ field }) => field));
  };
  const commit = (next: string) => {
    const normalized = normalize(next);
    if (normalized === currentValue()) {
      paintRevision(++paintVersion);
      return;
    }
    emit(host, onValueChange(), "value-change", "value", normalized);
    if (normalized.length === length()) {
      emit(host, onValueComplete(), "value-complete", "value", normalized);
    }
    if (!controlled) currentValue(normalized);
    else paintRevision(++paintVersion);
  };
  const updateFromField = (field: HTMLInputElement, raw: string) => {
    const currentFields = fieldParts();
    const index = currentFields.indexOf(field);
    if (index < 0 || disabled() || readOnly()) {
      paintRevision(++paintVersion);
      return;
    }
    const characters = normalize(raw);
    const current = currentValue();
    commit((current.slice(0, index) + characters + current.slice(index + 1)).slice(0, length()));
    if (characters) {
      currentFields[Math.min(currentFields.length - 1, index + characters.length)]?.focus();
    }
  };
  const input = (event: Event) => {
    if (event.target instanceof HTMLInputElement) {
      updateFromField(event.target, event.target.value);
    }
  };
  const keydown = (event: KeyboardEvent) => {
    if (!(event.target instanceof HTMLInputElement)) return;
    const currentFields = fieldParts();
    const index = currentFields.indexOf(event.target);
    if (index < 0) return;
    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      event.preventDefault();
      const direction = event.key === "ArrowLeft" ? -1 : 1;
      currentFields[(index + direction + currentFields.length) % currentFields.length]?.focus();
    } else if (event.key === "Backspace" || event.key === "Delete") {
      event.preventDefault();
      if (disabled() || readOnly()) {
        paintRevision(++paintVersion);
        return;
      }
      const current = currentValue();
      if (event.key === "Delete" || current[index]) {
        commit(current.slice(0, index) + current.slice(index + 1));
      } else {
        const previousIndex = Math.max(0, index - 1);
        commit(current.slice(0, previousIndex) + current.slice(previousIndex + 1));
        currentFields[previousIndex]?.focus();
      }
    }
  };
  const paste = (event: ClipboardEvent) => {
    if (!(event.target instanceof HTMLInputElement)) return;
    event.preventDefault();
    updateFromField(event.target, event.clipboardData?.getData("text") ?? "");
  };

  onMount(() => {
    hiddenInput.id ||= nextId(BWC_OTP_HIDDEN_INPUT_TEST_ID);
    if (hiddenInput.parentElement !== host) host.append(hiddenInput);
    const disposeHiddenTemplate = hiddenTemplate.bind();
    mounted = true;
    for (const part of fields) part.dispose ??= part.bind();
    const disposeTemplates = () => {
      mounted = false;
      for (const part of fields) {
        part.dispose?.();
        part.dispose = undefined;
      }
      disposeHiddenTemplate();
    };
    try {
      hiddenClassController ??= createPartClassController(
        hiddenInput,
        "otp-hidden-input",
        hiddenInputClass(),
      );
      const stopStructure = effect(() => {
        reconcileFields(length());
      });
      const stopControl = effect(() => {
        const requestedValue = value();
        if (requestedValue !== "") controlled = true;
        let next = currentValue();
        if (!initialized) {
          initialized = true;
          next = controlled ? normalize(requestedValue) : normalize(defaultValue());
        } else if (controlled) {
          next = normalize(requestedValue);
        } else {
          next = normalize(next);
        }
        if (next !== currentValue()) currentValue(next);
      });
      const stopClasses = effect(() => {
        for (const field of fieldParts()) applyFieldClass(field);
        hiddenClassController?.(hiddenInputClass());
      });
      const stopFields = effect(() => {
        paintRevision();
        const currentFields = fieldParts();
        const current = currentValue();
        const count = currentFields.length;
        const isDisabled = disabled();
        const isReadOnly = readOnly();
        const isRequired = required();
        const fieldAutocomplete = autocomplete();
        const fieldInputMode = inputMode() || (validationType() === "numeric" ? "numeric" : "text");
        const fieldForm = form();
        const masked = mask();
        const normalizedDefault = controlled ? current : defaultValue();
        currentFields.forEach((field, index) => {
          applyFieldClass(field);
          const fieldValue = current[index] ?? "";
          const nextDefault = normalizedDefault[index] ?? "";
          const nextType = masked ? "password" : "text";
          if (field.type !== nextType) field.type = nextType;
          if (field.value !== fieldValue) field.value = fieldValue;
          if (field.defaultValue !== nextDefault) field.defaultValue = nextDefault;
          if (field.disabled !== isDisabled) field.disabled = isDisabled;
          if (field.readOnly !== isReadOnly) field.readOnly = isReadOnly;
          if (field.required !== isRequired) field.required = isRequired;
          setAttributeValue(field, "autocomplete", fieldAutocomplete);
          if (field.inputMode !== fieldInputMode) field.inputMode = fieldInputMode;
          const cursor = isDisabled ? "not-allowed" : "text";
          if (field.style.cursor !== cursor) field.style.cursor = cursor;
          setAttributeValue(field, "aria-label", `Character ${index + 1} of ${count}`);
          if (fieldForm) setAttributeValue(field, "form", fieldForm);
          else removeAttributeValue(field, "form");
          toggleState(field, "data-complete", Boolean(fieldValue));
          toggleState(field, "data-disabled", isDisabled);
          toggleState(field, "data-readonly", isReadOnly);
          toggleState(field, "data-required", isRequired);
        });
        toggleState(host, "data-complete", current.length === count);
        toggleState(host, "data-disabled", isDisabled);
        toggleState(host, "data-readonly", isReadOnly);
        toggleState(host, "data-required", isRequired);
      });
      const stopSubmission = effect(() => {
        paintRevision();
        const current = currentValue();
        const normalizedDefault = controlled ? current : defaultValue();
        if (hiddenInput.defaultValue !== normalizedDefault) {
          hiddenInput.defaultValue = normalizedDefault;
        }
        if (hiddenInput.value !== current) hiddenInput.value = current;
      });
      const stopHiddenDisabled = effect(() => {
        const isDisabled = disabled();
        if (hiddenInput.disabled !== isDisabled) hiddenInput.disabled = isDisabled;
      });
      const stopFormIdentity = effect(() => {
        const hiddenName = name();
        if (hiddenInput.name !== hiddenName) hiddenInput.name = hiddenName;
        const fieldForm = form();
        if (fieldForm) setAttributeValue(hiddenInput, "form", fieldForm);
        else removeAttributeValue(hiddenInput, "form");
        updateFormListener();
      });
      host.addEventListener("input", input);
      host.addEventListener("keydown", keydown);
      host.addEventListener("paste", paste);

      return () => {
        stopFormIdentity();
        stopHiddenDisabled();
        stopSubmission();
        stopFields();
        stopClasses();
        stopControl();
        stopStructure();
        host.removeEventListener("input", input);
        host.removeEventListener("keydown", keydown);
        host.removeEventListener("paste", paste);
        associatedForm?.removeEventListener("reset", reset);
        associatedForm = null;
        disposeTemplates();
        fieldParts([]);
      };
    } catch (error) {
      disposeTemplates();
      throw error;
    }
  });

  return html`<slot name="field"></slot><slot name="form-control"></slot>`;
});
