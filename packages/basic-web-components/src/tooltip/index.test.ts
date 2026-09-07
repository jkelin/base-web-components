import { afterEach, describe, expect, it, vi } from "vitest";
import { type BwcTooltipElement } from "./index";
// Side-effect import: registering `bwc-tooltip` happens on module load.
import "./index";

type TooltipElement = BwcTooltipElement;

function createTooltip(options: { defaultOpen?: boolean; open?: boolean } = {}) {
  const root = document.createElement("bwc-tooltip") as TooltipElement;
  root.toggleAttribute("default-open", options.defaultOpen ?? false);
  root.toggleAttribute("open", options.open ?? false);

  const trigger = document.createElement("button");
  trigger.slot = "trigger";
  trigger.textContent = "Info";
  const popup = document.createElement("div");
  popup.slot = "popup";
  popup.textContent = "Hint";
  root.append(trigger, popup);

  return { popup, root, trigger };
}

afterEach(() => document.body.replaceChildren());

describe("slot structure", () => {
  it("requires one trigger element and one div popup", () => {
    const root = document.createElement("bwc-tooltip");
    const trigger = document.createElement("button");
    trigger.slot = "trigger";
    const first = document.createElement("div");
    first.slot = "popup";
    const second = document.createElement("div");
    second.slot = "popup";
    root.append(trigger, first, second);

    expect(() => document.body.append(root)).toThrow(TypeError);
  });

  it("requires a popup", () => {
    const root = document.createElement("bwc-tooltip");
    const trigger = document.createElement("button");
    trigger.slot = "trigger";
    root.append(trigger);

    expect(() => document.body.append(root)).toThrow(TypeError);
  });

  it("accepts any focusable trigger element", () => {
    const root = document.createElement("bwc-tooltip") as TooltipElement;
    const trigger = document.createElement("span");
    trigger.slot = "trigger";
    trigger.tabIndex = 0;
    const popup = document.createElement("div");
    popup.slot = "popup";
    root.append(trigger, popup);
    document.body.append(root);

    expect(root.open).toBe(false);
    expect(trigger.getAttribute("aria-describedby")).toBe(popup.id);
  });

  it("rebinds dynamically replaced slots", async () => {
    const { popup, root } = createTooltip({ defaultOpen: true });
    document.body.append(root);
    const replacement = document.createElement("div");
    replacement.slot = "popup";
    popup.replaceWith(replacement);

    await vi.waitFor(() => expect(replacement.hidden).toBe(false));
    root.close();
    expect(root.open).toBe(false);
  });
});

describe("state", () => {
  it("keeps the trigger cursor synchronized with disabled state", () => {
    const { root, trigger } = createTooltip();
    document.body.append(root);

    root.disabled = true;
    expect(trigger.getAttribute("aria-disabled")).toBe("true");
    expect(trigger.style.cursor).toBe("not-allowed");

    root.disabled = false;
    expect(trigger.hasAttribute("aria-disabled")).toBe(false);
    expect(trigger.style.cursor).toBe("pointer");
  });

  it("preserves uncontrolled state across reconnects", () => {
    const { popup, root } = createTooltip();
    const callback = vi.fn();
    root.onOpenChange = callback;
    document.body.append(root);

    root.show();
    root.remove();
    document.body.append(root);
    expect(root.open).toBe(true);
    expect(popup.hidden).toBe(false);
    root.close();
    expect(root.open).toBe(false);
    expect(callback.mock.calls).toEqual([[true], [false]]);
  });
  it("applies a property write after an uncontrolled open", () => {
    const { popup, root } = createTooltip();
    const callback = vi.fn();
    root.onOpenChange = callback;
    document.body.append(root);

    root.show();
    root.open = false;

    expect(root.open).toBe(false);
    expect(popup.hidden).toBe(true);
    expect(callback.mock.calls).toEqual([[true], [false]]);
  });

  it("applies imperative writes in controlled mode", () => {
    const { root } = createTooltip({ open: true });
    const callback = vi.fn();
    root.onOpenChange = callback;
    document.body.append(root);
    expect(root.open).toBe(true);

    root.close();
    expect(root.open).toBe(false);
    expect(callback).toHaveBeenCalledWith(false);

    root.show();
    expect(root.open).toBe(true);
  });

  it("blocks programmatic, hover, and focus opens while disabled", () => {
    const { popup, root, trigger } = createTooltip();
    const callback = vi.fn();
    root.onOpenChange = callback;
    root.delay = 0;
    root.disabled = true;
    document.body.append(root);

    root.show();
    root.toggle(true);
    trigger.dispatchEvent(new Event("pointerenter"));
    trigger.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
    expect(root.open).toBe(false);
    expect(popup.hidden).toBe(true);
    expect(callback).not.toHaveBeenCalled();
  });
});

