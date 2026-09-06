import { afterEach, describe, expect, it, vi } from "vitest";
import { BWC_POPOVER_TAG, type BwcPopoverElement } from "./index";

type PopoverElement = BwcPopoverElement;

function createPopover(options: { defaultOpen?: boolean; open?: boolean } = {}) {
  const root = document.createElement(BWC_POPOVER_TAG) as PopoverElement;
  root.toggleAttribute("default-open", options.defaultOpen ?? false);
  root.toggleAttribute("open", options.open ?? false);

  const trigger = document.createElement("button");
  trigger.slot = "trigger";
  trigger.textContent = "Open";
  const popup = document.createElement("div");
  popup.slot = "popup";
  const close = document.createElement("button");
  close.dataset.close = "";
  close.textContent = "Close";
  popup.append(close);
  root.append(trigger, popup);

  return { close, popup, root, trigger };
}

afterEach(() => document.body.replaceChildren());

describe("native slot structure", () => {
  it("requires one button trigger and one div popup", () => {
    const root = document.createElement(BWC_POPOVER_TAG);
    const trigger = document.createElement("button");
    trigger.slot = "trigger";
    const first = document.createElement("div");
    first.slot = "popup";
    const second = document.createElement("div");
    second.slot = "popup";
    root.append(trigger, first, second);

    expect(() => document.body.append(root)).toThrow(TypeError);
  });

  it("rebinds dynamically replaced slots", async () => {
    const { popup, root, trigger } = createPopover({ defaultOpen: true });
    document.body.append(root);
    const replacement = document.createElement("div");
    replacement.slot = "popup";
    popup.replaceWith(replacement);

    await vi.waitFor(() => expect(replacement.hidden).toBe(false));
    trigger.click();
    expect(root.open).toBe(false);
  });
});

describe("state and native dismissal", () => {
  it("keeps the trigger cursor synchronized with disabled state", () => {
    const { root, trigger } = createPopover();
    document.body.append(root);

    root.disabled = true;
    expect(trigger.disabled).toBe(true);
    expect(trigger.style.cursor).toBe("not-allowed");

    root.disabled = false;
    expect(trigger.disabled).toBe(false);
    expect(trigger.style.cursor).toBe("pointer");
  });

  it("preserves uncontrolled state across reconnects", () => {
    const { close, popup, root, trigger } = createPopover();
    const callback = vi.fn();
    root.onOpenChange = callback;
    document.body.append(root);

    trigger.click();
    root.remove();
    document.body.append(root);
    expect(root.open).toBe(true);
    expect(popup.hidden).toBe(false);
    close.click();
    expect(root.open).toBe(false);
    expect(callback.mock.calls).toEqual([[true], [false]]);
  });

  it("notifies controlled light-dismiss and restores the externally controlled state", async () => {
    const { popup, root, trigger } = createPopover({ open: true });
    const callback = vi.fn();
    root.onOpenChange = callback;
    document.body.append(root);

    popup.hidden = true;
    const toggle = new Event("toggle");
    Object.defineProperty(toggle, "newState", { value: "closed" });
    popup.dispatchEvent(toggle);
    expect(root.open).toBe(true);
    expect(callback).toHaveBeenCalledWith(false);
    await vi.waitFor(() => expect(popup.hidden).toBe(false));

    root.removeAttribute("open");
    await vi.waitFor(() => expect(root.open).toBe(false));
    trigger.click();
    expect(root.open).toBe(false);
  });

  it("synchronizes uncontrolled light-dismiss and reopens", () => {
    const { popup, root, trigger } = createPopover();
    document.body.append(root);

    trigger.click();
    popup.hidden = true;
    const toggle = new Event("toggle");
    Object.defineProperty(toggle, "newState", { value: "closed" });
    popup.dispatchEvent(toggle);
    expect(root.open).toBe(false);
    trigger.click();
    expect(root.open).toBe(true);
  });
});

