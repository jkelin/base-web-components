import { describe, expect, it, vi } from "vitest";
import { extractAttributeBindings, extractTextBindings } from "./template-bindings";

// Tests create isolated fragments so DOM mutations cannot leak between cases.
function fragmentFrom(html: string): DocumentFragment {
  const template = document.createElement("template");
  template.innerHTML = html;
  return template.content;
}

describe("extractAttributeBindings", () => {
  it("applies primitive and boolean attribute values", () => {
    const fragment = fragmentFrom('<button disabled="microfw:0"></button>');
    const button = fragment.querySelector("button")!;
    const [binding] = extractAttributeBindings(fragment, 1);

    expect(button.hasAttribute("disabled")).toBe(false);

    binding!.set(true);
    expect(button.getAttribute("disabled")).toBe("");

    binding!.set(false);
    expect(button.hasAttribute("disabled")).toBe(false);
  });

  it("installs and removes event handlers", () => {
    const fragment = fragmentFrom('<button onclick="microfw:0"></button>');
    const button = fragment.querySelector("button")!;
    const [binding] = extractAttributeBindings(fragment, 1);
    const handler = vi.fn();

    binding!.set(handler);
    button.click();
    expect(handler).toHaveBeenCalledOnce();

    binding!.set(null);
    button.click();
    expect(handler).toHaveBeenCalledOnce();
  });
});

describe("extractTextBindings", () => {
  it("preserves static text around multiple interpolations", () => {
    const fragment = fragmentFrom("<div>value: microfw:0 / microfw:1</div>");
    const value = fragment.querySelector("div")!;
    const bindings = extractTextBindings(fragment, 2);

    bindings[0]!.set("first");
    bindings[1]!.set(2);

    expect(value.textContent).toBe("value: first / 2");
  });

  it("renders nullish interpolations as empty text", () => {
    const fragment = fragmentFrom("<div>before microfw:0 after</div>");
    const value = fragment.querySelector("div")!;
    const [binding] = extractTextBindings(fragment, 1);

    binding!.set(null);

    expect(value.textContent).toBe("before  after");
  });
});
