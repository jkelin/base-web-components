import { afterEach, describe, expect, it, vi } from "vitest";
import { type BwcMenuElement } from "./index";
// Side-effect import: registering `bwc-menu` happens on module load.
import "./index";

type MenuElement = BwcMenuElement;

function createMenu(options: { defaultOpen?: boolean; open?: boolean } = {}) {
  const root = document.createElement("bwc-menu") as MenuElement;
  root.toggleAttribute("default-open", options.defaultOpen ?? false);
  root.toggleAttribute("open", options.open ?? false);

  const trigger = document.createElement("button");
  trigger.slot = "trigger";
  trigger.textContent = "Open";
  const popup = document.createElement("div");
  popup.slot = "popup";
  const first = document.createElement("button");
  first.dataset.menuItem = "";
  first.textContent = "First";
  const second = document.createElement("button");
  second.dataset.menuItem = "";
  second.textContent = "Second";
  popup.append(first, second);
  root.append(trigger, popup);

  return { first, popup, root, second, trigger };
}

afterEach(() => document.body.replaceChildren());

describe("slot structure", () => {
  it("requires one button trigger and one div popup", () => {
    const root = document.createElement("bwc-menu");
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
    const { popup, root, trigger } = createMenu();
    document.body.append(root);

    expect(popup.hidden).toBe(true);
    trigger.click();
    expect(root.open).toBe(true);
    expect(popup.hidden).toBe(false);
    expect(popup.getAttribute("role")).toBe("menu");
    expect(popup.classList).toContain("menu-popup");
    expect(popup.hasAttribute("data-floating")).toBe(true);
    trigger.click();
    expect(root.open).toBe(false);
  });

  it("opens, closes, and toggles through methods with events", () => {
    const { popup, root } = createMenu();
    const callback = vi.fn();
    const events: Array<unknown> = [];
    root.onOpenChange = callback;
    root.addEventListener("open-change", (event) => events.push((event as CustomEvent).detail));
    document.body.append(root);

    root.show();
    expect(root.open).toBe(true);
    expect(popup.hidden).toBe(false);

    root.toggle();
    expect(root.open).toBe(false);
    root.toggle(true);
    expect(root.open).toBe(true);
    root.close();
    expect(root.open).toBe(false);

    expect(callback.mock.calls).toEqual([[true], [false], [true], [false]]);
    expect(events).toEqual([{ open: true }, { open: false }, { open: true }, { open: false }]);
  });
  it("applies property writes after uncontrolled trigger transitions", () => {
    const { popup, root, trigger } = createMenu();
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
    const { root, trigger } = createMenu();
    document.body.append(root);

    root.disabled = true;
    trigger.click();
    root.show();
    expect(root.open).toBe(false);
    expect(trigger.disabled).toBe(true);
  });

  it("closes on item click and keeps open with data-close-on-click=false", () => {
    const { first, root, second, trigger } = createMenu();
    document.body.append(root);

    trigger.click();
    first.click();
    expect(root.open).toBe(false);

    second.dataset.closeOnClick = "false";
    trigger.click();
    second.click();
    expect(root.open).toBe(true);
  });

  it("returns focus to the trigger on Escape", () => {
    const { popup, root, trigger } = createMenu();
    document.body.append(root);

    trigger.click();
    popup.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "Escape" }));
    expect(root.open).toBe(false);
    expect(document.activeElement).toBe(trigger);
  });
});

describe("keyboard navigation", () => {
  it("moves highlight with ArrowDown and activates with Enter", () => {
    const clicked: string[] = [];
    const { first, root, second, trigger } = createMenu();
    first.addEventListener("click", () => clicked.push("first"));
    second.addEventListener("click", () => clicked.push("second"));
    document.body.append(root);

    trigger.click();
    const popup = root.querySelector("[slot='popup']")!;
    popup.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "ArrowDown" }));
    expect(document.activeElement).toBe(first);
    popup.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "ArrowDown" }));
    expect(document.activeElement).toBe(second);
    popup.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "Enter" }));
    expect(clicked).toEqual(["second"]);
    expect(root.open).toBe(false);
  });

  it("skips disabled items", () => {
    const { first, root, second, trigger } = createMenu();
    second.dataset.disabled = "";
    document.body.append(root);

    trigger.click();
    const popup = root.querySelector("[slot='popup']")!;
    popup.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "ArrowDown" }));
    expect(document.activeElement).toBe(first);
    popup.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "ArrowDown" }));
    expect(document.activeElement).toBe(first);
  });
});