describe("hover and focus", () => {
  it("opens on hover and closes on leave with zero delays", () => {
    const { popup, root, trigger } = createTooltip();
    root.delay = 0;
    root.closeDelay = 0;
    document.body.append(root);

    trigger.dispatchEvent(new Event("pointerenter"));
    expect(root.open).toBe(true);
    expect(popup.hidden).toBe(false);

    trigger.dispatchEvent(new Event("pointerleave"));
    expect(root.open).toBe(false);
    expect(popup.hidden).toBe(true);
  });

  it("keeps the tooltip open while the pointer rests on the popup", () => {
    vi.useFakeTimers();
    try {
      const { popup, root, trigger } = createTooltip();
      root.delay = 0;
      root.closeDelay = 300;
      document.body.append(root);

      trigger.dispatchEvent(new Event("pointerenter"));
      expect(root.open).toBe(true);

      trigger.dispatchEvent(new Event("pointerleave"));
      popup.dispatchEvent(new Event("pointerenter"));
      vi.advanceTimersByTime(500);
      expect(root.open).toBe(true);

      popup.dispatchEvent(new Event("pointerleave"));
      expect(root.open).toBe(true);
      vi.advanceTimersByTime(500);
      expect(root.open).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  it("closes on trigger leave when hoverable is false", () => {
    const { popup, root, trigger } = createTooltip();
    root.delay = 0;
    root.closeDelay = 0;
    root.hoverable = false;
    document.body.append(root);

    trigger.dispatchEvent(new Event("pointerenter"));
    expect(root.open).toBe(true);
    popup.dispatchEvent(new Event("pointerenter"));
    trigger.dispatchEvent(new Event("pointerleave"));
    expect(root.open).toBe(false);
  });

  it("opens on focus and closes on blur outside", () => {
    const { popup, root, trigger } = createTooltip();
    document.body.append(root);

    trigger.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
    expect(root.open).toBe(true);

    popup.dispatchEvent(
      new FocusEvent("focusout", { bubbles: true, relatedTarget: document.body }),
    );
    expect(root.open).toBe(false);
  });

  it("stays open when focus moves into the popup", () => {
    const { popup, root, trigger } = createTooltip();
    document.body.append(root);

    trigger.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
    trigger.dispatchEvent(new FocusEvent("focusout", { bubbles: true, relatedTarget: popup }));
    expect(root.open).toBe(true);
  });

  it("closes an open tooltip on Escape and outside pointerdown", () => {
    const { root, trigger } = createTooltip({ defaultOpen: true });
    document.body.append(root);
    expect(root.open).toBe(true);

    document.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "Escape" }));
    expect(root.open).toBe(false);

    root.show();
    document.body.dispatchEvent(new Event("pointerdown", { bubbles: true }));
    expect(root.open).toBe(false);
    expect(trigger.hasAttribute("data-open")).toBe(false);
  });

  it("closes on trigger click unless close-on-click is false", () => {
    const closable = createTooltip({ defaultOpen: true });
    document.body.append(closable.root);
    closable.trigger.click();
    expect(closable.root.open).toBe(false);
    document.body.replaceChildren();

    const sticky = createTooltip({ defaultOpen: true });
    sticky.root.closeOnClick = false;
    document.body.append(sticky.root);
    sticky.trigger.click();
    expect(sticky.root.open).toBe(true);
  });
});

