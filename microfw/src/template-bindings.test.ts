import { signal } from "alien-signals";
import { describe, expect, it, vi } from "vitest";
import {
  bindTemplateBindings,
  extractAttributeBindings,
  extractTextBindings,
} from "./template-bindings";

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

  it.each([
    { eventName: "input", fieldName: "value", initial: "", next: "updated" },
    { eventName: "change", fieldName: "checked", initial: false, next: true },
  ])(
    "writes $fieldName into its signal on $eventName",
    ({ eventName, fieldName, initial, next }) => {
      const fragment = fragmentFrom(`<input bind:on${eventName}:${fieldName}="microfw:0">`);
      const input = fragment.querySelector("input")!;
      const value = signal<string | boolean>(initial);
      const bindings = extractAttributeBindings(fragment, 1);
      const unbind = bindTemplateBindings(bindings, [value]);

      Object.assign(input, { [fieldName]: next });
      input.dispatchEvent(new Event(eventName));

      expect(value()).toBe(next);
      unbind();
    },
  );

  it.each([
    'oninput="microfw:1" bind:oninput:value="microfw:0"',
    'bind:oninput:value="microfw:0" oninput="microfw:1"',
  ])("runs normal handlers after bindings: %s", (attributes) => {
    const fragment = fragmentFrom(`<input ${attributes}>`);
    const input = fragment.querySelector("input")!;
    const value = signal("");
    const observedValues: string[] = [];
    const bindings = extractAttributeBindings(fragment, 2);
    const unbind = bindTemplateBindings(bindings, [
      value,
      () => {
        observedValues.push(value());
      },
    ]);

    input.value = "updated first";
    input.dispatchEvent(new Event("input"));

    expect(observedValues).toEqual(["updated first"]);
    unbind();
  });

  it("updates all bound fields before the normal handler and cleans up on reconnect", () => {
    const fragment = fragmentFrom(
      '<input onchange="microfw:2" bind:onchange:value="microfw:0" bind:onchange:checked="microfw:1">',
    );
    const input = fragment.querySelector("input")!;
    const value = signal("");
    const checked = signal(false);
    const observations: [string, boolean][] = [];
    const handler = () => observations.push([value(), checked()]);
    const bindings = extractAttributeBindings(fragment, 3);
    const unbind = bindTemplateBindings(bindings, [value, checked, handler]);

    input.value = "first";
    input.checked = true;
    input.dispatchEvent(new Event("change"));
    expect(observations).toEqual([["first", true]]);

    unbind();
    input.value = "detached";
    input.dispatchEvent(new Event("change"));
    expect(value()).toBe("first");
    expect(observations).toEqual([["first", true]]);

    const disconnect = bindTemplateBindings(bindings, [value, checked, handler]);
    input.value = "reconnected";
    input.checked = false;
    input.dispatchEvent(new Event("change"));
    expect(observations).toEqual([
      ["first", true],
      ["reconnected", false],
    ]);
    disconnect();
  });

  it.each(["bind:input:value", "bind:oninput:missingfield", "bind:oninput:value:extra"])(
    "rejects invalid directive %s",
    (directive) => {
      const fragment = fragmentFrom(`<input ${directive}="microfw:0">`);
      expect(() => extractAttributeBindings(fragment, 1)).toThrow();
    },
  );

  it.each(["not a signal", () => "read-only"])("rejects a non-signal binding", (value) => {
    const fragment = fragmentFrom('<input bind:oninput:value="microfw:0">');
    const bindings = extractAttributeBindings(fragment, 1);
    expect(() => bindTemplateBindings(bindings, [value])).toThrow(TypeError);
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
