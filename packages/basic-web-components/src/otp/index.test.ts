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
    expect(() => {
      root.length = 0;
    }).toThrow(/length must be a positive integer/);
    expect(() => root.setAttribute("length", "2.5")).toThrow(/length must be a positive integer/);
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
    expect(root.value).toBe("124");
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
    inputs[0]!.dispatchEvent(new Event("input"));
    inputs[1]!.value = "2";
    inputs[1]!.dispatchEvent(new Event("input"));
    expect(root.value).toBe("12");
    expect(change).toHaveBeenCalledTimes(2);
    expect(complete).toHaveBeenCalledWith("12");
    expect(event).toHaveBeenCalledWith({ value: "12" });
  });

  it("keeps controlled state while reporting requested values", () => {
    const root = mount(2);
    const inputs = fields(root);
    const change = vi.fn();
    root.value = "12";
    root.onValueChange = change;

    inputs[0]!.value = "9";
    inputs[0]!.dispatchEvent(new Event("input"));
    expect(change).toHaveBeenCalledWith("92");
    expect(root.value).toBe("12");
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

    root.length = 6;
    expect(root.value).toBe("1234");
    expect(fields(root)).toHaveLength(6);
    expect(fields(root)[0]).toBe(originalFirst);
    root.value = "987654";
    expect(fields(root).map((field) => field.value)).toEqual(["9", "8", "7", "6", "5", "4"]);

    root.length = 3;
    expect(root.value).toBe("987");
    expect(fields(root)).toHaveLength(3);
    root.remove();
    document.body.append(root);
    expect(root.value).toBe("987");
    expect(fields(root).map((field) => field.value)).toEqual(["9", "8", "7"]);
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
