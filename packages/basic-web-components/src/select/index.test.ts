import { afterEach, describe, expect, it, vi } from "vitest";
import { type BwcSelectElement } from "./index";
// Side-effect import: registering `bwc-select` happens on module load.
import "./index";

type SelectElement = BwcSelectElement;

function createSelect(options: { defaultValue?: string; value?: string } = {}) {
  const root = document.createElement("bwc-select") as SelectElement;
  if (options.defaultValue !== undefined) root.setAttribute("default-value", options.defaultValue);
  if (options.value !== undefined) root.setAttribute("value", options.value);

  const trigger = document.createElement("button");
  trigger.slot = "trigger";
  const display = document.createElement("span");
  display.dataset.value = "";
  trigger.append(display);
  const popup = document.createElement("div");
  popup.slot = "popup";
  const apple = document.createElement("div");
  apple.dataset.option = "";
  apple.dataset.value = "apple";
  apple.textContent = "Apple";
  const banana = document.createElement("div");
  banana.dataset.option = "";
  banana.dataset.value = "banana";
  banana.dataset.label = "Banana!";
  banana.textContent = "Banana";
  popup.append(apple, banana);
  root.append(trigger, popup);

  return { apple, banana, display, popup, root, trigger };
}

afterEach(() => document.body.replaceChildren());

describe("slot structure", () => {
  it("requires one button trigger and one div popup", () => {
    const root = document.createElement("bwc-select");
    const trigger = document.createElement("button");
    trigger.slot = "trigger";
    const first = document.createElement("div");
    first.slot = "popup";
    const second = document.createElement("div");
    second.slot = "popup";
    root.append(trigger, first, second);

    expect(() => document.body.append(root)).toThrow(TypeError);
  });
});

describe("open state", () => {
  it("toggles on trigger click", () => {
    const { popup, root, trigger } = createSelect();
    document.body.append(root);

    trigger.click();
    expect(root.open).toBe(true);
    expect(popup.hidden).toBe(false);
    expect(popup.getAttribute("role")).toBe("listbox");
    expect(popup.classList).toContain("select-popup");
    expect(popup.hasAttribute("data-floating")).toBe(true);
    trigger.click();
    expect(root.open).toBe(false);
  });

  it("opens, closes, and toggles through methods with events", () => {
    const { root } = createSelect();
    const callback = vi.fn();
    root.onOpenChange = callback;
    document.body.append(root);

    root.show();
    expect(root.open).toBe(true);
    root.toggle();
    expect(root.open).toBe(false);
    root.toggle(true);
    expect(root.open).toBe(true);
    root.close();
    expect(root.open).toBe(false);

    expect(callback.mock.calls).toEqual([[true], [false], [true], [false]]);
  });
  it("applies property writes after uncontrolled trigger transitions", () => {
    const { popup, root, trigger } = createSelect();
    const callback = vi.fn();
    root.onOpenChange = callback;
    document.body.append(root);

    trigger.click();
    root.open = false;

    expect(root.open).toBe(false);
    expect(popup.hidden).toBe(true);
    expect(callback.mock.calls).toEqual([[true], [false]]);
  });

  it("blocks opens while disabled", () => {
    const { root, trigger } = createSelect();
    document.body.append(root);

    root.disabled = true;
    trigger.click();
    root.show();
    expect(root.open).toBe(false);
  });
});

