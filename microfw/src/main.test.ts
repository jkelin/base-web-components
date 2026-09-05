import { describe, expect, it, vi } from "vitest";
import { defineComponent, html, signal, useProp } from "./main";

let elementCounter = 0;
function elementName(prefix: string): string {
  elementCounter += 1;
  return `${prefix}-${elementCounter}`;
}

type LabelledElement = HTMLElement & { label: string | null };

// Observer delivery follows the browser microtask checkpoint.
function microtask(): Promise<void> {
  return new Promise<void>((resolve) => queueMicrotask(resolve));
}

describe("defineComponent", () => {
  it("renders signals and handles events in shadow DOM", () => {
    const name = elementName("x-counter");
    defineComponent(name, () => {
      const count = signal(0);
      // oxfmt-ignore
      return html`<button
        id="counter-button"
        data-testid="counter-button"
        onclick=${() => count(count() + 1)}
      >count: ${count}</button>`;
    });

    const host = document.createElement(name);
    document.body.append(host);
    try {
      const button = host.shadowRoot!.querySelector<HTMLButtonElement>(
        '[data-testid="counter-button"]',
      )!;
      expect(button.textContent).toBe("count: 0");
      button.click();
      expect(button.textContent).toBe("count: 1");
    } finally {
      host.remove();
    }
  });

  it("applies reserved slot metadata without copying the slot name", () => {
    const name = elementName("x-slot");
    defineComponent(
      name,
      () =>
        html`<slot name="__properties" class="from-slot" data-mode="default"></slot
          ><span data-testid="slot-body">body</span>`,
    );

    const host = document.createElement(name);
    host.classList.add("from-host");
    document.body.append(host);
    try {
      expect(host.classList.contains("from-slot")).toBe(true);
      expect(host.classList.contains("from-host")).toBe(true);
      expect(host.getAttribute("data-mode")).toBe("default");
      expect(host.hasAttribute("name")).toBe(false);
      expect(host.shadowRoot!.querySelector('[data-testid="slot-body"]')!.textContent).toBe("body");
    } finally {
      host.remove();
    }
  });

  it("keeps host attributes over reserved slot defaults", () => {
    const name = elementName("x-defaults");
    const wrapper = document.createElement("div");
    wrapper.innerHTML = `<${name} data-testid="defaults-host" data-mode="host"></${name}>`;
    const pending = wrapper.querySelector<HTMLElement>("[data-testid='defaults-host']")!;
    expect(pending.getAttribute("data-mode")).toBe("host");

    defineComponent(name, () => html`<slot name="__properties" data-mode="default"></slot>`);
    expect(pending.getAttribute("data-mode")).toBe("host");

    const fresh = document.createElement(name);
    fresh.setAttribute("data-testid", "fresh-defaults");
    document.body.append(fresh);
    try {
      expect(fresh.getAttribute("data-mode")).toBe("default");
    } finally {
      fresh.remove();
    }
  });

  it("isolates state between instances", () => {
    const name = elementName("x-isolated");
    defineComponent(name, () => {
      const count = signal(0);
      // oxfmt-ignore
      return html`<button
        id="isolated-button"
        data-testid="isolated-button"
        onclick=${() => count(count() + 1)}
      >count: ${count}</button>`;
    });

    const first = document.createElement(name);
    const second = document.createElement(name);
    document.body.append(first, second);
    try {
      const firstButton = first.shadowRoot!.querySelector<HTMLButtonElement>(
        '[data-testid="isolated-button"]',
      )!;
      const secondButton = second.shadowRoot!.querySelector<HTMLButtonElement>(
        '[data-testid="isolated-button"]',
      )!;
      firstButton.click();
      expect(firstButton.textContent).toBe("count: 1");
      expect(secondButton.textContent).toBe("count: 0");
    } finally {
      first.remove();
      second.remove();
    }
  });

  it("reuses state and DOM across reconnects without duplicating handlers", () => {
    const name = elementName("x-reconnect");
    defineComponent(name, () => {
      const count = signal(0);
      // oxfmt-ignore
      return html`<button
        id="reconnect-button"
        data-testid="reconnect-button"
        onclick=${() => count(count() + 1)}
      >count: ${count}</button>`;
    });

    const host = document.createElement(name);
    document.body.append(host);
    const button = host.shadowRoot!.querySelector<HTMLButtonElement>(
      '[data-testid="reconnect-button"]',
    )!;
    try {
      button.click();
      expect(button.textContent).toBe("count: 1");

      host.remove();
      const lifecycle = host as HTMLElement & { disconnectedCallback: () => void };
      lifecycle.disconnectedCallback();
      lifecycle.disconnectedCallback();
      button.click();
      expect(button.textContent).toBe("count: 1");

      document.body.append(host);
      expect(button.textContent).toBe("count: 1");
      expect(host.shadowRoot!.querySelector('[data-testid="reconnect-button"]')).toBe(button);
      button.click();
      expect(button.textContent).toBe("count: 2");
    } finally {
      host.remove();
    }
  });

  it("syncs props from attributes and properties", async () => {
    const name = elementName("x-labelled");
    defineComponent(name, () => {
      const label = useProp("label");
      return html`<p data-testid="label-text">label: ${label}</p>`;
    });

    const host = document.createElement(name) as LabelledElement;
    document.body.append(host);
    try {
      host.setAttribute("label", "initial");
      await microtask();
      const text = host.shadowRoot!.querySelector('[data-testid="label-text"]')!;
      expect(text.textContent).toBe("label: initial");

      host.label = "property";
      expect(host.getAttribute("label")).toBe("property");
      expect(text.textContent).toBe("label: property");
    } finally {
      host.remove();
    }
  });

  it("pauses prop effects while detached and reflects writes on reconnect", async () => {
    const name = elementName("x-detached");
    defineComponent(name, () => {
      const label = useProp("label");
      return html`<p data-testid="detached-text">label: ${label}</p>`;
    });

    const host = document.createElement(name) as LabelledElement;
    document.body.append(host);
    try {
      host.setAttribute("label", "initial");
      await microtask();

      host.remove();
      host.label = "detached-write";
      expect(host.getAttribute("label")).toBe("initial");

      document.body.append(host);
      expect(host.getAttribute("label")).toBe("detached-write");
      expect(host.shadowRoot!.querySelector('[data-testid="detached-text"]')!.textContent).toBe(
        "label: detached-write",
      );
    } finally {
      host.remove();
    }
  });

  it("prefers detached attribute edits on reconnect", async () => {
    const name = elementName("x-attr-edit");
    defineComponent(name, () => {
      const label = useProp("label");
      return html`<p data-testid="attr-edit-text">label: ${label}</p>`;
    });

    const host = document.createElement(name) as LabelledElement;
    document.body.append(host);
    try {
      host.setAttribute("label", "initial");
      await microtask();

      host.remove();
      host.setAttribute("label", "attribute-edit");
      document.body.append(host);
      await microtask();
      expect(host.shadowRoot!.querySelector('[data-testid="attr-edit-text"]')!.textContent).toBe(
        "label: attribute-edit",
      );
    } finally {
      host.remove();
    }
  });

  it("surfaces render failures on construction", () => {
    const name = elementName("x-broken");
    defineComponent(name, () => {
      throw new Error("render failed");
    });

    expect(() => document.createElement(name)).toThrow();
  });
  it("rolls back prop effects when template bind fails on connect", async () => {
    const name = elementName("x-bind-fail");
    defineComponent(name, () => {
      const label = useProp("label");
      return html`<p data-testid="bind-fail-text">label: ${label} ${() => "boom"}</p>`;
    });

    const host = document.createElement(name) as LabelledElement;
    host.setAttribute("label", "initial");
    try {
      document.body.append(host);
    } catch {
      // Environments may propagate the connect-time bind failure.
    }
    try {
      host.label = "after-fail";
      expect(host.getAttribute("label")).toBe("initial");
      host.setAttribute("label", "external-edit");
      await microtask();
      expect(host.label).toBe("after-fail");
    } finally {
      host.remove();
    }
  });
  it("defers host metadata until connect", () => {
    // Awareness: native construction forbids host attribute writes, so defaults
    // apply in connectedCallback. Runtime must verify autonomous and p-is
    // variants in a real browser; happy-dom permits constructor mutation.
    const name = elementName("x-deferred");
    defineComponent(
      name,
      () => html`<slot name="__properties" class="from-slot" data-mode="default"></slot>`,
    );

    const host = document.createElement(name);
    expect(host.getAttribute("data-mode")).toBeNull();
    document.body.append(host);
    try {
      expect(host.classList.contains("from-slot")).toBe(true);
      expect(host.getAttribute("data-mode")).toBe("default");
      expect(host.hasAttribute("name")).toBe(false);
    } finally {
      host.remove();
    }
  });

  it("applies slot defaults before prop sync on connect", async () => {
    const name = elementName("x-default-prop");
    defineComponent(name, () => {
      const label = useProp("label");
      return html`<slot name="__properties" label="default-label"></slot>
        <p data-testid="default-prop-text">label: ${label}</p>`;
    });

    const host = document.createElement(name) as LabelledElement;
    document.body.append(host);
    try {
      await microtask();
      expect(host.getAttribute("label")).toBe("default-label");
      expect(host.shadowRoot!.querySelector('[data-testid="default-prop-text"]')!.textContent).toBe(
        "label: default-label",
      );
    } finally {
      host.remove();
    }
  });

  it("keeps numeric suffixes outside interpolations", () => {
    const value = signal("a");
    const flag = signal(false);
    const template = html`<div data-testid="suffix">v:${value}2 b:${flag}2</div>`;
    const host = document.createElement("div");
    host.append(template.fragment);
    const unbind = template.bind();
    try {
      const box = host.querySelector('[data-testid="suffix"]')!;
      expect(box.textContent).toBe("v:a2 b:false2");
      value("b");
      flag(true);
      expect(box.textContent).toBe("v:b2 b:true2");
    } finally {
      unbind();
    }
  });

  it("leaves static microfw-like text alone", () => {
    const template = html`<div data-testid="literal">literal microfw:0 text</div>`;
    const host = document.createElement("div");
    host.append(template.fragment);
    const unbind = template.bind();
    try {
      expect(host.querySelector('[data-testid="literal"]')!.textContent).toBe(
        "literal microfw:0 text",
      );
    } finally {
      unbind();
    }
  });
  it("keeps static first-id marker text literal while binding the interpolation", async () => {
    // Dynamic import is required here: only a fresh module reset restarts the
    // marker counter at zero, where `0:` collides with the literal text and
    // `1:` becomes the first available marker id.
    vi.resetModules();
    const fresh = await import("./main");
    const template = fresh.html`<div data-testid="first-id">literal microfw:0:0; plus ${"bound"}</div>`;
    const host = document.createElement("div");
    host.append(template.fragment);
    const unbind = template.bind();
    try {
      expect(host.querySelector('[data-testid="first-id"]')!.textContent).toBe(
        "literal microfw:0:0; plus bound",
      );
    } finally {
      unbind();
    }
  });

  it("keeps entity-decoded marker text and attributes literal", async () => {
    // A fresh module is required to exercise entity decoding against marker zero.
    vi.resetModules();
    const fresh = await import("./main");
    const template = fresh.html`<div
      data-testid="entity-marker"
      title="&#48;&#58;0;"
    >literal &#48;&#58;0; plus ${"bound"}</div>`;
    const host = document.createElement("div");
    host.append(template.fragment);
    const unbind = template.bind();
    try {
      const box = host.querySelector('[data-testid="entity-marker"]')!;
      expect(box.getAttribute("title")).toBe("0:0;");
      expect(box.textContent).toBe("literal 0:0; plus bound");
    } finally {
      unbind();
    }
  });

  it("retries a marker decoded inside a static mixed attribute", async () => {
    // A fresh module makes the decoded static text collide with marker zero.
    vi.resetModules();
    const fresh = await import("./main");
    const template = fresh.html`<div
      data-testid="mixed-entity-marker"
      title="prefix &#48;:0;"
    >${"live"}</div>`;
    const host = document.createElement("div");
    host.append(template.fragment);
    const unbind = template.bind();
    try {
      const box = host.querySelector('[data-testid="mixed-entity-marker"]')!;
      expect(box.getAttribute("title")).toBe("prefix 0:0;");
      expect(box.textContent).toBe("live");
    } finally {
      unbind();
    }
  });

  it("retries a decoded collision before an incomplete interpolated attribute", async () => {
    vi.resetModules();
    const fresh = await import("./main");
    const template = fresh.html`<div data-testid="incomplete-entity-marker" title="prefix &#48;:0;" data-x="${"live"}"></div>`;
    const host = document.createElement("div");
    host.append(template.fragment);
    const unbind = template.bind();
    try {
      const box = host.querySelector('[data-testid="incomplete-entity-marker"]')!;
      expect(box.getAttribute("title")).toBe("prefix 0:0;");
      expect(box.getAttribute("data-x")).toBe("live");
    } finally {
      unbind();
    }
  });

  it("renders decoded marker-like text when there are no substitutions", async () => {
    vi.resetModules();
    const fresh = await import("./main");
    const template = fresh.html`<div data-testid="static-entity-marker" title="&#48;:"></div>`;
    const host = document.createElement("div");
    host.append(template.fragment);
    const unbind = template.bind();
    try {
      expect(
        host.querySelector('[data-testid="static-entity-marker"]')!.getAttribute("title"),
      ).toBe("0:");
    } finally {
      unbind();
    }
  });

  it("rejects a parser-cloned interpolation that masks a discarded one", () => {
    // happy-dom omits adoption-agency cloning; emulate Chromium's observed clone/discard result.
    const descriptor = Object.getOwnPropertyDescriptor(HTMLTemplateElement.prototype, "innerHTML")!;
    Object.defineProperty(HTMLTemplateElement.prototype, "innerHTML", {
      ...descriptor,
      set(markup: string) {
        descriptor.set!.call(this, markup);
        if (markup.includes('data-testid="parser-clone"')) {
          const node = (this as HTMLTemplateElement).content.querySelector("i[title]")!;
          node.after(node.cloneNode(true));
        }
      },
    });

    try {
      expect(
        () =>
          html`<p data-testid="parser-clone"><b><i title=${"first"} data-kept="static" data-kept=${"discarded"}>x</b>y</i></p>`,
      ).toThrow(Error);
    } finally {
      Object.defineProperty(HTMLTemplateElement.prototype, "innerHTML", descriptor);
    }
  });

  it.each([
    () => html`<div title="before ${"bound"} after"></div>`,
    () => html`<!-- ${"bound"} -->`,
    () => html`<${"div"}></${"div"}>`,
  ])("rejects an interpolation outside supported text or whole-attribute contexts", (render) => {
    expect(render).toThrow(Error);
  });

  it("renders signal HTML as text without injection", () => {
    const value = signal('<img src="x" data-testid="injected">');
    const template = html`<div data-testid="injection">${value}</div>`;
    const host = document.createElement("div");
    host.append(template.fragment);
    const unbind = template.bind();
    try {
      const box = host.querySelector('[data-testid="injection"]')!;
      expect(box.querySelector("img")).toBeNull();
      expect(box.textContent).toBe('<img src="x" data-testid="injected">');
    } finally {
      unbind();
    }
  });
});
