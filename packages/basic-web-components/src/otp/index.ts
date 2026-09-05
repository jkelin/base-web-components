import {
  booleanValue,
  callbackValue,
  createPartClassController,
  defineComponent,
  emit,
  enumValue,
  finiteNumber,
  nextId,
  useEffects,
  type ChangeCallback,
} from "../shared";

export const BWC_OTP_TAG = "bwc-otp";
export const BWC_OTP_INPUT_TEST_ID = "bwc-otp-input";
export const BWC_OTP_HIDDEN_INPUT_TEST_ID = "bwc-otp-hidden-input";

type ValidationType = "numeric" | "alpha" | "alphanumeric" | "none";
type ClassController = (partClass?: string | null) => void;
type OtpState = {
  classControllers: WeakMap<HTMLInputElement, ClassController>;
  controlled: boolean;
  fields: HTMLInputElement[];
  listenersConnected: boolean;
  hiddenClassController: ClassController | undefined;
  hiddenInput: HTMLInputElement;
  initialized: boolean;
  onValueChange: ChangeCallback<string>;
  onValueComplete: ChangeCallback<string>;
  value: string;
};

const validationTypes = ["numeric", "alpha", "alphanumeric", "none"] as const;
const otpProperties = {
  length: "length",
  validationType: "validation-type",
  value: "value",
  defaultValue: "default-value",
  mask: "mask",
  disabled: "disabled",
  readOnly: "readonly",
  required: "required",
  name: "name",
  form: "form",
  autocomplete: "autocomplete",
  inputMode: "inputmode",
  fieldClass: "field-class",
  hiddenInputClass: "hidden-input-class",
  onValueChange: null,
  onValueComplete: null,
} as const;

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

