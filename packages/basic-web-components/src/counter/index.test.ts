import { afterEach, describe, expect, it, vi } from "vitest";
import { BWC_COUNTER_TAG, BwcCounterElement, parseCounterValue } from "./index";

const MINUS = "bwc-counter-minus-button";
const LABEL = "bwc-counter-label";
const PLUS = "bwc-counter-plus-button";
const markup = `<button slot="decrement" class="minus">−</button><output slot="value" class="label"></output><button slot="increment" class="plus">+</button>`;

type CounterElement = HTMLElement & {
  defaultValue: number;
  onChange: ((value: number) => void) | null;
  value: number;
};

function mount(attributes = ""): CounterElement {
  const wrapper = document.createElement("div");
  wrapper.innerHTML = `<${BWC_COUNTER_TAG}${attributes}>${markup}</${BWC_COUNTER_TAG}>`;
  const host = wrapper.firstElementChild as CounterElement;
  document.body.append(host);
  return host;
}
function controls(host: HTMLElement) {
  return {
    decrement: host.querySelector<HTMLButtonElement>('[slot="decrement"]')!,
    output: host.querySelector<HTMLOutputElement>('[slot="value"]')!,
    increment: host.querySelector<HTMLButtonElement>('[slot="increment"]')!,
  };
}

async function mutations(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

describe("basic web components counter", () => {
  afterEach(() => document.body.replaceChildren());

  it("projects and decorates exactly one native control per slot", () => {
    const host = mount();
    const { decrement, output, increment } = controls(host);

    expect(host.shadowRoot!.innerHTML).toContain('<slot name="decrement">');
    expect(decrement.getAttribute("aria-label")).toBe("Decrement count");
    expect(decrement.dataset.testid).toBe(MINUS);
    expect(decrement.id).toBeTruthy();
    expect(decrement.className).toBe("counter-minus-button minus");
    expect(decrement.type).toBe("button");
    expect(decrement.style.cursor).toBe("pointer");
    expect(output.getAttribute("aria-live")).toBe("polite");
    expect(output.dataset.testid).toBe(LABEL);
    expect(output.className).toBe("counter-label label");
    expect(output.textContent).toBe("0");
    expect(increment.getAttribute("aria-label")).toBe("Increment count");
    expect(increment.dataset.testid).toBe(PLUS);
  });

  it("keeps the cursor in sync when an authored button is disabled", async () => {
    const host = mount();
    const { decrement } = controls(host);

    decrement.disabled = true;
    await mutations();
    expect(decrement.style.cursor).toBe("not-allowed");

    decrement.disabled = false;
    await mutations();
    expect(decrement.style.cursor).toBe("pointer");
  });

  it("counts uncontrolled from defaultValue and preserves state across reconnect", () => {
    const callback = vi.fn();
    const host = mount(' default-value="5"');
    host.onChange = callback;
    const { decrement, output, increment } = controls(host);

    increment.click();
    decrement.click();
    decrement.click();
    expect(host.value).toBe(4);
    expect(output.textContent).toBe("4");
    expect(callback).toHaveBeenCalledTimes(3);

    host.remove();
    document.body.append(host);
    increment.click();
    expect(host.value).toBe(5);
    expect(callback).toHaveBeenCalledTimes(4);
  });

  it("notifies without mutating controlled state and resets when value is removed", async () => {
    const callback = vi.fn();
    const event = vi.fn();
    const host = mount(' value="10"');
    host.onChange = callback;
    host.addEventListener("change", (change) => {
      const custom = change as CustomEvent<{ value: number }>;
      event(custom.detail, custom.bubbles, custom.composed);
    });
    const { output, increment } = controls(host);

    increment.click();
    expect(host.value).toBe(10);
    expect(output.textContent).toBe("10");
    expect(callback).toHaveBeenCalledWith(11);
    expect(event).toHaveBeenCalledWith({ value: 11 }, true, true);

    host.removeAttribute("value");
    await mutations();
    expect(host.value).toBe(0);
    expect(output.textContent).toBe("0");
    increment.click();
    expect(host.value).toBe(1);
    expect(host.hasAttribute("value")).toBe(false);
  });

  it("hydrates typed and callback properties before upgrade", () => {
    const tag = `bwc-counter-upgrade-${Date.now()}`;
    const pending = document.createElement(tag) as CounterElement;
    pending.innerHTML = markup;
    pending.defaultValue = 8.8;
    pending.value = 3.9;
    const callback = vi.fn();
    pending.onChange = callback;
    document.body.append(pending);

    const Constructor = customElements.get(BWC_COUNTER_TAG)!;
    customElements.define(tag, class extends (Constructor as typeof BwcCounterElement) {});

    expect(pending.defaultValue).toBe(8);
    expect(pending.value).toBe(3);
    expect(pending.onChange).toBe(callback);
    controls(pending).increment.click();
    expect(callback).toHaveBeenCalledWith(4);
    expect(pending.value).toBe(3);
  });

  it("rebinds a dynamically replaced control without retaining the old listener", async () => {
    const host = mount();
    const oldIncrement = controls(host).increment;
    const replacement = document.createElement("button");
    replacement.slot = "increment";
    replacement.textContent = "+";
    oldIncrement.replaceWith(replacement);
    await mutations();

    oldIncrement.click();
    expect(host.value).toBe(0);
    replacement.click();
    expect(host.value).toBe(1);
  });

  it("rejects missing, duplicate, wrong-type, and nested-only slot structures", () => {
    for (const content of [
      `<output slot="value"></output><button slot="increment"></button>`,
      `<button slot="decrement"></button><button slot="decrement"></button><output slot="value"></output><button slot="increment"></button>`,
      `<div slot="decrement"></div><output slot="value"></output><button slot="increment"></button>`,
      `<div>${markup}</div>`,
    ]) {
      const host = document.createElement(BWC_COUNTER_TAG);
      host.innerHTML = content;
      expect(() => document.body.append(host)).toThrow(TypeError);
      host.remove();
    }
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
