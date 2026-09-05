import { isSignal } from "alien-signals";
import { describe, expect, it } from "vitest";
import { renderWithProps, useProp } from "./component-props";

// Observer delivery follows the browser microtask checkpoint.
function microtask(): Promise<void> {
  return new Promise<void>((resolve) => queueMicrotask(resolve));
}

describe("useProp", () => {
  it("synchronizes initial attributes, property assignments, signal writes and removal", async () => {
    const host = document.createElement("div") as HTMLDivElement & { label: string | null };
    host.setAttribute("label", "initial");
    const handle = renderWithProps(host, () => useProp("label"));
    handle.reconnect();
    const label = handle.result;
    expect(label()).toBe("initial");
    expect(host.label).toBe("initial");
    host.label = "property";
    expect(label()).toBe("property");
    expect(host.getAttribute("label")).toBe("property");
    label("signal");
    expect(host.label).toBe("signal");
    expect(host.getAttribute("label")).toBe("signal");
    host.setAttribute("label", "attribute");
    await microtask();
    expect(label()).toBe("attribute");
    host.removeAttribute("label");
    await microtask();
    expect(label()).toBeNull();
    label("");
    expect(host.getAttribute("label")).toBe("");
    label(null);
    expect(host.hasAttribute("label")).toBe(false);
    handle.dispose();
  });

  it("preserves pre-upgrade properties and shares only within the same instance", () => {
    const first = document.createElement("div");
    Object.defineProperty(first, "label", { value: "before upgrade", configurable: true });
    const handle = renderWithProps(first, () => ({
      label: useProp("label"),
      duplicate: useProp("label"),
    }));
    handle.reconnect();
    const second = renderWithProps(document.createElement("div"), () => useProp("label"));
    expect(handle.result.label).toBe(handle.result.duplicate);
    expect(handle.result.label()).toBe("before upgrade");
    handle.result.label("first only");
    expect(second.result()).toBeNull();
    handle.dispose();
    second.dispose();
  });

  it("restores render context after nested renders and thrown renders", () => {
    const outer = document.createElement("div");
    const inner = document.createElement("div");
    const handle = renderWithProps(outer, () => {
      expect(() =>
        renderWithProps(inner, () => {
          throw new Error("render failed");
        }),
      ).toThrow();
      return useProp("label");
    });
    handle.reconnect();
    handle.result("outer");
    expect(outer.getAttribute("label")).toBe("outer");
    expect(inner.hasAttribute("label")).toBe(false);
    expect(() => useProp("label")).toThrow();
    handle.dispose();
  });

  it.each(["", "BadName", "bad name", "onclick"])("rejects invalid prop name %s", (name) => {
    expect(() => renderWithProps(document.createElement("div"), () => useProp(name))).toThrow();
  });

  it("stops synchronization on dispose", async () => {
    const host = document.createElement("div");
    host.setAttribute("label", "initial");
    const handle = renderWithProps(host, () => useProp("label"));
    handle.reconnect();

    handle.dispose();
    handle.dispose();
    handle.result("detached-write");
    expect(host.getAttribute("label")).toBe("initial");
    host.setAttribute("label", "external-edit");
    await microtask();
    expect(handle.result()).toBe("detached-write");
  });

  it("prefers detached attribute edits on reconnect", () => {
    const host = document.createElement("div");
    host.setAttribute("label", "initial");
    const handle = renderWithProps(host, () => useProp("label"));

    handle.reconnect();
    handle.dispose();
    host.setAttribute("label", "attribute-edit");
    handle.reconnect();
    expect(handle.result()).toBe("attribute-edit");
    expect(host.getAttribute("label")).toBe("attribute-edit");
    handle.dispose();
  });

  it("reflects detached signal and property writes on reconnect", () => {
    const host = document.createElement("div") as HTMLDivElement & { label: string | null };
    host.setAttribute("label", "initial");
    const handle = renderWithProps(host, () => useProp("label"));

    handle.reconnect();
    handle.dispose();
    handle.result("signal-edit");
    expect(host.getAttribute("label")).toBe("initial");
    handle.reconnect();
    expect(handle.result()).toBe("signal-edit");
    expect(host.getAttribute("label")).toBe("signal-edit");

    handle.dispose();
    host.label = "property-edit";
    expect(host.getAttribute("label")).toBe("signal-edit");
    handle.reconnect();
    expect(handle.result()).toBe("property-edit");
    expect(host.getAttribute("label")).toBe("property-edit");
    handle.dispose();
  });

  it("leaves no live subscriptions when render fails", async () => {
    const host = document.createElement("div") as HTMLDivElement & { label: string | null };
    host.setAttribute("label", "initial");
    expect(() =>
      renderWithProps(host, () => {
        useProp("label");
        useProp("onclick");
      }),
    ).toThrow();
    host.setAttribute("label", "external");
    await microtask();
    expect(host.label).toBe("initial");
    host.label = "detached";
    expect(host.getAttribute("label")).toBe("external");
  });

  it("rejects non-string property assignments", () => {
    const host = document.createElement("div") as HTMLDivElement & { label: string | null };
    const handle = renderWithProps(host, () => useProp("label"));
    expect(() => {
      host.label = 42 as unknown as string;
    }).toThrow(TypeError);
    expect(handle.result()).toBeNull();
    handle.dispose();
  });
  it("rejects direct signal writes before connect and while detached", () => {
    const host = document.createElement("div");
    host.setAttribute("label", "initial");
    const handle = renderWithProps(host, () => useProp("label"));

    expect(isSignal(handle.result)).toBe(true);
    handle.result("");
    expect(handle.result()).toBe("");
    handle.result(null);
    expect(handle.result()).toBeNull();
    handle.result("initial");

    expect(() => handle.result(42 as unknown as string)).toThrow(TypeError);
    expect(handle.result()).toBe("initial");

    handle.reconnect();
    handle.dispose();
    expect(() => handle.result(undefined as unknown as string)).toThrow(TypeError);
    expect(handle.result()).toBe("initial");
  });

  it("rejects direct signal writes while connected without poisoning later updates", () => {
    const host = document.createElement("div");
    host.setAttribute("label", "initial");
    const handle = renderWithProps(host, () => useProp("label"));
    handle.reconnect();

    expect(() => handle.result(42 as unknown as string)).toThrow(TypeError);
    expect(handle.result()).toBe("initial");
    expect(host.getAttribute("label")).toBe("initial");

    handle.result("recovered");
    expect(handle.result()).toBe("recovered");
    expect(host.getAttribute("label")).toBe("recovered");
    handle.dispose();
  });

  it("rolls back subscriptions when initial property reflection throws", () => {
    const host = document.createElement("div");
    host.setAttribute("label", "initial");
    const handle = renderWithProps(host, () => useProp("label"));
    handle.result("queued");
    const setAttribute = host.setAttribute;
    host.setAttribute = function (name, value) {
      if (value === "queued") {
        throw new Error("reflection failed");
      }
      setAttribute.call(this, name, value);
    };

    expect(() => handle.reconnect()).toThrow("reflection failed");
    host.setAttribute = setAttribute;
    handle.result("detached");
    expect(host.getAttribute("label")).toBe("initial");
    handle.dispose();
  });

  it("rejects invalid pre-upgrade properties without replacing them", () => {
    const host = document.createElement("div") as HTMLDivElement & { label: unknown };
    Object.defineProperty(host, "label", {
      configurable: true,
      enumerable: true,
      value: 42,
      writable: true,
    });

    expect(() => renderWithProps(host, () => useProp("label"))).toThrow(TypeError);
    expect(host.label).toBe(42);
  });

  it("rejects replacing non-configurable or accessor properties", () => {
    const locked = document.createElement("div");
    Object.defineProperty(locked, "label", { value: "locked", configurable: false });
    expect(() => renderWithProps(locked, () => useProp("label"))).toThrow(TypeError);

    const getterOnly = document.createElement("div");
    Object.defineProperty(getterOnly, "label", { get: () => "computed", configurable: true });
    expect(() => renderWithProps(getterOnly, () => useProp("label"))).toThrow(TypeError);
  });

  it("reads empty attributes as empty strings and isolates prop names", () => {
    const host = document.createElement("div");
    host.setAttribute("label", "");
    const handle = renderWithProps(host, () => ({
      label: useProp("label"),
      mode: useProp("mode"),
    }));
    expect(handle.result.label()).toBe("");
    expect(handle.result.mode()).toBeNull();
    handle.result.label("named");
    expect(handle.result.mode()).toBeNull();
    expect(host.getAttribute("mode")).toBeNull();
    handle.dispose();
  });
});

