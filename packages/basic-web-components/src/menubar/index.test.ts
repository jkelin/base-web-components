import { afterEach, describe, expect, it, vi } from "vitest";
import { type BwcMenubarElement } from "./index";
import { type BwcMenuElement } from "../menu";
// Side-effect imports: registering `bwc-menubar` and `bwc-menu` happens on
// module load. The bar coordinates child menus through their public API only.
import "./index";
import "../menu";

type BarElement = BwcMenubarElement;
type MenuElement = BwcMenuElement;

function createMenu(label: string, id: string) {
  const menu = document.createElement("bwc-menu") as MenuElement;
  menu.id = id;
  const trigger = document.createElement("button");
  trigger.slot = "trigger";
  trigger.textContent = label;
  const popup = document.createElement("div");
  popup.slot = "popup";
  const first = document.createElement("button");
  first.dataset.menuItem = "";
  first.textContent = `${label} One`;
  const second = document.createElement("button");
  second.dataset.menuItem = "";
  second.textContent = `${label} Two`;
  popup.append(first, second);
  menu.append(trigger, popup);
  return { first, menu, popup, second, trigger };
}

function createBar() {
  const root = document.createElement("bwc-menubar") as BarElement;
  const file = createMenu("File", "menu-file");
  const edit = createMenu("Edit", "menu-edit");
  const view = createMenu("View", "menu-view");
  root.append(file.menu, edit.menu, view.menu);
  return { edit, file, root, view };
}

afterEach(() => document.body.replaceChildren());

describe("topology", () => {
  it("requires at least one bwc-menu child", () => {
    const root = document.createElement("bwc-menubar");
    expect(() => document.body.append(root)).toThrow(TypeError);
  });

  it("exposes the menubar and child popup chrome hooks", () => {
    const { file, root } = createBar();
    document.body.append(root);
    expect(root.getAttribute("role")).toBe("menubar");
    expect(root.dataset.testid).toBe("bwc-menubar");
    expect(file.popup.classList).toContain("menu-popup");
    expect(file.popup.hasAttribute("data-floating")).toBe(true);
  });
});

describe("keyboard navigation", () => {
  it("roves across triggers with ArrowLeft/ArrowRight and loops", () => {
    const { edit, file, root, view } = createBar();
    document.body.append(root);

    file.trigger.focus();
    file.trigger.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "ArrowRight" }));
    expect(document.activeElement).toBe(edit.trigger);
    edit.trigger.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "ArrowRight" }));
    expect(document.activeElement).toBe(view.trigger);
    view.trigger.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "ArrowRight" }));
    expect(document.activeElement).toBe(file.trigger);
    file.trigger.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "ArrowLeft" }));
    expect(document.activeElement).toBe(view.trigger);
  });

  it("supports Home/End", () => {
    const { edit, root, view } = createBar();
    document.body.append(root);

    edit.trigger.focus();
    edit.trigger.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "End" }));
    expect(document.activeElement).toBe(view.trigger);
    view.trigger.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "Home" }));
    expect(document.activeElement).toBe(root.querySelector("#menu-file [slot='trigger']"));
  });

  it("opens with Enter and keeps a single menu open", () => {
    const { edit, file, root } = createBar();
    document.body.append(root);

    file.trigger.focus();
    file.trigger.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "Enter" }));
    expect(file.menu.open).toBe(true);
    expect(root.hasAttribute("data-open")).toBe(true);

    edit.trigger.focus();
    edit.trigger.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "Enter" }));
    expect(edit.menu.open).toBe(true);
    expect(file.menu.open).toBe(false);
  });

  it("closes on Escape and returns focus to the trigger", () => {
    const { file, root } = createBar();
    document.body.append(root);

    file.trigger.click();
    expect(file.menu.open).toBe(true);
    file.popup.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "Escape" }));
    expect(file.menu.open).toBe(false);
    expect(document.activeElement).toBe(file.trigger);
    expect(root.hasAttribute("data-closed")).toBe(true);
  });

  it("switches menus with arrows from inside an open popup", () => {
    const { edit, file, root } = createBar();
    document.body.append(root);

    file.trigger.click();
    expect(file.menu.open).toBe(true);
    file.popup.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "ArrowRight" }));
    expect(file.menu.open).toBe(false);
    expect(edit.menu.open).toBe(true);
    expect(document.activeElement).toBe(edit.trigger);
  });

  it("typeaheads to the next matching trigger", () => {
    const { file, root, view } = createBar();
    document.body.append(root);

    file.trigger.focus();
    file.trigger.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "v" }));
    expect(document.activeElement).toBe(view.trigger);
  });
});

describe("hover switching", () => {
  it("switches to a hovered trigger after the delay once a menu is open", () => {
    vi.useFakeTimers();
    try {
      const { edit, file, root } = createBar();
      root.setAttribute("delay", "50");
      document.body.append(root);

      file.trigger.click();
      expect(file.menu.open).toBe(true);
      edit.trigger.dispatchEvent(new PointerEvent("pointerover", { bubbles: true }));
      expect(edit.menu.open).toBe(false);
      vi.advanceTimersByTime(50);
      expect(edit.menu.open).toBe(true);
      expect(file.menu.open).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  it("does nothing on hover while every menu is closed", () => {
    vi.useFakeTimers();
    try {
      const { edit, root } = createBar();
      root.setAttribute("delay", "10");
      document.body.append(root);

      edit.trigger.dispatchEvent(new PointerEvent("pointerover", { bubbles: true }));
      vi.advanceTimersByTime(100);
      expect(edit.menu.open).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("coordinator methods", () => {
  it("opens menus by index or id and closes the rest", () => {
    const { edit, file, root, view } = createBar();
    document.body.append(root);

    root.openMenu(1);
    expect(edit.menu.open).toBe(true);
    expect(file.menu.open).toBe(false);

    root.openMenu("menu-view");
    expect(view.menu.open).toBe(true);
    expect(edit.menu.open).toBe(false);

    root.closeAll();
    expect(view.menu.open).toBe(false);
    expect(root.hasAttribute("data-closed")).toBe(true);
  });

  it("focuses the trigger on openMenu with focus:true", () => {
    const { edit, root } = createBar();
    document.body.append(root);

    root.openMenu(1, { focus: true });
    expect(edit.menu.open).toBe(true);
    expect(document.activeElement).toBe(edit.trigger);
  });

  it("rejects unknown targets", () => {
    const { root } = createBar();
    document.body.append(root);

    expect(() => root.openMenu(9)).toThrow(RangeError);
    expect(() => root.openMenu("menu-missing")).toThrow(RangeError);
    expect(() => root.openMenu(true as unknown as number)).toThrow(TypeError);
  });

  it("blocks openMenu while disabled but still closes", () => {
    const { file, root } = createBar();
    document.body.append(root);

    file.trigger.click();
    expect(file.menu.open).toBe(true);
    root.disabled = true;
    root.openMenu(1);
    expect(file.menu.open).toBe(true);
    root.closeAll();
    expect(file.menu.open).toBe(false);
    expect(root.hasAttribute("data-disabled")).toBe(true);
  });
});
