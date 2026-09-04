import { afterEach, describe, expect, it, vi } from "vitest";
import type { LitElement } from "lit";
import type { LitCounterElement } from "../src/counter";
import "../src/index";

const TAG = "lit-counter";
const MINUS = "lit-counter-minus-button";
const LABEL = "lit-counter-label";
const PLUS = "lit-counter-plus-button";

type ReactiveElement = HTMLElement & Pick<LitElement, "updateComplete">;

async function settle(parent: LitCounterElement): Promise<void> {
  await parent.updateComplete;
  const children = Array.from(parent.children).filter(
    (child): child is ReactiveElement => "updateComplete" in child,
  );
  await Promise.all(children.map((child) => child.updateComplete));
  await Promise.resolve();
  await Promise.all(children.map((child) => child.updateComplete));
}

async function mount(inner: string): Promise<LitCounterElement> {
  // Parent-first connection matches parser behavior for unresolved children.
  document.body.innerHTML = `<${TAG}>${inner}</${TAG}>`;
  const parent = document.querySelector<LitCounterElement>(TAG);
  if (!parent) {
    throw new Error("counter did not mount");
  }
  await settle(parent);
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

describe("lit-counter", () => {
  afterEach(() => {
    document.body.replaceChildren();
  });

  it("renders light-DOM children and counts uncontrolled", async () => {
    const parent = await mount(composed);

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
    await settle(parent);
    expect(label.textContent).toBe("-1");

    (plus as HTMLButtonElement).click();
    (plus as HTMLButtonElement).click();
    await settle(parent);
    expect(label.textContent).toBe("1");
  });

  it("starts from default-value", async () => {
    document.body.innerHTML = `<${TAG} default-value="5">${composed}</${TAG}>`;
    const parent = document.querySelector<LitCounterElement>(TAG);
    if (!parent) {
      throw new Error("counter did not mount");
    }
    await settle(parent);
    const { label, plus } = controls(parent);
    expect(label.textContent).toBe("5");

    (plus as HTMLButtonElement).click();
    await settle(parent);
    expect(label.textContent).toBe("6");
  });

  it("supports controlled value with onChange and change events", async () => {
    const onChange = vi.fn();
    const onEvent = vi.fn();
    document.body.innerHTML = `<${TAG} value="10">${composed}</${TAG}>`;
    const parent = document.querySelector<LitCounterElement>(TAG);
    if (!parent) {
      throw new Error("counter did not mount");
    }
    parent.onChange = onChange;
    parent.addEventListener("change", (event) => {
      onEvent((event as CustomEvent).detail);
    });
    await settle(parent);

    const { label, plus } = controls(parent);
    expect(label.textContent).toBe("10");

    (plus as HTMLButtonElement).click();
    await settle(parent);
    expect(label.textContent).toBe("10");
    expect(onChange).toHaveBeenCalledWith(11);
    expect(onEvent).toHaveBeenCalledWith({ value: 11 });

    parent.setAttribute("value", "11");
    await settle(parent);
    expect(label.textContent).toBe("11");
  });

  it("keeps forwarded classes in sync", async () => {
    const parent = await mount(composed);
    const host = parent.querySelector<ReactiveElement>(MINUS);
    if (!host) {
      throw new Error("minus button did not mount");
    }
    host.setAttribute("class", "px-4 font-bold");
    await host.updateComplete;
    const button = host.querySelector("button");
    expect(button?.className).toBe("counter-minus-button px-4 font-bold");
  });
});
