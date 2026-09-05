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

// Direct helper tests use a stable token; html() allocates a fresh token per template.
const token = "microfw:test:";
function marker(index: number): string {
  return `${token}${index};`;
}

describe("extractAttributeBindings", () => {
  it("applies primitive and boolean attribute values", () => {
    const fragment = fragmentFrom(
      `<button id="primitive-toggle" data-testid="primitive-toggle" disabled="${marker(0)}"></button>`,
    );
    const button = fragment.querySelector("button")!;
    const bindings = extractAttributeBindings(fragment, 1, token);

    expect(button.hasAttribute("disabled")).toBe(false);

    const show = bindTemplateBindings(bindings, [true]);
    expect(button.getAttribute("disabled")).toBe("");
    show();

    const hide = bindTemplateBindings(bindings, [false]);
    expect(button.hasAttribute("disabled")).toBe(false);
    hide();
  });

  it("installs and removes event handlers", () => {
    const fragment = fragmentFrom(
      `<button id="handler-toggle" data-testid="handler-toggle" onclick="${marker(0)}"></button>`,
    );
    const button = fragment.querySelector("button")!;
    const bindings = extractAttributeBindings(fragment, 1, token);
    const handler = vi.fn();

    const unbind = bindTemplateBindings(bindings, [handler]);
    button.click();
    expect(handler).toHaveBeenCalledOnce();

    unbind();
    button.click();
    expect(handler).toHaveBeenCalledOnce();
  });

  it.each([
    { eventName: "input", fieldName: "value", initial: "", next: "updated" },
    { eventName: "change", fieldName: "checked", initial: false, next: true },
  ])(
    "writes $fieldName into its signal on $eventName",
    ({ eventName, fieldName, initial, next }) => {
      const fragment = fragmentFrom(`<input bind:on${eventName}:${fieldName}="${marker(0)}">`);
      const input = fragment.querySelector("input")!;
      const value = signal<string | boolean>(initial);
      const bindings = extractAttributeBindings(fragment, 1, token);
      const unbind = bindTemplateBindings(bindings, [value]);

      Object.assign(input, { [fieldName]: next });
      input.dispatchEvent(new Event(eventName));

      expect(value()).toBe(next);
      unbind();
    },
  );

  it.each([
    `oninput="${marker(1)}" bind:oninput:value="${marker(0)}"`,
    `bind:oninput:value="${marker(0)}" oninput="${marker(1)}"`,
  ])("runs normal handlers after bindings: %s", (attributes) => {
    const fragment = fragmentFrom(`<input ${attributes}>`);
    const input = fragment.querySelector("input")!;
    const value = signal("");
    const observedValues: string[] = [];
    const bindings = extractAttributeBindings(fragment, 2, token);
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
      `<input onchange="${marker(2)}" bind:onchange:value="${marker(0)}" bind:onchange:checked="${marker(1)}">`,
    );
    const input = fragment.querySelector("input")!;
    const value = signal("");
    const checked = signal(false);
    const observations: [string, boolean][] = [];
    const handler = () => observations.push([value(), checked()]);
    const bindings = extractAttributeBindings(fragment, 3, token);
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
      const fragment = fragmentFrom(`<input ${directive}="${marker(0)}">`);
      expect(() => extractAttributeBindings(fragment, 1, token)).toThrow();
    },
  );

  it.each(["not a signal", () => "read-only"])("rejects a non-signal binding", (value) => {
    const fragment = fragmentFrom(`<input bind:oninput:value="${marker(0)}">`);
    const bindings = extractAttributeBindings(fragment, 1, token);
    expect(() => bindTemplateBindings(bindings, [value])).toThrow(TypeError);
  });

  it("renders zero and empty strings while removing nullish and false attributes", () => {
    const fragment = fragmentFrom(
      `<button id="primitive-button" data-testid="primitive-button" title="${marker(0)}" data-count="${marker(1)}" data-name="${marker(2)}" hidden="${marker(3)}" disabled="${marker(4)}" data-extra="${marker(5)}"></button>`,
    );
    const button = fragment.querySelector("button")!;
    const bindings = extractAttributeBindings(fragment, 6, token);
    const unbind = bindTemplateBindings(bindings, ["", 0, null, false, true, undefined]);

    expect(button.getAttribute("title")).toBe("");
    expect(button.getAttribute("data-count")).toBe("0");
    expect(button.hasAttribute("data-name")).toBe(false);
    expect(button.hasAttribute("hidden")).toBe(false);
    expect(button.getAttribute("disabled")).toBe("");
    expect(button.hasAttribute("data-extra")).toBe(false);
    unbind();
  });

  it("stops signal-driven attribute updates after unbind", () => {
    const fragment = fragmentFrom(`<div data-testid="live-box" title="${marker(0)}"></div>`);
    const box = fragment.querySelector("div")!;
    const title = signal("first");
    const bindings = extractAttributeBindings(fragment, 1, token);
    const unbind = bindTemplateBindings(bindings, [title]);

    expect(box.getAttribute("title")).toBe("first");
    title("second");
    expect(box.getAttribute("title")).toBe("second");
    unbind();
    title("detached");
    expect(box.getAttribute("title")).toBe("second");
  });

  it("removes installed handlers when a later value is missing", () => {
    const fragment = fragmentFrom(
      `<button id="rollback-button" data-testid="rollback-button" onclick="${marker(0)}" title="${marker(1)}"></button>`,
    );
    const button = fragment.querySelector("button")!;
    const handler = vi.fn();
    const bindings = extractAttributeBindings(fragment, 2, token);

    expect(() => bindTemplateBindings(bindings, [handler])).toThrow();
    button.click();
    expect(handler).not.toHaveBeenCalled();
  });

  it("discards signal effects when setup fails partway", () => {
    // Bindings bind in array order, so the valid subscription precedes the failure.
    const titleFragment = fragmentFrom(
      `<div data-testid="rollback-box" title="${marker(0)}"></div>`,
    );
    const nameFragment = fragmentFrom(
      `<div data-testid="rollback-name" data-name="${marker(1)}"></div>`,
    );
    const box = titleFragment.querySelector("div")!;
    const title = signal("first");
    const bindings = [
      ...extractAttributeBindings(titleFragment, 2, token),
      ...extractAttributeBindings(nameFragment, 2, token),
    ];

    expect(() => bindTemplateBindings(bindings, [title])).toThrow();
    expect(box.getAttribute("title")).toBe("first");
    title("second");
    expect(box.getAttribute("title")).toBe("first");
  });

  it("removes field listeners when a later field binding fails", () => {
    const fragment = fragmentFrom(
      `<input id="rollback-input" data-testid="rollback-input" bind:oninput:value="${marker(0)}" bind:oninput:checked="${marker(1)}">`,
    );
    const input = fragment.querySelector("input")!;
    const value = signal("");
    const bindings = extractAttributeBindings(fragment, 2, token);

    expect(() => bindTemplateBindings(bindings, [value, "not a signal"])).toThrow(TypeError);
    input.value = "detached";
    input.dispatchEvent(new Event("input"));
    expect(value()).toBe("");
  });

  it("delivers events with the bound currentTarget and stops after unbind", () => {
    const fragment = fragmentFrom(
      `<button id="event-button" data-testid="event-button" onclick="${marker(0)}"></button>`,
    );
    const button = fragment.querySelector("button")!;
    const seen: EventTarget[] = [];
    const bindings = extractAttributeBindings(fragment, 1, token);
    const unbind = bindTemplateBindings(bindings, [
      (event: Event) => {
        seen.push(event.currentTarget!);
      },
    ]);

    button.click();
    expect(seen).toEqual([button]);
    unbind();
    button.click();
    expect(seen).toHaveLength(1);
  });

  it.each([`title="${marker(1)}"`, 'title="microfw:test:nope;"'])(
    "rejects invalid attribute marker %s",
    (attribute) => {
      const fragment = fragmentFrom(`<div data-testid="marker-box" ${attribute}></div>`);
      expect(() => extractAttributeBindings(fragment, 1, token)).toThrow();
    },
  );

  it("rejects a handler for plain attributes and text", () => {
    const attributeFragment = fragmentFrom(
      `<div data-testid="attr-box" title="${marker(0)}"></div>`,
    );
    const attributeBindings = extractAttributeBindings(attributeFragment, 1, token);
    expect(() => bindTemplateBindings(attributeBindings, [() => "handler"])).toThrow(TypeError);

    const textFragment = fragmentFrom(`<div data-testid="text-box">${marker(0)}</div>`);
    const textBindings = extractTextBindings(textFragment, 1, token);
    expect(() => bindTemplateBindings(textBindings, [() => "handler"])).toThrow(TypeError);
  });

  it.each([["clicked"], [signal("nope")]])("rejects non-handler event value %s", (value) => {
    const fragment = fragmentFrom(
      `<button id="handler-button" data-testid="handler-button" onclick="${marker(0)}"></button>`,
    );
    const bindings = extractAttributeBindings(fragment, 1, token);
    expect(() => bindTemplateBindings(bindings, [value])).toThrow(TypeError);
  });

  it("reuses state and DOM across unbind and rebind", () => {
    const fragment = fragmentFrom(
      `<div data-testid="reuse-box" title="${marker(0)}">count: ${marker(1)}</div>`,
    );
    const box = fragment.querySelector("div")!;
    const title = signal("first");
    const count = signal(0);
    const bindings = [
      ...extractAttributeBindings(fragment, 2, token),
      ...extractTextBindings(fragment, 2, token),
    ];
    const unbind = bindTemplateBindings(bindings, [title, count]);

    expect(box.getAttribute("title")).toBe("first");
    expect(box.textContent).toBe("count: 0");
    count(1);
    unbind();
    title("detached");
    count(2);
    expect(box.getAttribute("title")).toBe("first");
    expect(box.textContent).toBe("count: 1");

    const rebind = bindTemplateBindings(bindings, [title, count]);
    expect(box.getAttribute("title")).toBe("detached");
    expect(box.textContent).toBe("count: 2");
    rebind();
  });

  it("isolates instances sharing one binding shape", () => {
    const first = fragmentFrom(`<div data-testid="first-box" title="${marker(0)}"></div>`);
    const second = fragmentFrom(`<div data-testid="second-box" title="${marker(0)}"></div>`);
    const firstTitle = signal("first");
    const secondTitle = signal("second");
    const unbindFirst = bindTemplateBindings(extractAttributeBindings(first, 1, token), [
      firstTitle,
    ]);
    const unbindSecond = bindTemplateBindings(extractAttributeBindings(second, 1, token), [
      secondTitle,
    ]);

    firstTitle("updated");
    expect(first.querySelector("div")!.getAttribute("title")).toBe("updated");
    expect(second.querySelector("div")!.getAttribute("title")).toBe("second");
    unbindFirst();
    unbindSecond();
  });

  it("leaves non-token attributes untouched", () => {
    const fragment = fragmentFrom('<div data-testid="plain" title="microfw:0"></div>');
    const box = fragment.querySelector("div")!;
    expect(extractAttributeBindings(fragment, 0, token)).toHaveLength(0);
    expect(box.getAttribute("title")).toBe("microfw:0");
  });
});

