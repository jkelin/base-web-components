import { build } from "vite";
import { expect, it } from "vitest";
import { compileStaticHtmlTemplates, staticHtmlPlugin } from "./static-html";

type HtmlTemplate = {
  bind: () => () => void;
  fragment: DocumentFragment;
};

type FixtureModule = {
  exportedHtml?: (template: TemplateStringsArray, ...values: unknown[]) => HtmlTemplate;
  render: (...values: unknown[]) => unknown;
};

async function buildFixture(source: string): Promise<FixtureModule> {
  const fixtureId = "\0virtual:static-html-fixture.ts";
  const result = await build({
    configFile: false,
    root: new URL("..", import.meta.url).pathname,
    plugins: [
      staticHtmlPlugin(),
      {
        name: "static-html-fixture",
        resolveId(id) {
          if (id === "virtual:static-html-fixture.ts") return fixtureId;
        },
        load(id) {
          if (id === fixtureId) return source;
        },
      },
    ],
    resolve: {
      conditions: ["source", "development", "import", "module", "browser", "default"],
    },
    build: {
      minify: false,
      target: "es2022",
      write: false,
      rolldownOptions: {
        input: "virtual:static-html-fixture.ts",
        preserveEntrySignatures: "strict",
        output: { format: "es", codeSplitting: false },
      },
    },
  });
  const outputs = Array.isArray(result) ? result : [result];
  const chunk = outputs
    .flatMap((output) => ("output" in output ? output.output : []))
    .find((output) => output.type === "chunk");
  if (!chunk) throw new Error("Missing fixture chunk.");

  return (await import(
    /* @vite-ignore */ `data:text/javascript,${encodeURIComponent(chunk.code)}`
  )) as FixtureModule;
}

it("renders exact cooked static markup and keeps shadowed local tags", async () => {
  const fixture = await buildFixture(`
    import { html as template } from "microfw";
    export function render() {
      const local = (html: typeof String.raw) => html\`local\`;
      return {
        local: local(String.raw),
        view: template\`<template><button onclick="window.called=true">0:0;</button></template><p>line\\nitem</p>\`,
      };
    }
  `);
  const first = fixture.render() as { local: string; view: HtmlTemplate };
  const second = fixture.render() as { local: string; view: HtmlTemplate };

  expect(first.local).toBe("local");
  expect(
    first.view.fragment.querySelector("template")!.content.querySelector("button")!.outerHTML,
  ).toBe('<button onclick="window.called=true">0:0;</button>');
  expect(first.view.fragment.querySelector("p")!.textContent).toBe("line\nitem");
  expect(second.view.fragment.querySelector("p")!.textContent).toBe("line\nitem");
});

it("minifies static tag whitespace while keeping the parsed DOM identical", async () => {
  const source = `
    import { html } from "microfw";
    export function render() {
      return html\`<div
        data-overlay
        data-testid="bwc-slide-out-overlay"
        hidden
        style="position:fixed;inset:0;background:rgb(0 0 0 / 0.4)"
        title="a > b"
      ></div>
      <slot name="trigger"></slot><slot name="panel"></slot>\`;
    }
  `;

  const compiled = compileStaticHtmlTemplates(source, "fixture.ts");
  expect(compiled).not.toBeNull();
  const embedded = compiled!.match(/__bwcStaticHtml\((.*)\)/)?.[1];
  expect(embedded).toBeDefined();
  expect(JSON.parse(embedded!)).toBe(
    '<div data-overlay data-testid="bwc-slide-out-overlay" hidden style="position:fixed;inset:0;background:rgb(0 0 0 / 0.4)" title="a > b"></div><slot name="trigger"></slot><slot name="panel"></slot>',
  );

  const fixture = await buildFixture(source);
  const view = fixture.render() as HtmlTemplate;
  const overlay = view.fragment.querySelector("div");
  expect(overlay?.hasAttribute("data-overlay")).toBe(true);
  expect(overlay?.getAttribute("title")).toBe("a > b");
  expect(overlay?.getAttribute("style")).toBe("position:fixed;inset:0;background:rgb(0 0 0 / 0.4)");
  expect(view.fragment.querySelectorAll("slot")).toHaveLength(2);
  expect([...view.fragment.childNodes].every((node) => node.nodeType === 1)).toBe(true);
});