describe("anchor positioning", () => {
  it.each([["bottom"], ["top"], ["right"], ["left"]] as const)(
    "wires the %s side through data-side and --side-offset without measuring geometry",
    (side) => {
      const { popup, root, trigger } = createPopover({ defaultOpen: true });
      root.side = side;
      root.sideOffset = 5;
      const triggerRect = vi.spyOn(trigger, "getBoundingClientRect").mockReturnValue({
        bottom: 40,
        height: 20,
        left: 10,
        right: 30,
        top: 20,
        width: 20,
        x: 10,
        y: 20,
        toJSON: () => ({}),
      });
      const popupRect = vi.spyOn(popup, "getBoundingClientRect").mockImplementation(() => {
        throw new Error("popup geometry must not be read");
      });
      document.body.append(root);

      expect(popup.dataset.side).toBe(side);
      expect(popup.style.getPropertyValue("--side-offset")).toBe("5px");
      // Placement lives in the imported stylesheet; JS writes no geometry.
      expect(popup.style.transform).toBe("");
      expect(popup.style.position).toBe("");
      for (const edge of ["top", "right", "bottom", "left"] as const) {
        expect(popup.style[edge]).toBe("");
      }
      for (const edge of ["Top", "Right", "Bottom", "Left"] as const) {
        expect(popup.style[`margin${edge}` as const]).toBe("");
      }
      expect(triggerRect).not.toHaveBeenCalled();
      expect(popupRect).not.toHaveBeenCalled();
    },
  );

  it("reflects side and offset changes without geometry reads", async () => {
    const { popup, root, trigger } = createPopover({ defaultOpen: true });
    const rect = vi.spyOn(trigger, "getBoundingClientRect");
    document.body.append(root);
    expect(popup.dataset.side).toBe("bottom");

    root.side = "left";
    root.sideOffset = 12;
    await Promise.resolve();
    expect(popup.dataset.side).toBe("left");
    expect(popup.style.getPropertyValue("--side-offset")).toBe("12px");
    expect(rect).not.toHaveBeenCalled();
  });

  it("stays attached without resize or capture-scroll listeners", () => {
    const { root, trigger } = createPopover({ defaultOpen: true });
    const rect = vi.spyOn(trigger, "getBoundingClientRect").mockReturnValue({
      bottom: 20,
      height: 10,
      left: 10,
      right: 20,
      top: 10,
      width: 10,
      x: 10,
      y: 10,
      toJSON: () => ({}),
    });
    const add = vi.spyOn(window, "addEventListener");
    document.body.append(root);
    expect(add.mock.calls.filter(([type]) => type === "resize" || type === "scroll")).toEqual([]);

    window.dispatchEvent(new Event("resize"));
    document.dispatchEvent(new Event("scroll"));
    expect(rect).not.toHaveBeenCalled();
    root.remove();
    window.dispatchEvent(new Event("resize"));
    document.dispatchEvent(new Event("scroll"));
    expect(rect).not.toHaveBeenCalled();
  });

  it("installs the anchor stylesheet once per document", () => {
    const first = createPopover();
    const second = createPopover();
    document.body.append(first.root, second.root);

    // Vitest stubs `?inline` CSS to an empty string, so this guards the
    // install mechanism only; content ships via the build (see dist output).
    expect(document.getElementById("bwc-popover-style")?.localName).toBe("style");
    expect(document.querySelectorAll("#bwc-popover-style")).toHaveLength(1);
  });
});

describe("parts", () => {
  it("preserves reactive classes and adds stable selectors, ARIA, and cursors", async () => {
    const { close, popup, root, trigger } = createPopover();
    trigger.className = "author-trigger";
    popup.className = "author-popup";
    close.className = "author-close";
    root.triggerClass = "trigger-a";
    root.popupClass = "popup-a";
    root.closeClass = "close-a";
    document.body.append(root);

    expect(trigger.className).toBe("popover-trigger author-trigger trigger-a");
    expect(popup.className).toBe("popover-popup author-popup popup-a");
    expect(close.className).toBe("popover-close author-close close-a");
    expect(trigger.id).not.toBe("");
    expect(trigger.dataset.testid).toBe("bwc-popover-trigger");
    expect(trigger.style.cursor).toBe("pointer");
    expect(trigger.getAttribute("aria-controls")).toBe(popup.id);
    expect(popup.dataset.testid).toBe("bwc-popover-popup");
    expect(popup.getAttribute("popover")).toBe("auto");
    expect(popup.getAttribute("role")).toBe("dialog");
    expect(close.dataset.testid).toBe("bwc-popover-close");

    root.popupClass = "popup-b";
    popup.className = "new-author";
    await Promise.resolve();
    expect(popup.className).toBe("popover-popup new-author popup-b");
  });

  it("ignores data-close buttons owned by a nested popover", () => {
    const outer = createPopover();
    const inner = createPopover();
    outer.popup.append(inner.root);
    document.body.append(outer.root);
    outer.trigger.click();

    inner.close.click();
    expect(outer.root.open).toBe(true);
  });
});
