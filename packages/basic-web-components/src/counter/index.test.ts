import { afterEach, describe, expect, it, vi } from "vitest";
import { parseCounterValue } from "./index";

const TAG = "bwc-counter";
const MINUS = "bwc-counter-minus-button";
const LABEL = "bwc-counter-label";
const PLUS = "bwc-counter-plus-button";

const composed = `<button is="${MINUS}" class="btn"></button><span is="${LABEL}" class="lbl"></span><button is="${PLUS}" class="btn"></button>`;
const customizedBuiltInProbe = document.createElement("button", { is: MINUS });
document.body.append(customizedBuiltInProbe);
const supportsCustomizedBuiltIns =
  customizedBuiltInProbe.getAttribute("aria-label") === "Decrement count";
customizedBuiltInProbe.remove();

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
describe.runIf(supportsCustomizedBuiltIns)("basic web components counter", () => {
  afterEach(() => {
    document.body.replaceChildren();
  });

  it("renders light-DOM children and counts uncontrolled", () => {
    const parent = mount();
    expect(parent.shadowRoot).toBeNull();

    const { minus, label, plus } = controls(parent);
    expect(minus.getAttribute("aria-label")).toBe("Decrement count");
    expect(minus.getAttribute("data-testid")).toBe(MINUS);
    expect(minus.className).toBe("counter-minus-button btn");
    expect(minus.type).toBe("button");
    expect(minus.style.cursor).toBe("pointer");
    expect(minus.textContent).toBe("−");
    expect(label.getAttribute("aria-live")).toBe("polite");
    expect(label.getAttribute("data-testid")).toBe(LABEL);
    expect(label.className).toBe("counter-label lbl");
    expect(label.textContent).toBe("0");
    expect(plus.getAttribute("aria-label")).toBe("Increment count");
    expect(plus.getAttribute("data-testid")).toBe(PLUS);
    expect(plus.className).toBe("counter-plus-button btn");
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
    expect(host.className).toBe("counter-minus-button px-4 font-bold");

    host.className = "";
    expect(host.className).toBe("counter-minus-button");
  });
});

describe("counter value parsing", () => {
  it.each([
    [undefined, 0],
    [Number.POSITIVE_INFINITY, 0],
    [" 7.9 ", 7],
    ["invalid", 0],
  ])("normalizes %j to %d", (input, expected) => {
    expect(parseCounterValue(input)).toBe(expected);
  });
});

import { BWC_COUNTER_PLUS_TAG, BWC_COUNTER_TAG, BwcCounterElement } from "./index";

type CounterApi = HTMLElement & {
  defaultValue: number;
  onChange: ((value: number) => void) | null;
  value: number;
};

describe("counter pre-connect hydration", () => {
  afterEach(() => {
    document.body.replaceChildren();
  });

  it("initializes from a pre-connect defaultValue without following later default changes", () => {
    const counter = new BwcCounterElement() as CounterApi;
    counter.defaultValue = 7.9;
    document.body.append(counter);

    expect(counter.localName).toBe(BWC_COUNTER_TAG);
    expect(counter.defaultValue).toBe(7);
    expect(counter.value).toBe(7);

    counter.defaultValue = 2;
    expect(counter.value).toBe(7);
  });

  it("hydrates controlled value and callback properties before connection", () => {
    const callback = vi.fn();
    const counter = new BwcCounterElement() as CounterApi;
    counter.defaultValue = 9;
    counter.value = 4;
    counter.onChange = callback;
    document.body.append(counter);

    expect(counter.value).toBe(4);
    expect(counter.onChange).toBe(callback);
  });

  it("preserves uncontrolled count and callback state when the root reconnects", () => {
    const PlusConstructor = customElements.get(BWC_COUNTER_PLUS_TAG) as {
      new (): HTMLButtonElement;
    };
    const counter = new BwcCounterElement() as CounterApi & {
      context: () => { count: unknown };
    };
    const plus = new PlusConstructor();
    const callback = vi.fn();
    plus.setAttribute("is", BWC_COUNTER_PLUS_TAG);
    counter.defaultValue = 5;
    counter.onChange = callback;
    document.body.append(counter);
    counter.append(plus);
    plus.click();
    expect(counter.value).toBe(6);
    const stateBefore = counter.context();

    counter.remove();
    document.body.append(counter);

    const stateAfter = counter.context();
    expect(stateAfter).toBe(stateBefore);
    expect(stateAfter.count).toBe(stateBefore.count);
    expect(counter.value).toBe(6);
    expect(counter.onChange).toBe(callback);
    plus.click();
    expect(counter.value).toBe(7);
    expect(callback).toHaveBeenCalledTimes(2);
    expect(callback).toHaveBeenLastCalledWith(7);
  });
});
