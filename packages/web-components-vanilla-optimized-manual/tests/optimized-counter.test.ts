import { afterEach, describe, expect, it, vi } from "vitest";
import "../src/index";

const TAG = "manually-optimized-counter";
const MINUS = "manually-optimized-counter-minus-button";
const LABEL = "manually-optimized-counter-label";
const PLUS = "manually-optimized-counter-plus-button";

const composed = `<button is="${MINUS}" class="btn"></button><span is="${LABEL}" class="lbl"></span><button is="${PLUS}" class="btn"></button>`;

type CounterElement = HTMLElement & {
  defaultValue: number;
  onChange?: (value: number) => void;
  value: number;
};

function mount(attributes = ""): CounterElement {
  document.body.innerHTML = `<${TAG}${attributes}>${composed}</${TAG}>`;
  const parent = document.querySelector<CounterElement>(TAG);
  if (!parent) throw new Error("counter did not mount");
  return parent;
}

function controls(parent: HTMLElement) {
  const minus = parent.querySelector<HTMLButtonElement>(`button[is="${MINUS}"]`);
  const label = parent.querySelector<HTMLElement>(`span[is="${LABEL}"]`);
  const plus = parent.querySelector<HTMLButtonElement>(`button[is="${PLUS}"]`);
  if (!minus || !label || !plus) throw new Error("counter children did not render");
  return { minus, label, plus };
}

// Module-local render context is sequential; clearing the document isolates each case.
describe("manually optimized vanilla counter", () => {
  afterEach(() => {
    document.body.replaceChildren();
  });

  it("renders light-DOM children and counts uncontrolled", () => {
    const parent = mount();
    expect(parent.shadowRoot).toBeNull();

    const { minus, label, plus } = controls(parent);
    expect(minus.getAttribute("aria-label")).toBe("Remove count");
    expect(minus.getAttribute("data-testid")).toBe(MINUS);
    expect(minus.className).toBe("btn counter-minus-button");
    expect(minus.type).toBe("button");
    expect(minus.style.cursor).toBe("pointer");
    expect(minus.textContent).toBe("-");
    expect(label.getAttribute("aria-live")).toBe("polite");
    expect(label.getAttribute("data-testid")).toBe(LABEL);
    expect(label.className).toBe("lbl counter-label");
    expect(label.textContent).toBe("0");
    expect(plus.getAttribute("aria-label")).toBe("Add count");
    expect(plus.getAttribute("data-testid")).toBe(PLUS);
    expect(plus.className).toBe("btn counter-plus-button");
    expect(plus.type).toBe("button");

    minus.click();
    expect(label.textContent).toBe("-1");
    plus.click();
    plus.click();
    expect(label.textContent).toBe("1");
  });

  it("starts from default-value and supports the defaultValue property", () => {
    const attributed = mount(' default-value="5"');
    let controlsForCounter = controls(attributed);
    expect(controlsForCounter.label.textContent).toBe("5");
    controlsForCounter.plus.click();
    expect(controlsForCounter.label.textContent).toBe("6");

    document.body.replaceChildren();
    const propertyInitialized = document.createElement(TAG) as CounterElement;
    propertyInitialized.defaultValue = 7.9;
    propertyInitialized.innerHTML = composed;
    document.body.append(propertyInitialized);
    controlsForCounter = controls(propertyInitialized);
    expect(propertyInitialized.defaultValue).toBe(7);
    expect(controlsForCounter.label.textContent).toBe("7");
  });

  it("supports controlled value with onChange and a composed change event", () => {
    const onChange = vi.fn();
    const onEvent = vi.fn();
    const parent = mount(' value="10"');
    parent.onChange = onChange;
    parent.addEventListener("change", (event) => {
      const customEvent = event as CustomEvent<{ value: number }>;
      onEvent(customEvent.detail, customEvent.composed);
    });

    const { label, plus } = controls(parent);
    plus.click();
    expect(label.textContent).toBe("10");
    expect(onChange).toHaveBeenCalledWith(11);
    expect(onEvent).toHaveBeenCalledWith({ value: 11 }, true);

    parent.value = Number.POSITIVE_INFINITY;
    expect(parent.getAttribute("value")).toBe("0");
    expect(label.textContent).toBe("0");
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onEvent).toHaveBeenCalledTimes(1);
  });

  it("keeps forwarded classes in sync", () => {
    const parent = mount();
    const host = parent.querySelector<HTMLElement>(`button[is="${MINUS}"]`);
    if (!host) throw new Error("minus button did not mount");

    host.className = "px-4 font-bold";
    expect(host.className).toBe("px-4 font-bold");

    host.className = "";
    expect(host.className).toBe("");
  });
});