describe("non-modal light-dismiss", () => {
  it("defaults modal to true", () => {
    const { root } = createMenu();
    document.body.append(root);
    expect(root.modal).toBe(true);
  });

  it("closes on outside pointerdown and Escape with modal=false", () => {
    const { popup, root, trigger } = createMenu();
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
  function createFruitMenu() {
    const root = document.createElement("bwc-menu") as MenuElement;
    const trigger = document.createElement("button");
    trigger.slot = "trigger";
    trigger.textContent = "Open";
    const popup = document.createElement("div");
    popup.slot = "popup";
    const apple = document.createElement("button");
    apple.dataset.menuItem = "";
    apple.textContent = "Apple";
    const avocado = document.createElement("button");
    avocado.dataset.menuItem = "";
    avocado.textContent = "Avocado";
    const banana = document.createElement("button");
    banana.dataset.menuItem = "";
    banana.textContent = "Banana";
    popup.append(apple, avocado, banana);
    root.append(trigger, popup);
    return { apple, avocado, banana, popup, root, trigger };
  }

  function typeKey(target: Element, key: string) {
    target.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key }));
  }

  it("jumps to the first label match", () => {
    const { banana, popup, root, trigger } = createFruitMenu();
    document.body.append(root);

    trigger.click();
    typeKey(popup, "b");
    expect(document.activeElement).toBe(banana);
    expect(banana.hasAttribute("data-highlighted")).toBe(true);
  });

  it("accumulates characters and cycles on repeats", () => {
    const { apple, avocado, banana, popup, root, trigger } = createFruitMenu();
    document.body.append(root);

    trigger.click();
    typeKey(popup, "a");
    expect(document.activeElement).toBe(apple);
    typeKey(popup, "a");
    expect(document.activeElement).toBe(avocado);
    typeKey(popup, "v");
    expect(document.activeElement).toBe(avocado);
    expect(banana.hasAttribute("data-highlighted")).toBe(false);
  });

  it("skips disabled items", () => {
    const { banana, popup, root, trigger } = createFruitMenu();
    banana.dataset.disabled = "";
    document.body.append(root);

    trigger.click();
    typeKey(popup, "b");
    expect(document.activeElement).not.toBe(banana);
    expect(banana.hasAttribute("data-highlighted")).toBe(false);
  });
});

describe("checkbox and radio items", () => {
  function createCheckableMenu() {
    const root = document.createElement("bwc-menu") as MenuElement;
    const trigger = document.createElement("button");
    trigger.slot = "trigger";
    trigger.textContent = "Open";
    const popup = document.createElement("div");
    popup.slot = "popup";
    const plain = document.createElement("button");
    plain.dataset.menuItem = "";
    plain.textContent = "Plain";
    const check = document.createElement("button");
    check.dataset.menuItem = "";
    check.dataset.checkboxItem = "";
    check.textContent = "Notify";
    const group = document.createElement("div");
    group.dataset.radioGroup = "";
    group.dataset.name = "size";
    const small = document.createElement("button");
    small.dataset.menuItem = "";
    small.dataset.radioItem = "";
    small.dataset.value = "small";
    small.textContent = "Small";
    const large = document.createElement("button");
    large.dataset.menuItem = "";
    large.dataset.radioItem = "";
    large.dataset.value = "large";
    large.textContent = "Large";
    group.append(small, large);
    popup.append(plain, check, group);
    root.append(trigger, popup);
    return { check, group, large, plain, popup, root, small, trigger };
  }

  it("toggles checkbox items without closing and fires checked-change", () => {
    const { check, popup, root, trigger } = createCheckableMenu();
    const events: Array<unknown> = [];
    root.addEventListener("checked-change", (event) => events.push((event as CustomEvent).detail));
    document.body.append(root);

    trigger.click();
    expect(check.getAttribute("role")).toBe("menuitemcheckbox");
    check.click();
    expect(check.hasAttribute("data-checked")).toBe(true);
    expect(check.getAttribute("aria-checked")).toBe("true");
    expect(root.open).toBe(true);
    expect(events).toEqual([{ checked: true, value: "Notify" }]);

    popup.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "Enter" }));
    check.focus();
    popup.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "Enter" }));
    expect(check.hasAttribute("data-checked")).toBe(false);
    expect(root.open).toBe(true);
  });

  it("selects radio items within their group and fires radio-change", () => {
    const { group, large, root, small, trigger } = createCheckableMenu();
    const events: Array<unknown> = [];
    root.addEventListener("radio-change", (event) => events.push((event as CustomEvent).detail));
    document.body.append(root);

    trigger.click();
    expect(large.getAttribute("role")).toBe("menuitemradio");
    large.click();
    expect(group.dataset.value).toBe("large");
    expect(large.hasAttribute("data-checked")).toBe(true);
    expect(small.hasAttribute("data-checked")).toBe(false);
    expect(large.getAttribute("aria-checked")).toBe("true");
    expect(root.open).toBe(true);
    expect(events).toEqual([{ value: "large", group: "size" }]);

    small.click();
    expect(group.dataset.value).toBe("small");
    expect(small.hasAttribute("data-checked")).toBe(true);
    expect(large.hasAttribute("data-checked")).toBe(false);
  });

  it("closes on plain items but stays open on checkables", () => {
    const { check, plain, root, trigger } = createCheckableMenu();
    document.body.append(root);

    trigger.click();
    plain.click();
    expect(root.open).toBe(false);

    trigger.click();
    check.click();
    expect(root.open).toBe(true);
  });
});

