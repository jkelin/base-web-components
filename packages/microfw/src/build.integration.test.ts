import { resolve } from "node:path";
import type { defineComponent, html, signal, useProp } from "./main";
import { build } from "vite";
import { expect, it } from "vitest";

type RuntimeModule = {
  defineComponent: typeof defineComponent;
  html: typeof html;
  signal: typeof signal;
  useProp: typeof useProp;
};

it("ships one signal runtime for standalone reactive bindings", async () => {
  const result = await build({
    configFile: resolve(import.meta.dirname, "../vite.config.ts"),
    root: resolve(import.meta.dirname, ".."),
    build: { write: false },
  });
  const outputs = Array.isArray(result) ? result : [result];
  const chunk = outputs
    .flatMap((output) => ("output" in output ? output.output : []))
    .find((output) => output.type === "chunk");
  if (!chunk) {
    throw new Error("Missing bundled runtime chunk.");
  }

  const moduleUrl = `data:text/javascript,${encodeURIComponent(chunk.code)}`;
  // A static import cannot address the production chunk generated in memory.
  const runtime = (await import(/* @vite-ignore */ moduleUrl)) as RuntimeModule;
  const value = runtime.signal("initial");
  const template = runtime.html`<input id="bundle-input" data-testid="bundle-input" title=${value} bind:oninput:value=${value}><span data-testid="bundle-value">${value}</span>`;
  const host = document.createElement("div");
  host.append(template.fragment);
  const input = host.querySelector<HTMLInputElement>("[data-testid='bundle-input']")!;
  const text = host.querySelector("[data-testid='bundle-value']")!;
  const unbind = template.bind();

  try {
    expect([input.title, text.textContent]).toEqual(["initial", "initial"]);
    value("direct");
    expect([input.title, text.textContent]).toEqual(["direct", "direct"]);
    input.value = "field";
    input.dispatchEvent(new Event("input"));
    expect([value(), input.title, text.textContent]).toEqual(["field", "field", "field"]);

    unbind();
    input.value = "detached field";
    input.dispatchEvent(new Event("input"));
    expect(value()).toBe("field");
    value("detached signal");
    expect([value(), input.title, text.textContent]).toEqual(["detached signal", "field", "field"]);

    const componentName = "x-bundled-prop";
    runtime.defineComponent(componentName, () => {
      const label = runtime.useProp("label");
      return runtime.html`<span data-testid="bundled-label">${label}</span>`;
    });
    const component = document.createElement(componentName) as HTMLElement & {
      label: string | null;
    };
    component.setAttribute("label", "initial");
    document.body.append(component);
    try {
      const label = component.shadowRoot!.querySelector("[data-testid='bundled-label']")!;
      expect(label.textContent).toBe("initial");

      expect(() => {
        component.label = 42 as unknown as string;
      }).toThrow(TypeError);
      expect([component.label, component.getAttribute("label"), label.textContent]).toEqual([
        "initial",
        "initial",
        "initial",
      ]);

      component.remove();
      expect(() => {
        component.label = 42 as unknown as string;
      }).toThrow(TypeError);
      expect([component.label, component.getAttribute("label"), label.textContent]).toEqual([
        "initial",
        "initial",
        "initial",
      ]);
      component.label = "detached";
      expect(component.getAttribute("label")).toBe("initial");

      document.body.append(component);
      expect([component.label, component.getAttribute("label"), label.textContent]).toEqual([
        "detached",
        "detached",
        "detached",
      ]);
    } finally {
      component.remove();
    }
  } finally {
    unbind();
  }
}, 10_000);
