import { describe, expect, it } from "vitest";
import { renderWithProps, useProp } from "./component-props";

// Observer delivery follows the browser microtask checkpoint.
describe("useProp", () => {
  it("synchronizes initial attributes, property assignments, signal writes and removal", async () => {
    const host = document.createElement("div") as HTMLDivElement & { label: string | null };
    host.setAttribute("label", "initial");
    const label = renderWithProps(host, () => useProp("label"));
    expect(label()).toBe("initial");
    expect(host.label).toBe("initial");
    host.label = "property";
    expect(label()).toBe("property");
    expect(host.getAttribute("label")).toBe("property");
    label("signal");
    expect(host.label).toBe("signal");
    expect(host.getAttribute("label")).toBe("signal");
    host.setAttribute("label", "attribute");
    await new Promise<void>((resolve) => queueMicrotask(resolve));
    expect(label()).toBe("attribute");
    host.removeAttribute("label");
    await new Promise<void>((resolve) => queueMicrotask(resolve));
    expect(label()).toBeNull();
    label("");
    expect(host.getAttribute("label")).toBe("");
    label(null);
    expect(host.hasAttribute("label")).toBe(false);
  });

  it("preserves pre-upgrade properties and shares only within the same instance", () => {
    const first = document.createElement("div");
    Object.defineProperty(first, "label", { value: "before upgrade", configurable: true });
    const [label, duplicate] = renderWithProps(first, () => [useProp("label"), useProp("label")]);
    const second = renderWithProps(document.createElement("div"), () => useProp("label"));
    expect(label).toBe(duplicate);
    expect(label!()).toBe("before upgrade");
    label!("first only");
    expect(second()).toBeNull();
  });

  it("restores render context after nested renders and thrown renders", () => {
    const outer = document.createElement("div");
    const inner = document.createElement("div");
    renderWithProps(outer, () => {
      expect(() =>
        renderWithProps(inner, () => {
          throw new Error("render failed");
        }),
      ).toThrow();
      useProp("label")("outer");
    });
    expect(outer.getAttribute("label")).toBe("outer");
    expect(inner.hasAttribute("label")).toBe(false);
    expect(() => useProp("label")).toThrow();
  });

  it.each(["", "BadName", "bad name", "onclick"])("rejects invalid prop name %s", (name) => {
    expect(() => renderWithProps(document.createElement("div"), () => useProp(name))).toThrow();
  });
});