describe("typed useProp", () => {
  const numberOptions = {
    attribute: "count",
    defaultValue: 0,
    fromAttribute: (raw: string | null) => (raw === null ? 0 : Number(raw)),
    fromProperty: (raw: unknown) => {
      if (typeof raw !== "number" || !Number.isFinite(raw))
        throw new TypeError("count must be finite");
      return raw;
    },
    toAttribute: String,
  } as const;

  it("hydrates aliases and callback-only properties assigned before render", () => {
    const host = document.createElement("div") as HTMLDivElement & {
      defaultValue: number;
      onChange: ((value: number) => void) | null;
    };
    const callback = () => {};
    Object.defineProperty(host, "defaultValue", { configurable: true, value: 4 });
    Object.defineProperty(host, "onChange", { configurable: true, value: callback });

    const handle = renderWithProps(host, () => ({
      defaultValue: useProp("defaultValue", { ...numberOptions, attribute: "default-value" }),
      onChange: useProp("onChange", {
        attribute: null,
        defaultValue: null as ((value: number) => void) | null,
        fromProperty(raw: unknown) {
          if (raw !== null && typeof raw !== "function") throw new TypeError("invalid callback");
          return raw as ((value: number) => void) | null;
        },
      }),
    }));

    expect(handle.result.defaultValue()).toBe(4);
    expect(host.getAttribute("default-value")).toBeNull();
    expect(handle.result.onChange()).toBe(callback);
    handle.reconnect();
    expect(host.getAttribute("default-value")).toBe("4");
    expect(host.onChange).toBe(callback);
    handle.dispose();
  });

  it("validates writes before mutation and handles reflected attribute removal", async () => {
    const host = document.createElement("div") as HTMLDivElement & { count: number };
    host.setAttribute("count", "2");
    const handle = renderWithProps(host, () => useProp("count", numberOptions));
    handle.reconnect();

    expect(host.count).toBe(2);
    expect(() => {
      host.count = Number.NaN;
    }).toThrow("count must be finite");
    expect(handle.result()).toBe(2);
    expect(host.getAttribute("count")).toBe("2");

    host.removeAttribute("count");
    await microtask();
    expect(host.count).toBe(0);
    handle.dispose();
  });

  it("supports custom public getters and setters without duplicate descriptors", () => {
    const host = document.createElement("div") as HTMLDivElement & { value: number };
    let local = 3;
    let controlled = false;
    const handle = renderWithProps(host, () =>
      useProp("value", {
        ...numberOptions,
        attribute: "value",
        get: () => local,
        onSet(value, commit) {
          controlled = true;
          local = value;
          commit(value);
        },
      }),
    );

    host.value = 7;
    expect(controlled).toBe(true);
    expect(host.value).toBe(7);
    expect(Object.hasOwn(host, "value")).toBe(true);
    handle.dispose();
  });
});
