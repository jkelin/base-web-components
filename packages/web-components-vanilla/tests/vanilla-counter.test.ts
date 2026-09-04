import { afterEach, describe, expect, it, vi } from "vitest";
import "../src/index";

const TAG = "vanilla-counter";
const MINUS = "vanilla-counter-minus-button";
const LABEL = "vanilla-counter-label";
const PLUS = "vanilla-counter-plus-button";

function mount(inner: string): HTMLElement {
  // innerHTML insertion connects the parent before its children upgrade,
  // matching parser behavior for unresolved custom elements.
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

describe("vanilla-counter", () => {
  afterEach(() => {
    document.body.replaceChildren();
  });

  it("renders light-DOM children and counts uncontrolled", () => {
    const parent = mount(composed);

    // The controller carries no visuals of its own.
    expect(parent.shadowRoot).toBeNull();

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
    expect(label.textContent).toBe("-1");

    (plus as HTMLButtonElement).click();
    (plus as HTMLButtonElement).click();
    expect(label.textContent).toBe("1");
  });

  it("starts from default-value", () => {
    document.body.innerHTML = `<${TAG} default-value="5">${composed}</${TAG}>`;
    const parent = document.querySelector<HTMLElement>(TAG);
    if (!parent) {
      throw new Error("counter did not mount");
    }
    const { label, plus } = controls(parent);
    expect(label.textContent).toBe("5");

    (plus as HTMLButtonElement).click();
    expect(label.textContent).toBe("6");
  });

  it("supports controlled value with onChange and change events", () => {
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

    const { label, plus } = controls(parent);
    expect(label.textContent).toBe("10");

    // Controlled clicks notify without re-rendering.
    (plus as HTMLButtonElement).click();
    expect(label.textContent).toBe("10");
    expect(onChange).toHaveBeenCalledWith(11);
    expect(onEvent).toHaveBeenCalledWith({ value: 11 });

    // External value sets re-render.
    parent.setAttribute("value", "11");
    expect(label.textContent).toBe("11");
  });

  it("keeps forwarded classes in sync", () => {
    const parent = mount(composed);
    const host = parent.querySelector(MINUS);
    if (!host) {
      throw new Error("minus button did not mount");
    }
    host.setAttribute("class", "px-4 font-bold");
    const button = host.querySelector("button");
    expect(button?.className).toBe("counter-minus-button px-4 font-bold");
  });
});
