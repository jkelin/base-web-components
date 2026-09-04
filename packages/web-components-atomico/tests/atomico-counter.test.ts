import { afterEach, describe, expect, it, vi } from "vitest";
import "../src/index";

const TAG = "atomico-counter";
const MINUS = "atomico-counter-minus-button";
const LABEL = "atomico-counter-label";
const PLUS = "atomico-counter-plus-button";

type AtomicoElement = HTMLElement & { updated: Promise<void> };

const composed = `<${MINUS} class="btn"></${MINUS}><${LABEL} class="lbl"></${LABEL}><${PLUS} class="btn"></${PLUS}>`;

async function settle(parent: HTMLElement): Promise<void> {
  // Await both the current render and any label render queued by parent synchronization.
  const elements = [parent, ...parent.querySelectorAll("*")].filter(
    (element): element is AtomicoElement =>
      "updated" in element && element.updated instanceof Promise,
  );
  await Promise.all(elements.map((element) => element.updated));
  await Promise.resolve();
  await Promise.all(elements.map((element) => element.updated));
}

async function mount(inner: string): Promise<HTMLElement> {
  // innerHTML connects the parent before its unresolved children, matching parser order.
  document.body.innerHTML = `<${TAG}>${inner}</${TAG}>`;
  const parent = document.querySelector<HTMLElement>(TAG);
  if (!parent) {
    throw new Error("counter did not mount");
  }
  await settle(parent);
  return parent;
}

function controls(parent: HTMLElement) {
  const minus = parent.querySelector<HTMLButtonElement>(`${MINUS} > button`);
  const label = parent.querySelector<HTMLSpanElement>(`${LABEL} > span`);
  const plus = parent.querySelector<HTMLButtonElement>(`${PLUS} > button`);
  if (!minus || !label || !plus) {
    throw new Error("counter children did not render");
  }
  return { minus, label, plus };
}

describe("atomico-counter", () => {
  afterEach(() => {
    document.body.replaceChildren();
  });

  it("renders light-DOM children and counts uncontrolled", async () => {
    const parent = await mount(composed);

    expect(parent.shadowRoot).toBeNull();

    const { minus, label, plus } = controls(parent);
    expect(minus.getAttribute("aria-label")).toBe("Decrement count");
    expect(minus.getAttribute("data-testid")).toBe(MINUS);
    expect(minus.id).toBe("");
    expect(minus.className).toBe("counter-minus-button btn");
    expect(minus.textContent).toBe("−");
    expect(label.getAttribute("aria-live")).toBe("polite");
    expect(label.getAttribute("data-testid")).toBe(LABEL);
    expect(label.id).toBe("");
    expect(label.className).toBe("counter-label lbl");
    expect(label.textContent).toBe("0");
    expect(plus.getAttribute("data-testid")).toBe(PLUS);
    expect(plus.id).toBe("");
    expect(plus.className).toBe("counter-plus-button btn");

    minus.click();
    await settle(parent);
    expect(label.textContent).toBe("-1");

    plus.click();
    plus.click();
    await settle(parent);
    expect(label.textContent).toBe("1");
  });

  it("starts from default-value", async () => {
    document.body.innerHTML = `<${TAG} default-value="5">${composed}</${TAG}>`;
    const parent = document.querySelector<HTMLElement>(TAG);
    if (!parent) {
      throw new Error("counter did not mount");
    }
    await settle(parent);

    const { label, plus } = controls(parent);
    expect(label.textContent).toBe("5");

    plus.click();
    await settle(parent);
    expect(label.textContent).toBe("6");
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
    await settle(parent);

    const { label, plus } = controls(parent);
    expect(label.textContent).toBe("10");

    plus.click();
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
    const host = parent.querySelector<AtomicoElement>(MINUS);
    if (!host) {
      throw new Error("minus button did not mount");
    }

    host.setAttribute("class", "px-4 font-bold");
    await host.updated;
    const button = host.querySelector("button");
    expect(button?.className).toBe("counter-minus-button px-4 font-bold");
  });
});
