import { afterEach, describe, expect, it, vi } from "vitest";
import { BwcAccordionElement } from "./index";

type AccordionApi = HTMLElement & {
  value: string[];
  defaultValue: string[];
  multiple: boolean;
  disabled: boolean;
  onValueChange: ((value: string[]) => void) | null;
};

type AccordionItem = {
  details: HTMLDetailsElement;
  summary: HTMLElement;
  panel: HTMLElement;
};

function item(value: string, disabled = false): AccordionItem {
  const details = document.createElement("details");
  const summary = document.createElement("summary");
  const panel = document.createElement("div");
  details.slot = "item";
  details.dataset.value = value;
  details.toggleAttribute("disabled", disabled);
  summary.textContent = `${value} title`;
  panel.textContent = `${value} content`;
  details.append(summary, panel);
  return { details, summary, panel };
}

function accordion(...items: AccordionItem[]): AccordionApi {
  const root = document.createElement("bwc-accordion") as AccordionApi;
  root.append(...items.map(({ details }) => details));
  document.body.append(root);
  return root;
}

async function settle(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

async function toggle(details: HTMLDetailsElement, open: boolean): Promise<void> {
  details.open = open;
  details.dispatchEvent(new Event("toggle"));
  await settle();
}

afterEach(() => {
  vi.unstubAllGlobals();
  document.body.replaceChildren();
});

describe("native accordion", () => {
  it("projects direct details items and initializes the default exactly once", async () => {
    const one = item("one");
    const two = item("two");
    const root = document.createElement("bwc-accordion") as AccordionApi;
    root.defaultValue = ["two"];
    root.append(one.details, two.details);
    document.body.append(root);
    await settle();

    expect(root.shadowRoot?.querySelector('slot[name="item"]')).not.toBeNull();
    expect(root.value).toEqual(["two"]);
    expect(one.details.open).toBe(false);
    expect(two.details.open).toBe(true);
    expect(two.details.hasAttribute("data-open")).toBe(true);
    expect(two.summary.hasAttribute("data-open")).toBe(true);
    expect(two.panel.hasAttribute("data-open")).toBe(true);

    root.defaultValue = ["one"];
    await settle();
    expect(root.value).toEqual(["two"]);
  });

  it("uses native toggles for single and multiple uncontrolled values", async () => {
    const one = item("one");
    const two = item("two");
    const root = accordion(one, two);
    const changes = vi.fn();
    root.onValueChange = changes;

    await toggle(one.details, true);
    expect(root.value).toEqual(["one"]);
    expect(changes).toHaveBeenLastCalledWith(["one"]);

    await toggle(two.details, true);
    expect(root.value).toEqual(["two"]);
    expect(one.details.open).toBe(false);

    root.multiple = true;
    await toggle(one.details, true);
    expect(root.value).toEqual(["two", "one"]);
    expect(one.details.open).toBe(true);
    expect(two.details.open).toBe(true);
  });

  it("emits a composed change after the native state changes", async () => {
    const one = item("one");
    const root = accordion(one);
    const order: string[] = [];
    root.onValueChange = () => order.push(`callback:${one.details.open}`);
    document.body.addEventListener(
      "value-change",
      (event) => {
        order.push(`event:${(event as CustomEvent<{ value: string[] }>).detail.value.join()}`);
      },
      { once: true },
    );

    await toggle(one.details, true);

    expect(order).toEqual(["callback:true", "event:one"]);
  });

  it("keeps controlled state authoritative and resets when control is removed", async () => {
    const one = item("one");
    const two = item("two");
    const root = document.createElement("bwc-accordion") as AccordionApi;
    root.defaultValue = ["one"];
    root.value = ["two"];
    root.append(one.details, two.details);
    document.body.append(root);
    const changes = vi.fn();
    root.onValueChange = changes;
    await settle();

    await toggle(one.details, true);
    expect(changes).toHaveBeenCalledWith(["one"]);
    expect(root.value).toEqual(["two"]);
    expect(one.details.open).toBe(false);
    expect(two.details.open).toBe(true);

    root.removeAttribute("value");
    await settle();
    expect(root.value).toEqual([]);
    expect(one.details.open).toBe(false);
    expect(two.details.open).toBe(false);
  });

  it("blocks root and item disabled toggles and exposes disabled affordances", async () => {
    const one = item("one", true);
    const two = item("two");
    const root = accordion(one, two);
    const changes = vi.fn();
    root.onValueChange = changes;
    await settle();

    await toggle(one.details, true);
    expect(root.value).toEqual([]);
    expect(one.details.open).toBe(false);
    expect(one.summary.style.cursor).toBe("not-allowed");
    expect(one.summary.getAttribute("aria-disabled")).toBe("true");

    root.disabled = true;
    await settle();
    await toggle(two.details, true);
    expect(root.value).toEqual([]);
    expect(two.details.open).toBe(false);
    expect(two.summary.style.cursor).toBe("not-allowed");
    expect(changes).not.toHaveBeenCalled();
  });

  it("validates unique nonempty direct item values and single values", () => {
    const empty = item("");
    expect(() => accordion(empty)).toThrow(/unique and nonempty/);
    document.body.replaceChildren();

    const duplicateOne = item("same");
    const duplicateTwo = item("same");
    expect(() => accordion(duplicateOne, duplicateTwo)).toThrow(/unique and nonempty/);
    document.body.replaceChildren();

    const root = document.createElement("bwc-accordion") as AccordionApi;
    root.multiple = false;
    expect(() => {
      root.value = ["one", "two"];
    }).toThrow(/at most one/);
  });

  it("reacts to direct item additions, removals, values, and disabled state", async () => {
    const one = item("one");
    const root = accordion(one);
    await settle();

    const two = item("two");
    root.append(two.details);
    await settle();
    await toggle(two.details, true);
    expect(root.value).toEqual(["two"]);

    two.details.dataset.value = "renamed";
    await settle();
    expect(root.value).toEqual(["two"]);
    expect(two.details.open).toBe(false);

    two.details.toggleAttribute("disabled", true);
    await settle();
    expect(two.summary.style.cursor).toBe("not-allowed");

    two.details.remove();
    await settle();
    expect(root.value).toEqual(["two"]);
  });

  it("preserves uncontrolled state and restores listeners on reconnect", async () => {
    const one = item("one");
    const two = item("two");
    const root = accordion(one, two);
    root.defaultValue = ["one"];
    const changes = vi.fn();
    root.onValueChange = changes;
    await settle();
    await toggle(two.details, true);

    root.remove();
    document.body.append(root);
    await settle();

    expect(root.value).toEqual(["two"]);
    expect(two.details.open).toBe(true);
    await toggle(two.details, false);
    expect(root.value).toEqual([]);
    expect(changes).toHaveBeenCalledTimes(2);
  });

  it("decorates each interactive summary without making meaningful content unselectable", async () => {
    const one = item("one");
    accordion(one);
    await settle();

    expect(one.summary.dataset.testid).toBeTruthy();
    expect(one.summary.id || one.summary.className).toBeTruthy();
    expect(one.summary.style.cursor).toBe("pointer");
    expect(one.summary.style.userSelect).not.toBe("none");
    expect(one.panel.style.userSelect).not.toBe("none");
  });
  it("does not retain toggle listeners when observer setup fails", () => {
    const NativeMutationObserver = MutationObserver;
    let constructions = 0;
    class FailingMutationObserver extends NativeMutationObserver {
      constructor(callback: MutationCallback) {
        super(callback);
        constructions += 1;
        if (constructions === 2) throw new Error("observer setup failed");
      }
    }
    vi.stubGlobal("MutationObserver", FailingMutationObserver);
    const one = item("one");
    const root = document.createElement("bwc-accordion") as AccordionApi;
    const changes = vi.fn();
    root.onValueChange = changes;
    root.append(one.details);

    expect(() => document.body.append(root)).toThrow("observer setup failed");
    vi.unstubAllGlobals();
    one.details.open = true;
    one.details.dispatchEvent(new Event("toggle"));

    expect(changes).not.toHaveBeenCalled();
  });

  it("closes the open item in the same task as a summary click, so switches never paint both open", async () => {
    const one = item("one");
    const two = item("two");
    const root = document.createElement("bwc-accordion") as AccordionApi;
    root.defaultValue = ["one"];
    root.append(one.details, two.details);
    document.body.append(root);
    const changes = vi.fn();
    root.onValueChange = changes;
    await settle();
    expect(one.details.open).toBe(true);

    // Real click order: the click event (capture) lands before the UA
    // toggles the clicked details, and each toggle queues its event after.
    two.summary.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    // The pre-close runs in the click task (same task as the native toggle
    // of the clicked item), so both items are never open together — no
    // both-open frame can paint, whatever the backend's activation behavior.
    expect(one.details.open && two.details.open).toBe(false);

    two.details.open = true;
    // Only the opening toggle is dispatched manually: the pre-close echo
    // arrives on its own in browsers (and in DOM backends that auto-fire
    // toggle), and the guard above must swallow it without emitting.
    two.details.dispatchEvent(new Event("toggle"));
    await settle();

    expect(root.value).toEqual(["two"]);
    expect(one.details.open).toBe(false);
    expect(two.details.open).toBe(true);
    expect(changes).toHaveBeenCalledTimes(1);
    expect(changes).toHaveBeenCalledWith(["two"]);
  });
});

it("retains a constructible root export", () => {
  expect(new BwcAccordionElement()).toBeInstanceOf(HTMLElement);
});