describe("groups and separators", () => {
  it("assigns group and separator roles", () => {
    const root = document.createElement("bwc-menu") as MenuElement;
    const trigger = document.createElement("button");
    trigger.slot = "trigger";
    const popup = document.createElement("div");
    popup.slot = "popup";
    const group = document.createElement("div");
    group.dataset.group = "";
    const label = document.createElement("div");
    label.dataset.groupLabel = "";
    label.textContent = "Actions";
    const item = document.createElement("button");
    item.dataset.menuItem = "";
    item.textContent = "Edit";
    group.append(label, item);
    const separator = document.createElement("div");
    separator.dataset.separator = "";
    popup.append(group, separator);
    root.append(trigger, popup);
    document.body.append(root);

    expect(separator.getAttribute("role")).toBe("separator");
    expect(group.getAttribute("role")).toBe("group");
    expect(group.getAttribute("aria-labelledby")).toBe(label.id);
    expect(label.id).not.toBe("");
  });
});

describe("modal scroll-lock", () => {
  it("locks document scroll while open and restores on close", () => {
    const { root, trigger } = createMenu();
    document.body.append(root);

    trigger.click();
    expect(document.documentElement.style.overflow).toBe("hidden");
    root.close();
    expect(document.documentElement.style.overflow).toBe("");
  });

  it("skips the lock when modal is false", () => {
    const { root, trigger } = createMenu();
    root.modal = false;
    document.body.append(root);

    trigger.click();
    expect(document.documentElement.style.overflow).toBe("");
  });
});

describe("animation hooks", () => {
  it("sets data-starting-style on open and clears it next frame", async () => {
    const { popup, root, trigger } = createMenu();
    document.body.append(root);
    trigger.click();
    expect(popup.hasAttribute("data-starting-style")).toBe(true);
    await new Promise((resolve) => requestAnimationFrame(resolve));
    expect(popup.hasAttribute("data-starting-style")).toBe(false);
  });

  it("hides synchronously without transitions and mirrors data-modal", () => {
    const { popup, root, trigger } = createMenu();
    document.body.append(root);

    trigger.click();
    expect(popup.hasAttribute("data-modal")).toBe(true);
    root.close();
    expect(popup.hidden).toBe(true);
    expect(popup.hasAttribute("data-ending-style")).toBe(false);
  });
});

describe("hover open delay", () => {
  it("opens after the hover delay", () => {
    vi.useFakeTimers();
    try {
      const { root, trigger } = createMenu();
      root.setAttribute("open-on-hover", "");
      root.setAttribute("delay", "100");
      document.body.append(root);

      trigger.dispatchEvent(new PointerEvent("pointerenter", { bubbles: true }));
      expect(root.open).toBe(false);
      vi.advanceTimersByTime(100);
      expect(root.open).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });
});
