import { afterEach, describe, expect, it, vi } from "vitest";
import {
  BWC_OTP_HIDDEN_INPUT_TEST_ID,
  BWC_OTP_INPUT_TEST_ID,
  BwcOtpElement,
  normalizeOtpValue,
} from "./index";

type OtpApi = HTMLElement & {
  value: string;
  defaultValue: string;
  length: number;
  fieldClass: string;
  hiddenInputClass: string;
  onValueChange: ((value: string) => void) | null;
  onValueComplete: ((value: string) => void) | null;
  validationType: "numeric" | "alpha" | "alphanumeric" | "none";
  mask: boolean;
  disabled: boolean;
  readOnly: boolean;
  required: boolean;
  name: string;
  form: string;
  autocomplete: string;
  inputMode: string;
};

function fields(root: HTMLElement): HTMLInputElement[] {
  return [...root.querySelectorAll<HTMLInputElement>(`[data-testid="${BWC_OTP_INPUT_TEST_ID}"]`)];
}

function mount(length = 4, attributes = ""): OtpApi {
  const root = new BwcOtpElement() as OtpApi;
  root.setAttribute("length", String(length));
  for (const attribute of attributes.split(" ").filter(Boolean)) {
    const [name, value = ""] = attribute.split("=");
    root.setAttribute(name!, value.replaceAll('"', ""));
  }
  document.body.append(root);
  return root;
}

function paste(field: HTMLInputElement, text: string): void {
  const event = new Event("paste", { bubbles: true, cancelable: true });
  Object.defineProperty(event, "clipboardData", { value: { getData: () => text } });
  field.dispatchEvent(event);
}

afterEach(() => document.body.replaceChildren());