export const BwcOtpElement = defineComponent<OtpState, HTMLElement, typeof otpProperties>(
  BWC_OTP_TAG,
  HTMLElement,
  otpProperties,
  (element, props, context, properties) => {
    const previous = context();
    const state: OtpState =
      "fields" in previous
        ? previous
        : {
            classControllers: new WeakMap(),
            controlled: props.value() !== null,
            fields: [],
            hiddenClassController: undefined,
            hiddenInput: document.createElement("input"),
            initialized: false,
            listenersConnected: false,
            onValueChange: null,
            onValueComplete: null,
            value: "",
          };
    context(state);

    const hiddenInput = state.hiddenInput;
    hiddenInput.type = "hidden";
    hiddenInput.dataset.testid ||= BWC_OTP_HIDDEN_INPUT_TEST_ID;
    hiddenInput.id ||= nextId(BWC_OTP_HIDDEN_INPUT_TEST_ID);
    const applyHiddenClass =
      state.hiddenClassController ??
      createPartClassController(hiddenInput, "otp-hidden-input", props.hiddenInputClass());
    state.hiddenClassController = applyHiddenClass;
    const length = () => positiveInteger(props.length(), "length");
    const validationType = () =>
      enumValue(props.validationType(), validationTypes, "numeric", "validationType");
    const normalize = (raw: string) => normalizeOtpValue(raw, validationType(), length());

    const applyFieldClass = (field: HTMLInputElement) => {
      const existing = state.classControllers.get(field);
      const apply = existing ?? createPartClassController(field, "otp-field", props.fieldClass());
      if (!existing) state.classControllers.set(field, apply);
      apply(props.fieldClass());
    };
    const reconcileFields = (count: number) => {
      // Reuse surviving fields so length changes preserve stable IDs, focus targets, and author state.
      while (state.fields.length < count) {
        const field = document.createElement("input");
        field.id = nextId(BWC_OTP_INPUT_TEST_ID);
        field.dataset.testid = BWC_OTP_INPUT_TEST_ID;
        field.maxLength = 1;
        if (state.listenersConnected) {
          field.addEventListener("input", input);
          field.addEventListener("keydown", keydown);
          field.addEventListener("paste", paste);
        }
        state.fields.push(field);
      }
      while (state.fields.length > count) {
        const field = state.fields.pop();
        if (!field) break;
        field.removeEventListener("input", input);
        field.removeEventListener("keydown", keydown);
        field.removeEventListener("paste", paste);
        field.remove();
      }
      const expectedChildren = [...state.fields, hiddenInput];
      if (
        element.childNodes.length !== expectedChildren.length ||
        expectedChildren.some((child, index) => element.childNodes[index] !== child)
      ) {
        element.replaceChildren(...expectedChildren);
      }
    };
    const sync = () => {
      const count = length();
      reconcileFields(count);
      if (!state.initialized) {
        state.initialized = true;
        state.value = normalize(
          props.value() ?? (state.controlled ? "" : (props.defaultValue() ?? "")),
        );
      } else {
        state.value = normalize(state.value);
      }

      const disabled = props.disabled() !== null;
      const readOnly = props.readOnly() !== null;
      const required = props.required() !== null;
      const autocomplete = props.autocomplete() ?? "one-time-code";
      const inputMode = props.inputMode() ?? (validationType() === "numeric" ? "numeric" : "text");
      const masked = props.mask() !== null;
      state.fields.forEach((field, index) => {
        applyFieldClass(field);
        field.type = masked ? "password" : "text";
        field.value = state.value[index] ?? "";
        field.disabled = disabled;
        field.readOnly = readOnly;
        field.required = required;
        field.setAttribute("autocomplete", autocomplete);
        field.inputMode = inputMode;
        field.style.cursor = disabled ? "not-allowed" : "text";
        field.setAttribute("aria-label", `Character ${index + 1} of ${count}`);
        field.toggleAttribute("data-complete", Boolean(field.value));
        field.toggleAttribute("data-disabled", disabled);
        field.toggleAttribute("data-readonly", readOnly);
        field.toggleAttribute("data-required", required);
      });

      applyHiddenClass(props.hiddenInputClass());
      hiddenInput.value = state.value;
      for (const [name, value] of Object.entries({ name: props.name(), form: props.form() })) {
        if (value === null) hiddenInput.removeAttribute(name);
        else hiddenInput.setAttribute(name, value);
      }
      element.toggleAttribute("data-complete", state.value.length === count);
      element.toggleAttribute("data-disabled", disabled);
      element.toggleAttribute("data-readonly", readOnly);
      element.toggleAttribute("data-required", required);
    };
    const commit = (next: string) => {
      const normalized = normalize(next);
      emit(element, state.onValueChange, "value-change", "value", normalized);
      if (normalized.length === length()) {
        emit(element, state.onValueComplete, "value-complete", "value", normalized);
      }
      if (!state.controlled) state.value = normalized;
      sync();
    };
    const updateFromField = (field: HTMLInputElement, raw: string) => {
      const index = state.fields.indexOf(field);
      if (index < 0) return;
      const characters = normalize(raw);
      commit(
        (state.value.slice(0, index) + characters + state.value.slice(index + 1)).slice(
          0,
          length(),
        ),
      );
      if (characters) {
        state.fields[Math.min(state.fields.length - 1, index + characters.length)]?.focus();
      }
    };
    const input = (event: Event) => {
      if (event.currentTarget instanceof HTMLInputElement) {
        updateFromField(event.currentTarget, event.currentTarget.value);
      }
    };
    const keydown = (event: KeyboardEvent) => {
      if (!(event.currentTarget instanceof HTMLInputElement)) return;
      const index = state.fields.indexOf(event.currentTarget);
      if (index < 0) return;
      if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
        event.preventDefault();
        const direction = event.key === "ArrowLeft" ? -1 : 1;
        state.fields[(index + direction + state.fields.length) % state.fields.length]?.focus();
      } else if (event.key === "Backspace") {
        event.preventDefault();
        if (state.value[index]) {
          commit(state.value.slice(0, index) + state.value.slice(index + 1));
        } else {
          const previousIndex = Math.max(0, index - 1);
          commit(state.value.slice(0, previousIndex) + state.value.slice(previousIndex + 1));
          state.fields[previousIndex]?.focus();
        }
      }
    };
    const paste = (event: ClipboardEvent) => {
      if (!(event.currentTarget instanceof HTMLInputElement)) return;
      event.preventDefault();
      updateFromField(event.currentTarget, event.clipboardData?.getData("text") ?? "");
    };

    properties.install({
      length: {
        get: length,
        set: (next) => element.setAttribute("length", String(positiveInteger(next, "length"))),
      },
      validationType: {
        get: validationType,
        set: (next) =>
          element.setAttribute(
            "validation-type",
            enumValue(String(next), validationTypes, "numeric", "validationType"),
          ),
      },
      value: {
        get: () => state.value,
        set: (next) => {
          state.controlled = true;
          element.setAttribute("value", normalize(String(next)));
        },
      },
      defaultValue: {
        get: () => normalize(props.defaultValue() ?? ""),
        set: (next) => element.setAttribute("default-value", normalize(String(next))),
      },
      mask: {
        get: () => props.mask() !== null,
        set: (next) => element.toggleAttribute("mask", booleanValue(next, "mask")),
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
      form: {
        get: () => props.form() ?? "",
        set: (next) => element.setAttribute("form", String(next)),
      },
      autocomplete: {
        get: () => props.autocomplete() ?? "one-time-code",
        set: (next) => element.setAttribute("autocomplete", String(next)),
      },
      inputMode: {
        get: () => props.inputMode() ?? (validationType() === "numeric" ? "numeric" : "text"),
        set: (next) => element.setAttribute("inputmode", String(next)),
      },
      fieldClass: {
        get: () => props.fieldClass() ?? "",
        set: (next) => element.setAttribute("field-class", String(next)),
      },
      hiddenInputClass: {
        get: () => props.hiddenInputClass() ?? "",
        set: (next) => element.setAttribute("hidden-input-class", String(next)),
      },
      onValueChange: {
        get: () => state.onValueChange,
        set: (next) => {
          state.onValueChange = callbackValue<string>(next, "onValueChange");
        },
      },
      onValueComplete: {
        get: () => state.onValueComplete,
        set: (next) => {
          state.onValueComplete = callbackValue<string>(next, "onValueComplete");
        },
      },
    });

    state.listenersConnected = true;
    for (const field of state.fields) {
      field.addEventListener("input", input);
      field.addEventListener("keydown", keydown);
      field.addEventListener("paste", paste);
    }
    const dispose = useEffects(() => {
      const controlledValue = props.value();
      if (controlledValue !== null) {
        state.controlled = true;
        state.value = normalize(controlledValue);
      } else if (state.controlled) {
        state.value = "";
      }
      sync();
    });
    return {
      disconnect() {
        dispose();
        state.listenersConnected = false;
        for (const field of state.fields) {
          field.removeEventListener("input", input);
          field.removeEventListener("keydown", keydown);
          field.removeEventListener("paste", paste);
        }
      },
    };
  },
);