describe("value", () => {
  it("selects on option click, updates display, and fires value-change", () => {
    const { banana, display, root, trigger } = createSelect();
    const callback = vi.fn();
    const events: Array<unknown> = [];
    root.onValueChange = callback;
    root.addEventListener("value-change", (event) => events.push((event as CustomEvent).detail));
    document.body.append(root);

    trigger.click();
    banana.click();
    expect(root.value).toBe("banana");
    expect(display.textContent).toBe("Banana!");
    expect(banana.getAttribute("aria-selected")).toBe("true");
    expect(root.open).toBe(false);
    expect(callback.mock.calls).toEqual([["banana"]]);
    expect(events).toEqual([{ value: "banana" }]);
  });

  it("selects through selectValue() and clear()", () => {
    const { display, root } = createSelect();
    document.body.append(root);

    root.selectValue("apple");
    expect(root.value).toBe("apple");
    expect(display.textContent).toBe("Apple");
    root.clear();
    expect(root.value).toBe("");
  });

  it("applies value property writes and emits value-change", () => {
    const { display, root } = createSelect();
    const callback = vi.fn();
    root.onValueChange = callback;
    document.body.append(root);

    root.value = "banana";

    expect(root.value).toBe("banana");
    expect(display.textContent).toBe("Banana!");
    expect(callback).toHaveBeenCalledWith("banana");
  });

  it("reflects name into a hidden input", () => {
    const { root } = createSelect();
    root.setAttribute("name", "fruit");
    document.body.append(root);

    const hidden = root.querySelector("input[type='hidden']") as HTMLInputElement | null;
    expect(hidden?.name).toBe("fruit");
    root.selectValue("apple");
    expect(hidden?.value).toBe("apple");
  });

  it("ignores selection while readonly", () => {
    const { apple, root, trigger } = createSelect();
    document.body.append(root);

    root.readonly = true;
    trigger.click();
    apple.click();
    expect(root.value).toBe("");
    expect(root.open).toBe(true);
  });
});

describe("keyboard navigation", () => {
  it("moves highlight with ArrowDown and selects with Enter", () => {
    const { apple, banana, root, trigger } = createSelect();
    document.body.append(root);

    trigger.click();
    const popup = root.querySelector("[slot='popup']")!;
    popup.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "ArrowDown" }));
    expect(document.activeElement).toBe(apple);
    popup.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "ArrowDown" }));
    expect(document.activeElement).toBe(banana);
    popup.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "Enter" }));
    expect(root.value).toBe("banana");
    expect(root.open).toBe(false);
    expect(document.activeElement).toBe(trigger);
  });
});

describe("non-modal light-dismiss", () => {
  it("defaults modal to true", () => {
    const { root } = createSelect();
    document.body.append(root);
    expect(root.modal).toBe(true);
  });

  it("closes on outside pointerdown and Escape with modal=false", () => {
    const { popup, root, trigger } = createSelect();
    root.modal = false;
    document.body.append(root);

    trigger.click();
    expect(root.open).toBe(true);
    document.body.dispatchEvent(new Event("pointerdown", { bubbles: true }));
    expect(root.open).toBe(false);

    trigger.click();
    expect(root.open).toBe(true);
    popup.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "Escape" }));
    expect(root.open).toBe(false);
  });
});

describe("typeahead", () => {
  it("jumps to the label match without selecting", () => {
    const { banana, popup, root, trigger } = createSelect();
    document.body.append(root);

    trigger.click();
    popup.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "b" }));
    expect(document.activeElement).toBe(banana);
    expect(banana.hasAttribute("data-highlighted")).toBe(true);
    expect(root.value).toBe("");
  });

  it("opens from the trigger and jumps on the next tick", async () => {
    const { banana, root, trigger } = createSelect();
    document.body.append(root);

    trigger.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "b" }));
    expect(root.open).toBe(true);
    await Promise.resolve();
    expect(document.activeElement).toBe(banana);
  });
});

