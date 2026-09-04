import { afterEach, describe, expect, it, vi } from "vitest";
import "../src/index";

const TAG = "preact-counter";
const MINUS = "preact-counter-minus-button";
const LABEL = "preact-counter-label";
const PLUS = "preact-counter-plus-button";

function mount(inner: string): HTMLElement {
  // This preserves parser upgrade order: the parent connects before its children.
  document.body.innerHTML = `<${TAG}>${inner}</${TAG}>`;
  const parent = document.querySelector<HTMLElement>(TAG);
  if (!parent) {
    throw new Error("counter did not mount");
  }

  return parent;
}

function controls(parent: HTMLElement) {
  const minus = parent.querySelector(`${MINUS} > button`);
  const label = parent.querySelector(`${LABEL} > span`);
  const plus = parent.querySelector(`${PLUS} > button`);
  if (!minus || !label || !plus) {
    throw new Error("counter children did not render");
  }

  return { minus, label, plus };
}

const composed = `<${MINUS} class="btn"></${MINUS}><${LABEL} class="lbl"></${LABEL}><${PLUS} class="btn"></${PLUS}>`;

describe("preact-counter", () => {
  afterEach(() => {
    document.body.replaceChildren();
  });

  it("renders light-DOM children and counts uncontrolled", async () => {
    const parent = mount(composed);

    expect(parent.shadowRoot).toBeNull();
    await vi.waitFor(() => expect(parent.querySelector("button")).not.toBeNull());

    const { minus, label, plus } = controls(parent);
    expect(minus.getAttribute("aria-label")).toBe("Decrement count");
    expect(minus.getAttribute("data-testid")).toBe(MINUS);
    expect(minus.className).toBe("counter-minus-button btn");
    expect(minus.textContent).toBe("−");
    expect(label.getAttribute("aria-live")).toBe("polite");
    expect(label.getAttribute("data-testid")).toBe(LABEL);
    expect(label.className).toBe("counter-label lbl");
    expect(label.textContent).toBe("0");
    expect(plus.getAttribute("data-testid")).toBe(PLUS);
    expect(plus.className).toBe("counter-plus-button btn");

    (minus as HTMLButtonElement).click();
    await vi.waitFor(() => expect(label.textContent).toBe("-1"));

    (plus as HTMLButtonElement).click();
    (plus as HTMLButtonElement).click();
    await vi.waitFor(() => expect(label.textContent).toBe("1"));
  });

  it("starts from default-value", async () => {
    document.body.innerHTML = `<${TAG} default-value="5">${composed}</${TAG}>`;
    const parent = document.querySelector<HTMLElement>(TAG);
    if (!parent) {
      throw new Error("counter did not mount");
    }

    await vi.waitFor(() => expect(parent.querySelector(`${LABEL} > span`)).not.toBeNull());
    const { label, plus } = controls(parent);
    expect(label.textContent).toBe("5");

    (plus as HTMLButtonElement).click();
    await vi.waitFor(() => expect(label.textContent).toBe("6"));
  });

  it("supports controlled value with onChange and change events", async () => {
    const onChange = vi.fn();
    const onEvent = vi.fn();
    document.body.innerHTML = `<${TAG} value="10">${composed}</${TAG}>`;
    const parent = document.querySelector<HTMLElement>(TAG);
    if (!parent) {
      throw new Error("counter did not mount");
    }

    (parent as HTMLElement & { onChange: unknown }).onChange = onChange;
    parent.addEventListener("change", (event) => {
      onEvent((event as CustomEvent).detail);
    });

    await vi.waitFor(() => expect(parent.querySelector(`${LABEL} > span`)).not.toBeNull());
    const { label, plus } = controls(parent);
    expect(label.textContent).toBe("10");

    (plus as HTMLButtonElement).click();
    await vi.waitFor(() => expect(onChange).toHaveBeenCalledWith(11));
    expect(label.textContent).toBe("10");
    expect(onEvent).toHaveBeenCalledWith({ value: 11 });

    parent.setAttribute("value", "11");
    await vi.waitFor(() => expect(label.textContent).toBe("11"));
  });

  it("keeps forwarded classes in sync", async () => {
    const parent = mount(composed);
    await vi.waitFor(() => expect(parent.querySelector(`${MINUS} > button`)).not.toBeNull());
    const host = parent.querySelector(MINUS);
    if (!host) {
      throw new Error("minus button did not mount");
    }

    host.setAttribute("class", "px-4 font-bold");
    await vi.waitFor(() =>
      expect(host.querySelector("button")?.className).toBe("counter-minus-button px-4 font-bold"),
    );
  });
});
