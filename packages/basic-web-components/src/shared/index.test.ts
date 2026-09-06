import { describe, expect, it, vi } from "vitest";
import {
  booleanProp,
  callbackValue,
  decorateButton,
  enumValue,
  finiteNumber,
  numberProp,
  observeSlotSubtree,
  parseJsonStrings,
  partClassName,
  requireSlottedElement,
  slottedElements,
  stringProp,
} from "./index";

describe("native slot lookup", () => {
  it("finds direct assigned elements without crossing nested component roots", () => {
    const host = document.createElement("div");
    host.innerHTML = `<button slot="trigger"></button><div><button slot="trigger"></button></div>`;

    expect(slottedElements(host, "trigger", HTMLButtonElement)).toEqual([host.firstElementChild]);
    expect(requireSlottedElement(host, "trigger", HTMLButtonElement)).toBe(host.firstElementChild);
  });

  it("rejects missing, duplicate, and wrong element types", () => {
    const host = document.createElement("div");
    expect(() => requireSlottedElement(host, "trigger", HTMLButtonElement)).toThrow(
      /exactly one button/,
    );

    host.innerHTML = `<div slot="trigger"></div>`;
    expect(() => requireSlottedElement(host, "trigger", HTMLButtonElement)).toThrow(
      /must be a button/,
    );

    host.innerHTML = `<button slot="trigger"></button><button slot="trigger"></button>`;
    expect(() => requireSlottedElement(host, "trigger", HTMLButtonElement)).toThrow(
      /exactly one button/,
    );
  });
});

describe("slot subtree observation", () => {
  it("syncs initially, reports author records, reacts to slot changes, and disposes", async () => {
    const host = document.createElement("div");
    host.attachShadow({ mode: "open" }).innerHTML = `<slot name="item"></slot>`;
    const batches: Array<readonly MutationRecord[]> = [];
    const dispose = observeSlotSubtree(host, (records) => batches.push(records), ["value"]);
    expect(batches).toEqual([[]]);

    const item = document.createElement("div");
    item.slot = "item";
    host.append(item);
    await Promise.resolve();
    await Promise.resolve();
    expect(batches).toHaveLength(2);
    expect(batches[1]?.some((record) => record.type === "childList")).toBe(true);

    item.setAttribute("value", "changed");
    await Promise.resolve();
    await Promise.resolve();
    expect(batches).toHaveLength(3);
    expect(batches[2]?.map((record) => record.attributeName)).toEqual(["value"]);

    dispose();
    item.setAttribute("value", "ignored");
    await Promise.resolve();
    expect(batches).toHaveLength(3);
  });

  it("ignores mutations caused by sync while retaining later author changes", async () => {
    const host = document.createElement("div");
    const item = document.createElement("div");
    host.append(item);
    const sync = vi.fn(() => item.setAttribute("value", "normalized"));
    const dispose = observeSlotSubtree(host, sync, ["value"]);

    await Promise.resolve();
    await Promise.resolve();
    expect(sync).toHaveBeenCalledOnce();

    item.setAttribute("value", "author");
    await Promise.resolve();
    await Promise.resolve();
    expect(sync).toHaveBeenCalledTimes(2);
    await Promise.resolve();
    expect(sync).toHaveBeenCalledTimes(2);
    dispose();
  });
});

describe("button decoration", () => {
  it("preserves author classes and supplies stable interactive metadata", () => {
    const button = document.createElement("button");
    button.className = "author";
    decorateButton(button, "control", "bwc-control", button.className);

    expect(button.className).toBe("control author");
    expect(button.dataset.testid).toBe("bwc-control");
    expect(button.type).toBe("button");
    expect(button.style.cursor).toBe("pointer");
    expect(button.style.userSelect).toBe("none");
  });
});

describe("part class composition", () => {
  it.each([
    ["marker", "", "", "marker"],
    ["marker", "author marker author", "special marker", "marker author special"],
    ["marker", "  author\tother  ", " other special ", "marker author other special"],
  ])("composes stable marker, author, and part classes", (marker, author, part, expected) => {
    expect(partClassName(marker, author, part)).toBe(expected);
  });
});

describe("shared input validation", () => {
  it("validates JSON arrays, callbacks, finite numbers, and enums", () => {
    expect(parseJsonStrings('["a","b"]', "value")).toEqual(["a", "b"]);
    expect(() => parseJsonStrings('["a",""]', "value")).toThrow(/JSON string array/);
    expect(() => finiteNumber("Infinity", "offset")).toThrow(/finite/);
    expect(() => enumValue("diagonal", ["top", "bottom"] as const, "bottom", "side")).toThrow(
      /side must be one of/,
    );
    expect(() => callbackValue(3, "onChange")).toThrow(/function or null/);
  });

  it("provides reusable strict boolean, string, and numeric prop codecs", () => {
    const enabled = booleanProp("enabled");
    expect(enabled.fromAttribute(null)).toBe(false);
    expect(enabled.fromAttribute("")).toBe(true);
    expect(enabled.toAttribute(true)).toBe("");
    expect(enabled.toAttribute(false)).toBeNull();
    expect(() => enabled.fromProperty("true")).toThrow(/boolean/);

    const label = stringProp("label", "fallback");
    expect(label.fromAttribute(null)).toBe("fallback");
    expect(label.fromProperty("value")).toBe("value");
    expect(() => label.fromProperty(1)).toThrow(/string/);

    const count = numberProp("count", 2);
    expect(count.fromAttribute(null)).toBe(2);
    expect(count.fromAttribute("3")).toBe(3);
    expect(() => count.fromProperty(Number.NaN)).toThrow(/finite/);
  });
});
