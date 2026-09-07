// @ts-ignore: bun:test types ship with the Bun runtime, not as a workspace package.
import { describe, expect, it } from "bun:test";
import { Window } from "happy-dom";
import { COMPONENTS, stripExampleAttributes } from "./site.ts";
import { demoCard, stripDemoSourceOnly } from "./prerender.ts";

const window = new Window({ url: "http://localhost/" });
const parse = (html: string): HTMLElement => {
  window.document.body.innerHTML = html;
  return window.document.body as unknown as HTMLElement;
};
const demo = (slug: string): string =>
  COMPONENTS.find((component) => component.slug === slug)?.demo ?? "";

describe("developer example source", () => {
  it("strips website hooks and layout while preserving behavior attributes", () => {
    const input =
      `<bwc-popover id="demo" data-testid="demo" class="flex" side="bottom" side-offset="8">` +
      `<button slot="trigger" button-class="x">Open</button></bwc-popover>`;
    expect(stripExampleAttributes(input)).toBe(
      `<bwc-popover side="bottom" side-offset="8"><button slot="trigger">Open</button></bwc-popover>`,
    );
  });

  it("handles single-quoted and unquoted class hooks without substring damage", () => {
    expect(
      stripExampleAttributes(`<div classy="x" class='grid'><bwc-switch thumb-class=size-5>`),
    ).toBe(`<div classy="x"><bwc-switch>`);
  });

  it("removes only the toast launcher chrome from source", () => {
    const toast = demo("toast");
    const source = stripExampleAttributes(stripDemoSourceOnly(toast));
    expect(toast).toContain('data-demo-source-only="toast-launchers"');
    expect(toast).toContain("showToast(");
    expect(source).not.toContain("data-demo-source-only");
    expect(source).not.toContain("onclick=");
    expect(source).toContain("<bwc-toast-region");
    expect(source).toContain("data-toast-header");
  });

  it("renders previews without extracted footer controls", () => {
    const card = demoCard("toast", "bwc-toast-region", demo("toast"), "<code>example</code>");
    expect(card).toContain('data-demo-source-only="toast-launchers"');
    expect(card).not.toContain("data-demo-controls");
    expect(card).not.toContain("demo-toast-controls");
    expect(card).toContain('id="demo-toast-preview"');
  });
});

describe("demo registry", () => {
  it("uses category metadata as the ordered navigation source", () => {
    expect(
      COMPONENTS.filter((item) => item.category === "Popper").map((item) => item.slug),
    ).toEqual([
      "popover",
      "tooltip",
      "preview-card",
      "menu",
      "context-menu",
      "select",
      "menubar",
      "navigation-menu",
    ]);
    expect(
      COMPONENTS.filter((item) => item.category === "Overlay").map((item) => item.slug),
    ).toEqual(["modal", "slide-out", "alert-dialog", "toast"]);
  });

  it("contains no imperative footer or popup spacer hacks", () => {
    for (const component of COMPONENTS) {
      expect(component.demo).not.toContain("data-demo-controls");
      expect(component.demo).not.toMatch(/min-h-(64|80)/);
    }
  });

  it("keeps readouts only for value-bearing controls", () => {
    expect(
      COMPONENTS.filter((item) => item.readoutInitial !== undefined).map((item) => item.slug),
    ).toEqual(["accordion", "select", "switch", "otp", "tabs"]);
  });

  it("keeps demo markup free of aria-* attributes", () => {
    for (const component of COMPONENTS) expect(component.demo).not.toMatch(/\saria-[a-z]+=/);
  });

  it("gives every interactive demo node stable hooks", () => {
    for (const component of COMPONENTS) {
      const root = parse(component.demo);
      for (const node of root.querySelectorAll("button, a, summary, input, [data-option]")) {
        expect(node.id).not.toBe("");
        expect(node.getAttribute("data-testid")).not.toBeNull();
      }
    }
  });
});

describe("overlay demo structure", () => {
  it("uses matching modal and alert section hooks with compact header closes", () => {
    const modal = parse(demo("modal"));
    expect(modal.querySelector("[data-modal-header] [data-close]")?.getAttribute("title")).toBe(
      "Close",
    );
    expect(modal.querySelector("[data-modal-content] [data-description]")).not.toBeNull();
    expect(modal.querySelector("[data-modal-actions] [data-action]")).not.toBeNull();

    const alert = parse(demo("alert-dialog"));
    expect(alert.querySelector("[data-alert-header] [data-close]")?.getAttribute("title")).toBe(
      "Close",
    );
    expect(alert.querySelector("[data-alert-content] [data-description]")).not.toBeNull();
    expect(alert.querySelector("[data-alert-actions] [data-action]")).not.toBeNull();
  });

  it("puts declarative toast title and close in one header", () => {
    const toast = parse(demo("toast"));
    const header = toast.querySelector("[data-toast-header]");
    expect(header?.querySelector("[data-title]")).not.toBeNull();
    expect(header?.querySelector("button[data-close]")?.textContent).toBe("×");
    expect(toast.querySelectorAll('[data-demo-source-only="toast-launchers"] button').length).toBe(
      4,
    );
    expect(toast.querySelectorAll("#demo-toast-show, #demo-toast-toggle").length).toBe(0);
  });
});

describe("floating demos", () => {
  it("uses normal 8px offsets and real interactive surfaces", () => {
    for (const slug of [
      "popover",
      "tooltip",
      "preview-card",
      "menu",
      "context-menu",
      "select",
      "navigation-menu",
    ]) {
      expect(demo(slug)).toContain('side-offset="8"');
    }
  });

  it("renders navigation as a trigger bar with linked panels and arrows", () => {
    const nav = parse(demo("navigation-menu"));
    expect(nav.querySelectorAll("[data-nav-trigger]").length).toBe(2);
    expect(nav.querySelectorAll("[data-nav-panel] a").length).toBe(3);
    expect(nav.querySelectorAll("[data-nav-panel] [data-arrow]").length).toBe(2);
  });

  it("keeps select options and its value readout contract", () => {
    const select = parse(demo("select"));
    expect(select.querySelectorAll("[data-option]").length).toBe(3);
    const entry = COMPONENTS.find((item) => item.slug === "select");
    expect(entry?.readoutEvent).toBe("value-change");
    expect(entry?.readoutInitial).toBe("—");
  });
});