describe("floating positioning", () => {
  const rect = (part: Partial<DOMRect>): DOMRect =>
    ({
      bottom: 0,
      height: 0,
      left: 0,
      right: 0,
      top: 0,
      width: 0,
      x: 0,
      y: 0,
      toJSON: () => ({}),
      ...part,
    }) as DOMRect;

  function mockGeometry(trigger: HTMLElement, popup: HTMLElement) {
    vi.spyOn(trigger, "getBoundingClientRect").mockReturnValue(
      rect({ bottom: 320, height: 20, left: 300, right: 320, top: 300, width: 20, x: 300, y: 300 }),
    );
    vi.spyOn(popup, "getBoundingClientRect").mockReturnValue(
      rect({ height: 60, width: 120, x: 0, y: 0 }),
    );
  }

  function callCount(spied: unknown): number {
    if (typeof spied === "function" && "mock" in spied) {
      const mock = spied.mock;
      if (mock !== null && typeof mock === "object" && "calls" in mock) {
        const calls = mock.calls;
        if (Array.isArray(calls)) return calls.length;
      }
    }
    return 0;
  }

  it("opens on top by default with inline geometry", () => {
    const { popup, root, trigger } = createTooltip({ defaultOpen: true });
    mockGeometry(trigger, popup);
    document.body.append(root);

    // Trigger 300,300 20x20; popup 120x60; no gap.
    expect(popup.dataset.side).toBe("top");
    expect(popup.dataset.align).toBe("center");
    expect(popup.style.position).toBe("fixed");
    expect(popup.style.left).toBe("250px");
    expect(popup.style.top).toBe("240px");
  });

  it("honors side, align, and align-offset attributes", () => {
    const { popup, root, trigger } = createTooltip({ defaultOpen: true });
    root.side = "bottom";
    root.align = "start";
    root.alignOffset = 4;
    mockGeometry(trigger, popup);
    document.body.append(root);

    expect(popup.dataset.side).toBe("bottom");
    expect(popup.dataset.align).toBe("start");
    expect(popup.style.left).toBe("304px");
    expect(popup.style.top).toBe("320px");
  });

  it("positions an arrow child on the cross axis", () => {
    const { popup, root, trigger } = createTooltip({ defaultOpen: true });
    const arrow = document.createElement("div");
    arrow.dataset.arrow = "";
    popup.append(arrow);
    mockGeometry(trigger, popup);
    document.body.append(root);

    expect(arrow.hasAttribute("data-floating-arrow")).toBe(true);
    expect(arrow.style.left).not.toBe("");
    expect(arrow.dataset.side).toBe("top");
  });

  it("repositions on resize/scroll while open and detaches on close", () => {
    const { popup, root, trigger } = createTooltip({ defaultOpen: true });
    mockGeometry(trigger, popup);
    document.body.append(root);
    const calls = callCount(trigger.getBoundingClientRect);

    window.dispatchEvent(new Event("resize"));
    expect(callCount(trigger.getBoundingClientRect)).toBeGreaterThan(calls);

    root.close();
    const afterClose = callCount(trigger.getBoundingClientRect);
    window.dispatchEvent(new Event("resize"));
    document.dispatchEvent(new Event("scroll"));
    expect(callCount(trigger.getBoundingClientRect)).toBe(afterClose);
    expect(popup.style.position).toBe("fixed");
  });

  it("installs the popup stylesheet once per document", () => {
    const first = createTooltip();
    const second = createTooltip();
    document.body.append(first.root, second.root);

    // Vitest stubs `?inline` CSS to an empty string, so this guards the
    // install mechanism only; content ships via the build (see dist output).
    expect(document.getElementById("bwc-tooltip-style")?.localName).toBe("style");
    expect(document.querySelectorAll("#bwc-tooltip-style")).toHaveLength(1);
  });
});