it("keeps a mixed unsafe module unchanged and fully reactive", async () => {
  const fixture = await buildFixture(`
    import { html, signal } from "microfw";
    export { html as exportedHtml };
    const registry = { html };
    const checked: typeof html = html;
    const value = signal("initial");
    export function render() {
      return {
        value,
        views: [
          html\`<span>direct \${value}</span>\`,
          registry.html\`<span>shorthand \${value}</span>\`,
          checked\`<span>non-tag \${value}</span>\`,
        ],
      };
    }
  `);
  const result = fixture.render() as {
    value: (next?: string) => string;
    views: HtmlTemplate[];
  };
  const host = document.createElement("div");
  for (const view of result.views) host.append(view.fragment);
  const dispose = result.views.map((view) => view.bind());

  expect(host.textContent).toBe("direct initialshorthand initialnon-tag initial");
  result.value("updated");
  expect(host.textContent).toBe("direct updatedshorthand updatednon-tag updated");
  expect(fixture.exportedHtml).toBeTypeOf("function");
  expect(fixture.exportedHtml!`<b>exported</b>`.fragment.textContent).toBe("exported");
  for (const unbind of dispose) unbind();
});

it("keeps isolated shorthand use reactive", async () => {
  const fixture = await buildFixture(`
    import { html, signal } from "microfw";
    const registry = { html };
    const value = signal("initial");
    export function render() {
      return {
        direct: html\`<slot></slot>\`,
        reactive: registry.html\`<span>\${value}</span>\`,
        value,
      };
    }
  `);
  const result = fixture.render() as {
    direct: HtmlTemplate;
    reactive: HtmlTemplate;
    value: (next?: string) => string;
  };
  const host = document.createElement("div");
  host.append(result.direct.fragment, result.reactive.fragment);
  const dispose = result.reactive.bind();

  expect(host.querySelector("slot")).not.toBeNull();
  expect(host.querySelector("span")!.textContent).toBe("initial");
  result.value("updated");
  expect(host.querySelector("span")!.textContent).toBe("updated");
  dispose();
});

it("keeps isolated re-export use available", async () => {
  const fixture = await buildFixture(`
    import { html } from "microfw";
    export { html as exportedHtml };
    export function render() {
      return html\`<slot></slot>\`;
    }
  `);
  const view = fixture.render() as HtmlTemplate;

  expect(view.fragment.querySelector("slot")).not.toBeNull();
  const exported = fixture.exportedHtml!`<span>${"exported"}</span>`;
  const host = document.createElement("div");
  host.append(exported.fragment);
  const dispose = exported.bind();
  expect(host.textContent).toBe("exported");
  dispose();
});

it("keeps a helper-name collision on the full runtime path", async () => {
  const fixture = await buildFixture(`
    import { html } from "microfw";
    const __bwcStaticHtml = "authored";
    export function render() {
      return { authored: __bwcStaticHtml, view: html\`<slot></slot>\` };
    }
  `);
  const result = fixture.render() as { authored: string; view: HtmlTemplate };

  expect(result.authored).toBe("authored");
  expect(result.view.fragment.querySelector("slot")).not.toBeNull();
});

it("keeps invalid cooked escapes on the full runtime error path", async () => {
  const fixture = await buildFixture(
    'import { html } from "microfw"; export function render() { return html`\\unicode`; }',
  );

  expect(() => fixture.render()).toThrow(TypeError);
});

it("keeps modules with direct eval unchanged", () => {
  const source = `
    import { html } from "microfw";
    export function render() {
      return {
        direct: html\`<span>direct</span>\`,
        evaluated: eval("html")\`<span>evaluated</span>\`,
      };
    }
  `;

  expect(compileStaticHtmlTemplates(source, "fixture.ts")).toBeNull();
});