describe("generated OTP fields", () => {
  it("requires a positive-integer length and generates exactly that many native fields", () => {
    const missing = new BwcOtpElement();
    expect(() => document.body.append(missing)).toThrow(/length must be a positive integer/);

    const root = mount(4);
    expect(fields(root)).toHaveLength(4);
    expect(root.querySelectorAll("input")).toHaveLength(5);
    expect(fields(root).every((field) => field.getAttribute("is") === null)).toBe(true);
    expect(fields(root).every((field) => field.maxLength === 1)).toBe(true);
    expect(fields(root).every((field) => field.slot === "field")).toBe(true);
    expect(
      root.querySelector<HTMLInputElement>(`[data-testid="${BWC_OTP_HIDDEN_INPUT_TEST_ID}"]`)?.slot,
    ).toBe("form-control");
    const fieldSlot = root.shadowRoot?.querySelector<HTMLSlotElement>('slot[name="field"]');
    expect(fieldSlot?.assignedElements()).toEqual(fields(root));
    expect(root.shadowRoot?.querySelector('slot[name="form-control"]')).not.toBeNull();
    expect(() => {
      root.length = 0;
    }).toThrow(/length must be a positive integer/);
    expect(root.length).toBe(4);
  });

  it("coordinates paste, arrows, and backspace", () => {
    const root = mount(4);
    const inputs = fields(root);

    paste(inputs[0]!, "12a34");
    expect(root.value).toBe("1234");
    expect(inputs.map((field) => field.value)).toEqual(["1", "2", "3", "4"]);
    expect(document.activeElement).toBe(inputs[3]);

    inputs[3]!.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "ArrowLeft" }));
    expect(document.activeElement).toBe(inputs[2]);
    inputs[2]!.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "Backspace" }));
    inputs[1]!.focus();
    expect(root.value).toBe("124");
    inputs[1]!.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "Delete" }));
    expect(root.value).toBe("14");
    expect(document.activeElement).toBe(inputs[1]);
  });

  it("supports uncontrolled completion callbacks and composed events", () => {
    const root = mount(2);
    const inputs = fields(root);
    const change = vi.fn();
    const complete = vi.fn();
    const event = vi.fn();
    root.onValueChange = change;
    root.onValueComplete = complete;
    root.addEventListener("value-complete", (nextEvent) =>
      event((nextEvent as CustomEvent<{ value: string }>).detail),
    );

    inputs[0]!.value = "1";
    inputs[0]!.dispatchEvent(new Event("input", { bubbles: true }));
    inputs[1]!.value = "2";
    inputs[1]!.dispatchEvent(new Event("input", { bubbles: true }));
    expect(root.value).toBe("12");
    expect(change).toHaveBeenCalledTimes(2);
    expect(complete).toHaveBeenCalledWith("12");
    expect(event).toHaveBeenCalledWith({ value: "12" });
    inputs[1]!.dispatchEvent(new Event("input", { bubbles: true }));
    expect(change).toHaveBeenCalledTimes(2);
    expect(complete).toHaveBeenCalledTimes(1);
  });

  it("keeps controlled state while reporting requested values", () => {
    const root = mount(2);
    const inputs = fields(root);
    const change = vi.fn();
    root.value = "12";
    root.onValueChange = change;

    inputs[0]!.value = "9";
    inputs[0]!.dispatchEvent(new Event("input", { bubbles: true }));
    expect(change).toHaveBeenCalledWith("92");
    expect(root.value).toBe("12");
    expect(inputs.map((field) => field.value)).toEqual(["1", "2"]);
    inputs[0]!.value = "1";
    inputs[0]!.dispatchEvent(new Event("input", { bubbles: true }));
    expect(change).toHaveBeenCalledTimes(1);
    expect(inputs.map((field) => field.value)).toEqual(["1", "2"]);
  });

  it.each(["default-value", "value"])("hydrates the full initial %s", (attribute) => {
    const root = mount(4, `${attribute}="1234"`);
    expect(root.value).toBe("1234");
    expect(fields(root).map((field) => field.value)).toEqual(["1", "2", "3", "4"]);
  });

  it("preserves value and behavior across length changes and reconnects", () => {
    const root = mount(4, 'default-value="1234"');
    const originalFirst = fields(root)[0];
    originalFirst!.focus();
    originalFirst!.setSelectionRange(0, 1);
    expect(document.activeElement).toBe(originalFirst);
    expect(originalFirst!.selectionStart).toBe(0);
    expect(originalFirst!.selectionEnd).toBe(1);

    root.length = 6;
    expect(root.value).toBe("1234");
    expect(fields(root)).toHaveLength(6);
    expect(fields(root)[0]).toBe(originalFirst);
    expect(document.activeElement).toBe(originalFirst);
    expect(originalFirst!.selectionStart).toBe(0);
    expect(originalFirst!.selectionEnd).toBe(1);
    root.value = "987654";
    expect(fields(root).map((field) => field.value)).toEqual(["9", "8", "7", "6", "5", "4"]);
    const removedTail = fields(root).at(-1);
    removedTail!.focus();
    expect(document.activeElement).toBe(removedTail);

    root.length = 3;
    expect(root.value).toBe("987");
    expect(fields(root)).toHaveLength(3);
    expect(document.activeElement).toBe(document.body);
    root.remove();
    document.body.append(root);
    expect(root.value).toBe("987");
    expect(fields(root)[0]).toBe(originalFirst);
    expect(fields(root).map((field) => field.value)).toEqual(["9", "8", "7"]);
  });

  it("restores the uncontrolled default on form reset", () => {
    document.body.innerHTML =
      '<form><bwc-otp length="4" default-value="1234" name="code"></bwc-otp></form>';
    const form = document.querySelector<HTMLFormElement>("form");
    const root = document.querySelector<OtpApi>("bwc-otp");
    if (!form || !root) throw new Error("resettable OTP did not mount");

    fields(root)[0]!.value = "9";
    fields(root)[0]!.dispatchEvent(new Event("input", { bubbles: true }));
    expect(root.value).toBe("9234");
    form.reset();
    expect(root.value).toBe("1234");
    expect(fields(root).map((field) => field.value)).toEqual(["1", "2", "3", "4"]);
  });

  it("keeps controlled state coherent when an external owner form resets", () => {
    document.body.innerHTML =
      '<form id="owner"></form><bwc-otp length="4" form="owner" default-value="1234" name="code"></bwc-otp>';
    const form = document.querySelector<HTMLFormElement>("form");
    const root = document.querySelector<OtpApi>("bwc-otp");
    if (!form || !root) throw new Error("externally owned OTP did not mount");

    root.value = "9876";
    form.reset();
    expect(root.value).toBe("9876");
    expect(fields(root).map((field) => field.value)).toEqual(["9", "8", "7", "6"]);
    expect([...new FormData(form).entries()]).toEqual([["code", "9876"]]);
  });

  it("applies part classes and configures one form input", () => {
    const root = mount(2, 'field-class="shared-field" hidden-input-class="submission" name="code"');
    const inputs = fields(root);
    const hidden = root.querySelector<HTMLInputElement>(
      `[data-testid="${BWC_OTP_HIDDEN_INPUT_TEST_ID}"]`,
    );

    expect(inputs.map((field) => field.className)).toEqual([
      "otp-field shared-field",
      "otp-field shared-field",
    ]);
    expect(inputs.every((field) => field.id.startsWith("bwc-otp-input-"))).toBe(true);
    expect(hidden?.className).toBe("otp-hidden-input submission");
    expect(hidden?.name).toBe("code");

    root.fieldClass = "next-field";
    root.hiddenInputClass = "next-hidden";
    expect(inputs[0]?.className).toBe("otp-field next-field");
    expect(hidden?.className).toBe("otp-hidden-input next-hidden");
  });

  it("uses native form validity and submission gating", () => {
    document.body.innerHTML =
      '<form id="verification"><bwc-otp length="2" name="code" required></bwc-otp></form>';
    const form = document.querySelector<HTMLFormElement>("form");
    const root = document.querySelector<OtpApi>("bwc-otp");
    if (!form || !root) throw new Error("form OTP did not mount");

    expect(form.checkValidity()).toBe(false);
    fields(root)[0]!.value = "1";
    fields(root)[0]!.dispatchEvent(new Event("input", { bubbles: true }));
    fields(root)[1]!.value = "2";
    fields(root)[1]!.dispatchEvent(new Event("input", { bubbles: true }));
    expect(form.checkValidity()).toBe(true);
    expect([...new FormData(form).entries()]).toEqual([["code", "12"]]);

    root.disabled = true;
    expect(fields(root).every((field) => field.disabled)).toBe(true);
    expect(form.checkValidity()).toBe(true);
    expect([...new FormData(form).entries()]).toEqual([]);
  });

  it("preserves authored light-DOM content while resizing generated fields", () => {
    document.body.innerHTML = '<bwc-otp length="2"><span data-author>Help</span></bwc-otp>';
    const root = document.querySelector<OtpApi>("bwc-otp");
    if (!root) throw new Error("authored OTP did not mount");

    root.length = 3;
    expect(root.querySelector("[data-author]")?.textContent).toBe("Help");
    expect(fields(root)).toHaveLength(3);
  });
});

describe("OTP normalization", () => {
  it.each([
    ["1a23-4", "numeric", 4, "1234"],
    ["1A-2b", "alpha", 3, "Ab"],
    ["a-1_B2", "alphanumeric", 4, "a1B2"],
    ["a-1", "none", 2, "a-"],
  ] as const)("normalizes %s", (input, validationType, length, expected) => {
    expect(normalizeOtpValue(input, validationType, length)).toBe(expected);
  });
});