describe("multiple", () => {
  function createMultiSelect() {
    const built = createSelect();
    built.root.setAttribute("multiple", "");
    return built;
  }

  it("toggles options without closing and fires values-change", () => {
    const { apple, banana, display, root, trigger } = createMultiSelect();
    const callback = vi.fn();
    const events: Array<unknown> = [];
    root.onValuesChange = callback;
    root.addEventListener("values-change", (event) => events.push((event as CustomEvent).detail));
    document.body.append(root);

    trigger.click();
    apple.click();
    expect(root.open).toBe(true);
    banana.click();
    expect(root.open).toBe(true);
    expect(root.values).toEqual(["apple", "banana"]);
    expect(display.textContent).toBe("Apple, Banana!");
    expect(apple.getAttribute("aria-selected")).toBe("true");
    expect(callback.mock.calls).toEqual([[["apple"]], [["apple", "banana"]]]);
    expect(events).toEqual([{ values: ["apple"] }, { values: ["apple", "banana"] }]);

    apple.click();
    expect(root.values).toEqual(["banana"]);
    expect(root.open).toBe(true);
  });

  it("replaces values through selectValues() and clears to empty", () => {
    const { display, root } = createMultiSelect();
    document.body.append(root);

    root.selectValues(["banana", "apple"]);
    expect(root.values).toEqual(["banana", "apple"]);
    expect(display.textContent).toBe("Banana!, Apple");
    root.clear();
    expect(root.values).toEqual([]);
    expect(display.textContent).toBe("");
  });

  it("seeds from the values attribute", () => {
    const { banana, display, root } = createMultiSelect();
    root.setAttribute("values", '["banana"]');
    document.body.append(root);

    expect(root.values).toEqual(["banana"]);
    expect(display.textContent).toBe("Banana!");
    expect(banana.getAttribute("aria-selected")).toBe("true");
  });

  it("rejects non-string values arrays", () => {
    const { root } = createMultiSelect();
    document.body.append(root);

    expect(() => {
      root.values = ["apple", 42 as unknown as string];
    }).toThrow(TypeError);
  });
});

describe("form integration", () => {
  it("renders one hidden input per value with form association", () => {
    const { root } = createSelect();
    root.setAttribute("multiple", "");
    root.setAttribute("name", "fruit");
    root.setAttribute("form", "order");
    document.body.append(root);

    root.selectValues(["apple", "banana"]);
    const hidden = [...root.querySelectorAll("input[type='hidden']")] as HTMLInputElement[];
    expect(hidden.map((input) => input.value).sort()).toEqual(["apple", "banana"]);
    for (const input of hidden) {
      expect(input.name).toBe("fruit");
      expect(input.getAttribute("form")).toBe("order");
    }
    root.clear();
    expect(root.querySelectorAll("input[type='hidden']").length).toBe(0);
  });
});

describe("placeholder and affordances", () => {
  it("mirrors data-placeholder until a value is selected", () => {
    const { root, trigger } = createSelect();
    root.setAttribute("placeholder", "Pick one");
    document.body.append(root);

    expect(trigger.hasAttribute("data-placeholder")).toBe(true);
    root.selectValue("apple");
    expect(trigger.hasAttribute("data-placeholder")).toBe(false);
  });

  it("sizes the popup to the trigger width", () => {
    const { popup, root, trigger } = createSelect();
    trigger.getBoundingClientRect = () => ({ width: 200 }) as DOMRect;
    document.body.append(root);

    trigger.click();
    expect(popup.style.minWidth).toBe("200px");
  });

  it("scrolls the list from arrow buttons without selecting", () => {
    const { popup, root, trigger } = createSelect();
    const list = document.createElement("div");
    list.dataset.list = "";
    const up = document.createElement("button");
    up.dataset.scrollUp = "";
    const down = document.createElement("button");
    down.dataset.scrollDown = "";
    popup.prepend(up);
    popup.append(list, down);
    const scrollBy = vi.fn();
    list.scrollBy = scrollBy;
    document.body.append(root);

    trigger.click();
    expect(root.open).toBe(true);
    // Unscrolled content reports its edges honestly.
    down.removeAttribute("data-disabled");
    down.disabled = false;
    down.click();
    expect(scrollBy).toHaveBeenCalledOnce();
    expect(scrollBy.mock.calls[0]?.[0]).toMatchObject({ top: expect.any(Number) });
    expect(root.open).toBe(true);
    expect(root.value).toBe("");
  });
});

describe("modal scroll-lock and animation hooks", () => {
  it("locks document scroll and sets data-starting-style", async () => {
    const { popup, root, trigger } = createSelect();
    document.body.append(root);

    trigger.click();
    expect(document.documentElement.style.overflow).toBe("hidden");
    expect(popup.hasAttribute("data-starting-style")).toBe(true);
    await new Promise((resolve) => requestAnimationFrame(resolve));
    expect(popup.hasAttribute("data-starting-style")).toBe(false);
    root.close();
    expect(document.documentElement.style.overflow).toBe("");
    expect(popup.hidden).toBe(true);
  });
});