describe("imperative open/close", () => {
  it("opens, closes, and toggles through methods with events", () => {
    const { popup, root, trigger } = createTooltip();
    const callback = vi.fn();
    const events: Array<unknown> = [];
    root.onOpenChange = callback;
    root.addEventListener("open-change", (event) => events.push((event as CustomEvent).detail));
    document.body.append(root);

    expect(typeof root.open).toBe("boolean");
    expect(typeof root.show).toBe("function");
    expect(typeof root.close).toBe("function");
    expect(typeof root.toggle).toBe("function");

    root.show();
    expect(root.open).toBe(true);
    expect(popup.hidden).toBe(false);
    expect(popup.style.top).not.toBe("");
    expect(popup.hasAttribute("data-floating")).toBe(true);
    expect(popup.style.position).toBe("fixed");
    expect(popup.dataset.side).toBeDefined();

    root.toggle();
    expect(root.open).toBe(false);
    root.toggle(true);
    expect(root.open).toBe(true);
    root.close();
    expect(root.open).toBe(false);
    expect(popup.hidden).toBe(true);

    expect(callback.mock.calls).toEqual([[true], [false], [true], [false]]);
    expect(events).toEqual([{ open: true }, { open: false }, { open: true }, { open: false }]);
    expect(trigger.hasAttribute("data-open")).toBe(false);
    expect(trigger.getAttribute("data-closed")).toBe("");
  });

  it("keeps the website-style external toggle closed for the full interaction", () => {
    vi.useFakeTimers();
    try {
      const { root, trigger } = createTooltip();
      const toggle = document.createElement("button");
      toggle.id = "tooltip-toggle";
      toggle.dataset.testid = "tooltip-toggle";
      toggle.addEventListener("click", () => root.toggle());
      root.delay = 300;
      root.closeDelay = 150;
      root.closeOnClick = false;
      document.body.append(root, toggle);

      trigger.dispatchEvent(new PointerEvent("pointerenter"));
      vi.advanceTimersByTime(300);
      expect(root.open).toBe(true);

      trigger.dispatchEvent(new PointerEvent("pointerleave"));
      toggle.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
      toggle.click();
      expect(root.open).toBe(false);

      vi.advanceTimersByTime(1000);
      expect(root.open).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  it("requires a new hover after an imperative close cancels a pending open", () => {
    vi.useFakeTimers();
    try {
      const { root, trigger } = createTooltip();
      root.delay = 300;
      document.body.append(root);

      trigger.dispatchEvent(new PointerEvent("pointerenter"));
      root.close();
      vi.advanceTimersByTime(300);
      expect(root.open).toBe(false);

      trigger.dispatchEvent(new PointerEvent("pointerleave"));
      trigger.dispatchEvent(new PointerEvent("pointerenter"));
      vi.advanceTimersByTime(300);
      expect(root.open).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it("reflects the open property to the open attribute", async () => {
    const { root } = createTooltip();
    document.body.append(root);

    root.open = true;
    await vi.waitFor(() => expect(root.getAttribute("open")).toBe(""));
    expect(root.open).toBe(true);

    root.open = false;
    await vi.waitFor(() => expect(root.hasAttribute("open")).toBe(false));
  });

  it("anchors programmatic opens to the trigger by default", () => {
    const { popup, root, trigger } = createTooltip();
    vi.spyOn(trigger, "getBoundingClientRect").mockReturnValue({
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
    expect(root.open).toBe(true);
    // Default side top has no room above the 20..40 trigger, so the panel
    // flips below it.
    expect(popup.dataset.side).toBe("bottom");
    expect(popup.style.top).toBe("40px");
  });

  it("honors an anchor selector override", () => {
    const { popup, root, trigger } = createTooltip();
    const alt = document.createElement("button");
    alt.id = "alt-anchor";
    document.body.append(alt);
    vi.spyOn(trigger, "getBoundingClientRect").mockReturnValue({
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
    vi.spyOn(alt, "getBoundingClientRect").mockReturnValue({
      bottom: 220,
      height: 20,
      left: 200,
      right: 220,
      top: 200,
      width: 20,
      x: 200,
      y: 200,
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
    root.anchor = "#alt-anchor";
    document.body.append(root);

    root.show();
    expect(root.anchor).toBe("#alt-anchor");
    // Default side top above the 200..220 anchor.
    expect(popup.style.top).toBe("140px");
  });
});

describe("parts", () => {
  it("preserves reactive classes and adds stable selectors, ARIA, and cursors", async () => {
    const { popup, root, trigger } = createTooltip();
    trigger.className = "author-trigger";
    popup.className = "author-popup";
    root.triggerClass = "trigger-a";
    root.popupClass = "popup-a";
    document.body.append(root);

    expect(trigger.className).toBe("tooltip-trigger author-trigger trigger-a");
    expect(popup.className).toBe("tooltip-popup author-popup popup-a");
    expect(trigger.id).not.toBe("");
    expect(trigger.dataset.testid).toBe("bwc-tooltip-trigger");
    expect(trigger.style.cursor).toBe("pointer");
    expect(trigger.getAttribute("aria-describedby")).toBe(popup.id);
    expect(popup.dataset.testid).toBe("bwc-tooltip-popup");
    expect(popup.getAttribute("role")).toBe("tooltip");

    root.popupClass = "popup-b";
    popup.className = "new-author";
    await Promise.resolve();
    expect(popup.className).toBe("tooltip-popup new-author popup-b");
  });
});

describe("cursor tracking", () => {
  const rect = (part: Partial<DOMRect>): DOMRect =>
    ({
      bottom: 0,
      height: 0,
      left: 0,
      right: 0,
      top: 0,
      width: 0,
      x: 0,
      y: 0,
      toJSON: () => ({}),
      ...part,
    }) as DOMRect;

  function mockCursorGeometry(trigger: HTMLElement, popup: HTMLElement) {
    const triggerRect = rect({
      bottom: 320,
      height: 20,
      left: 300,
      right: 320,
      top: 300,
      width: 20,
      x: 300,
      y: 300,
    });
    const popupRect = rect({ height: 60, width: 120 });
    // The cursor anchor is an internal zero-size element positioned through
    // inline style, so resolve its rect from `left`/`top` like a browser would.
    return vi
      .spyOn(Element.prototype, "getBoundingClientRect")
      .mockImplementation(function (this: Element) {
        if (this === trigger) return triggerRect;
        if (this === popup) return popupRect;
        const x = Number.parseFloat((this as HTMLElement).style.left) || 0;
        const y = Number.parseFloat((this as HTMLElement).style.top) || 0;
        return rect({ height: 0, left: x, top: y, width: 0, x, y });
      });
  }

  function hover(trigger: HTMLElement) {
    trigger.dispatchEvent(new Event("pointerenter"));
  }

  function move(x: number, y: number) {
    document.dispatchEvent(
      new MouseEvent("pointermove", { bubbles: true, clientX: x, clientY: y }),
    );
  }

  it("anchors to the cursor on both axes", () => {
    const { popup, root, trigger } = createTooltip();
    root.delay = 0;
    root.closeDelay = 0;
    root.trackCursor = "both";
    const geometry = mockCursorGeometry(trigger, popup);
    try {
      document.body.append(root);
      hover(trigger);
      expect(root.open).toBe(true);

      move(150, 160);
      // Point anchor 150,160; popup 120x60 on top: 150-60=90, 160-60=100.
      expect(popup.style.left).toBe("90px");
      expect(popup.style.top).toBe("100px");
    } finally {
      geometry.mockRestore();
    }
  });

  it("tracks one axis against the trigger center", () => {
    const { popup, root, trigger } = createTooltip();
    root.delay = 0;
    root.closeDelay = 0;
    root.trackCursor = "x";
    const geometry = mockCursorGeometry(trigger, popup);
    try {
      document.body.append(root);
      hover(trigger);

      move(150, 160);
      // x follows the cursor; y stays at the trigger center (310) minus height.
      expect(popup.style.left).toBe("90px");
      expect(popup.style.top).toBe("250px");
    } finally {
      geometry.mockRestore();
    }
  });

  it("rejects an unknown track-cursor mode", () => {
    const { root } = createTooltip();
    expect(() => {
      root.trackCursor = "diagonal" as never;
    }).toThrow(TypeError);
  });
});

describe("hover group", () => {
  it("opens instantly within the group timeout after another tooltip closed", () => {
    const first = createTooltip();
    first.root.delay = 0;
    first.root.closeDelay = 0;
    document.body.append(first.root);
    first.trigger.dispatchEvent(new Event("pointerenter"));
    expect(first.root.open).toBe(true);
    first.trigger.dispatchEvent(new Event("pointerleave"));
    expect(first.root.open).toBe(false);
    document.body.replaceChildren();

    const second = createTooltip();
    second.root.delay = 5000;
    second.root.timeout = 60000;
    document.body.append(second.root);
    second.trigger.dispatchEvent(new Event("pointerenter"));
    expect(second.root.open).toBe(true);
  });

  it("respects delay when the group window is closed", () => {
    vi.useFakeTimers();
    try {
      const { root, trigger } = createTooltip();
      root.delay = 5000;
      root.timeout = 0;
      document.body.append(root);

      trigger.dispatchEvent(new Event("pointerenter"));
      expect(root.open).toBe(false);
      vi.advanceTimersByTime(5000);
      expect(root.open).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it("respects delay after the group timeout expires", () => {
    vi.useFakeTimers();
    try {
      const first = createTooltip();
      first.root.delay = 0;
      first.root.closeDelay = 0;
      document.body.append(first.root);
      first.trigger.dispatchEvent(new Event("pointerenter"));
      first.trigger.dispatchEvent(new Event("pointerleave"));
      expect(first.root.open).toBe(false);
      document.body.replaceChildren();

      vi.advanceTimersByTime(500);
      const second = createTooltip();
      second.root.delay = 5000;
      second.root.timeout = 400;
      document.body.append(second.root);
      second.trigger.dispatchEvent(new Event("pointerenter"));
      expect(second.root.open).toBe(false);
      vi.advanceTimersByTime(5000);
      expect(second.root.open).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("collision and arrow padding", () => {
  const rect = (part: Partial<DOMRect>): DOMRect =>
    ({
      bottom: 0,
      height: 0,
      left: 0,
      right: 0,
      top: 0,
      width: 0,
      x: 0,
      y: 0,
      toJSON: () => ({}),
      ...part,
    }) as DOMRect;

  function mockGeometry(trigger: HTMLElement, popup: HTMLElement) {
    vi.spyOn(trigger, "getBoundingClientRect").mockReturnValue(
      rect({ bottom: 320, height: 20, left: 300, right: 320, top: 300, width: 20, x: 300, y: 300 }),
    );
    vi.spyOn(popup, "getBoundingClientRect").mockReturnValue(
      rect({ height: 60, width: 120, x: 0, y: 0 }),
    );
  }

  it("shifts the popup inside the collision padding", () => {
    const { popup, root, trigger } = createTooltip({ defaultOpen: true });
    root.side = "bottom";
    root.align = "start";
    root.collisionPadding = 400;
    mockGeometry(trigger, popup);
    document.body.append(root);

    // Base x would be 300; padding clamps it to 400.
    expect(popup.style.left).toBe("400px");
  });

  it("keeps the arrow away from the popup edges", () => {
    const { popup, root, trigger } = createTooltip({ defaultOpen: true });
    const arrow = document.createElement("div");
    arrow.dataset.arrow = "";
    popup.append(arrow);
    root.side = "bottom";
    root.align = "start";
    root.arrowPadding = 20;
    mockGeometry(trigger, popup);
    vi.spyOn(arrow, "getBoundingClientRect").mockReturnValue(rect({ height: 8, width: 8 }));
    document.body.append(root);

    // Anchor center 310 against popup x 300 leaves 6px; padding lifts it to 20.
    expect(arrow.style.left).toBe("20px");
  });

  it("rejects non-finite padding", () => {
    const { root } = createTooltip();
    expect(() => {
      root.collisionPadding = Number.NaN;
    }).toThrow(TypeError);
  });
});

describe("anchor tracking", () => {
  it("stops repositioning when disable-anchor-tracking is set", () => {
    const tracked = createTooltip({ defaultOpen: true });
    const trackedMeasure = vi.spyOn(tracked.trigger, "getBoundingClientRect");
    document.body.append(tracked.root);
    const calls = trackedMeasure.mock.calls.length;
    window.dispatchEvent(new Event("resize"));
    expect(trackedMeasure.mock.calls.length).toBeGreaterThan(calls);
    document.body.replaceChildren();

    const frozen = createTooltip({ defaultOpen: true });
    frozen.root.disableAnchorTracking = true;
    const frozenMeasure = vi.spyOn(frozen.trigger, "getBoundingClientRect");
    document.body.append(frozen.root);
    const settled = frozenMeasure.mock.calls.length;
    window.dispatchEvent(new Event("resize"));
    document.dispatchEvent(new Event("scroll"));
    expect(frozenMeasure.mock.calls.length).toBe(settled);
  });
});

describe("animation hooks and title", () => {
  it("marks the opening frames with data-starting-style", async () => {
    const { popup, root } = createTooltip({ defaultOpen: true });
    document.body.append(root);

    expect(popup.hasAttribute("data-starting-style")).toBe(true);
    await vi.waitFor(() => expect(popup.hasAttribute("data-starting-style")).toBe(false));
  });

  it("hides synchronously without a transition and delays hide with one", async () => {
    const plain = createTooltip();
    plain.root.delay = 0;
    plain.root.closeDelay = 0;
    document.body.append(plain.root);
    plain.trigger.dispatchEvent(new Event("pointerenter"));
    expect(plain.root.open).toBe(true);
    plain.trigger.dispatchEvent(new Event("pointerleave"));
    expect(plain.root.open).toBe(false);
    expect(plain.popup.hidden).toBe(true);
    expect(plain.popup.hasAttribute("data-ending-style")).toBe(false);
    document.body.replaceChildren();

    const animated = createTooltip();
    animated.root.delay = 0;
    animated.root.closeDelay = 0;
    animated.popup.style.transitionDuration = "0.1s";
    document.body.append(animated.root);
    animated.trigger.dispatchEvent(new Event("pointerenter"));
    animated.trigger.dispatchEvent(new Event("pointerleave"));
    expect(animated.popup.hasAttribute("data-ending-style")).toBe(true);
    expect(animated.popup.hidden).toBe(false);
    await vi.waitFor(() => expect(animated.popup.hidden).toBe(true));
    expect(animated.popup.hasAttribute("data-ending-style")).toBe(false);
  });

  it("exposes the anchor point as --transform-origin", () => {
    const { popup, root } = createTooltip({ defaultOpen: true });
    document.body.append(root);

    // No arrow: align center on top resolves to the top-center edge.
    expect(popup.style.getPropertyValue("--transform-origin")).toBe("50% 100%");
  });

  it("suppresses the native title while open and restores it on close", () => {
    const { popup, root, trigger } = createTooltip();
    trigger.title = "Native hint";
    root.delay = 0;
    root.closeDelay = 0;
    document.body.append(root);

    trigger.dispatchEvent(new Event("pointerenter"));
    expect(root.open).toBe(true);
    expect(trigger.hasAttribute("title")).toBe(false);

    trigger.dispatchEvent(new Event("pointerleave"));
    expect(popup.hidden).toBe(true);
    expect(trigger.title).toBe("Native hint");
  });
});