describe("extractTextBindings", () => {
  it("preserves static text around multiple interpolations", () => {
    const fragment = fragmentFrom(`<div>value: ${marker(0)} / ${marker(1)}</div>`);
    const value = fragment.querySelector("div")!;
    const bindings = extractTextBindings(fragment, 2, token);
    const unbind = bindTemplateBindings(bindings, ["first", 2]);

    expect(value.textContent).toBe("value: first / 2");
    unbind();
  });

  it("renders nullish interpolations as empty text", () => {
    const fragment = fragmentFrom(`<div>before ${marker(0)} after</div>`);
    const value = fragment.querySelector("div")!;
    const bindings = extractTextBindings(fragment, 1, token);
    const unbind = bindTemplateBindings(bindings, [null]);

    expect(value.textContent).toBe("before  after");
    unbind();
  });

  it("updates adjacent interpolations independently", () => {
    const fragment = fragmentFrom(`<div data-testid="adjacent">${marker(0)}${marker(1)}</div>`);
    const box = fragment.querySelector("div")!;
    const bindings = extractTextBindings(fragment, 2, token);

    const first = bindTemplateBindings(bindings, ["a", "b"]);
    expect(box.textContent).toBe("ab");
    first();

    const second = bindTemplateBindings(bindings, ["c", "b"]);
    expect(box.textContent).toBe("cb");
    second();
  });

  it("mirrors one signal into repeated markers", () => {
    const fragment = fragmentFrom(`<div data-testid="repeated">${marker(0)}/${marker(0)}</div>`);
    const box = fragment.querySelector("div")!;
    const value = signal("echo");
    const bindings = extractTextBindings(fragment, 1, token);
    const unbind = bindTemplateBindings(bindings, [value]);

    expect(box.textContent).toBe("echo/echo");
    value("changed");
    expect(box.textContent).toBe("changed/changed");
    unbind();
  });

  it.each([
    [false, "false"],
    [0, "0"],
    [true, "true"],
    [undefined, ""],
  ] as [boolean | number | undefined, string][])("renders text %s as %s", (value, expected) => {
    const fragment = fragmentFrom(`<div data-testid="primitive-text">${marker(0)}</div>`);
    const box = fragment.querySelector("div")!;
    const bindings = extractTextBindings(fragment, 1, token);
    const unbind = bindTemplateBindings(bindings, [value]);

    expect(box.textContent).toBe(expected);
    unbind();
  });

  it("rejects invalid text markers", () => {
    const outOfRange = fragmentFrom(`<div data-testid="range-text">${marker(2)}</div>`);
    expect(() => extractTextBindings(outOfRange, 2, token)).toThrow();
  });

  it("leaves non-token text untouched", () => {
    const fragment = fragmentFrom('<div data-testid="plain">literal microfw:0 text</div>');
    expect(extractTextBindings(fragment, 0, token)).toHaveLength(0);
    expect(fragment.querySelector("div")!.textContent).toBe("literal microfw:0 text");
  });
});
