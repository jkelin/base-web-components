import { afterEach, describe, expect, it, vi } from "vitest";
import { type BwcContextMenuElement } from "./index";
// Side-effect import: registering `bwc-context-menu` happens on module load.
import "./index";

type ContextMenuElement = BwcContextMenuElement;

function createContextMenu(options: { defaultOpen?: boolean; open?: boolean } = {}) {
  const root = document.createElement("bwc-context-menu") as ContextMenuElement;
  root.toggleAttribute("default-open", options.defaultOpen ?? false);
  root.toggleAttribute("open", options.open ?? false);

  const trigger = document.createElement("div");
  trigger.slot = "trigger";
  trigger.textContent = "Region";
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

function openAt(trigger: HTMLElement, x = 50, y = 60) {
  trigger.dispatchEvent(
    new MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: x, clientY: y }),
  );
}

afterEach(() => document.body.replaceChildren());

describe("slot structure", () => {
  it("accepts any element trigger but exactly one div popup", () => {
    const root = document.createElement("bwc-context-menu");
    const trigger = document.createElement("section");
    trigger.slot = "trigger";
    const popup = document.createElement("div");
    popup.slot = "popup";
    root.append(trigger, popup);

    expect(() => document.body.append(root)).not.toThrow();
    expect(popup.classList).toContain("context-menu-popup");
    expect(popup.hasAttribute("data-floating")).toBe(true);
  });

  it("rejects duplicate popups", () => {
    const root = document.createElement("bwc-context-menu");
    const trigger = document.createElement("div");
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
  it("opens on contextmenu anchored at the pointer", () => {
    const { popup, root, trigger } = createContextMenu();
    vi.spyOn(popup, "getBoundingClientRect").mockReturnValue({
      bottom: 0,
      height: 60,
      left: 0,
      right: 0,
      top: 0,
      width: 120,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });
    document.body.append(root);

    openAt(trigger, 50, 60);
    expect(root.open).toBe(true);
    expect(popup.hidden).toBe(false);
    expect(popup.getAttribute("role")).toBe("menu");
    expect(popup.style.left).toBe("50px");
    expect(popup.style.top).toBe("60px");
  });
  it("anchors show() to the trigger when no pointer position exists", () => {
    const { popup, root, trigger } = createContextMenu();
    vi.spyOn(trigger, "getBoundingClientRect").mockReturnValue({
      bottom: 40,
      height: 20,
      left: 100,
      right: 180,
      top: 20,
      width: 80,
      x: 100,
      y: 20,
      toJSON: () => ({}),
    });
    vi.spyOn(popup, "getBoundingClientRect").mockReturnValue({
      bottom: 0,
      height: 60,
      left: 0,
      right: 0,
      top: 0,
      width: 120,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });
    document.body.append(root);

    root.show();

    expect(popup.style.left).toBe("100px");
    expect(popup.style.top).toBe("40px");
  });

  it("opens, closes, and toggles through methods with events", () => {
    const { popup, root, trigger } = createContextMenu();
    const callback = vi.fn();
    root.onOpenChange = callback;
    document.body.append(root);

    openAt(trigger);
    expect(root.open).toBe(true);
    root.toggle();
    expect(root.open).toBe(false);
    root.toggle(true);
    expect(root.open).toBe(true);
    root.close();
    expect(root.open).toBe(false);
    expect(popup.hidden).toBe(true);

    expect(callback.mock.calls).toEqual([[true], [false], [true], [false]]);
  });
  it("applies property writes after uncontrolled opens", () => {
    const { popup, root, trigger } = createContextMenu();
    const callback = vi.fn();
    root.onOpenChange = callback;
    document.body.append(root);

    openAt(trigger);
    root.open = false;

    expect(root.open).toBe(false);
    expect(popup.hidden).toBe(true);
    expect(callback.mock.calls).toEqual([[true], [false]]);
  });

  it("blocks opens while disabled", () => {
    const { root, trigger } = createContextMenu();
    document.body.append(root);

    root.disabled = true;
    openAt(trigger);
    root.show();
    expect(root.open).toBe(false);
  });

  it("closes on item click and returns focus-safe state", () => {
    const { first, root, trigger } = createContextMenu();
    document.body.append(root);

    openAt(trigger);
    first.click();
    expect(root.open).toBe(false);
  });
});

describe("keyboard navigation", () => {
  it("moves highlight with ArrowDown and activates with Enter", () => {
    const clicked: string[] = [];
    const { first, root, second, trigger } = createContextMenu();
    second.addEventListener("click", () => clicked.push("second"));
    document.body.append(root);

    openAt(trigger);
    const popup = root.querySelector("[slot='popup']")!;
    popup.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "ArrowDown" }));
    expect(document.activeElement).toBe(first);
    popup.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "ArrowDown" }));
    expect(document.activeElement).toBe(second);
    popup.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "Enter" }));
    expect(clicked).toEqual(["second"]);
    expect(root.open).toBe(false);
  });
});

describe("non-modal light-dismiss", () => {
  it("defaults modal to true", () => {
    const { root } = createContextMenu();
    document.body.append(root);
    expect(root.modal).toBe(true);
  });

  it("closes on outside pointerdown and Escape with modal=false", () => {
    const { popup, root, trigger } = createContextMenu();
    root.modal = false;
    document.body.append(root);

    openAt(trigger);
    expect(root.open).toBe(true);
    document.body.dispatchEvent(new Event("pointerdown", { bubbles: true }));
    expect(root.open).toBe(false);

    openAt(trigger);
    expect(root.open).toBe(true);
    popup.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "Escape" }));
    expect(root.open).toBe(false);
  });
});

describe("typeahead", () => {
  it("jumps to the label match", () => {
    const { popup, root, trigger } = createContextMenu();
    document.body.append(root);

    openAt(trigger);
    popup.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "s" }));
    const { second } = { second: popup.querySelectorAll("[data-menu-item]")[1]! };
    expect(document.activeElement).toBe(second);
    expect(second.hasAttribute("data-highlighted")).toBe(true);
  });
});

describe("checkbox items", () => {
  it("toggles without closing and fires checked-change", () => {
    const { popup, root, trigger } = createContextMenu();
    const first = popup.querySelector("[data-menu-item]") as HTMLElement;
    first.dataset.checkboxItem = "";
    const events: Array<unknown> = [];
    root.addEventListener("checked-change", (event) => events.push((event as CustomEvent).detail));
    document.body.append(root);

    openAt(trigger);
    expect(first.getAttribute("role")).toBe("menuitemcheckbox");
    first.click();
    expect(first.hasAttribute("data-checked")).toBe(true);
    expect(root.open).toBe(true);
    expect(events).toEqual([{ checked: true, value: "First" }]);
  });
});

describe("modal scroll-lock and backdrop", () => {
  it("locks document scroll while open and mirrors the backdrop", () => {
    const { popup, root, trigger } = createContextMenu();
    const backdrop = document.createElement("div");
    backdrop.dataset.backdrop = "";
    popup.append(backdrop);
    document.body.append(root);

    openAt(trigger);
    expect(document.documentElement.style.overflow).toBe("hidden");
    expect(backdrop.hidden).toBe(false);
    expect(backdrop.hasAttribute("data-open")).toBe(true);
    root.close();
    expect(document.documentElement.style.overflow).toBe("");
    expect(backdrop.hidden).toBe(true);
  });
});
