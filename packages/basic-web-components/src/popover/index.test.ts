import { afterEach, describe, expect, it, vi } from "vitest";
import { type BwcPopoverElement } from "./index";
// Side-effect import: registering `bwc-popover` happens on module load.
import "./index";

type PopoverElement = BwcPopoverElement;

function createPopover(options: { defaultOpen?: boolean; open?: boolean } = {}) {
  const root = document.createElement("bwc-popover") as PopoverElement;
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
    const root = document.createElement("bwc-popover");
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
  it("applies property writes after uncontrolled trigger transitions", () => {
    const { popup, root, trigger } = createPopover();
    const callback = vi.fn();
    root.onOpenChange = callback;
    document.body.append(root);

    trigger.click();
    root.open = false;

    expect(root.open).toBe(false);
    expect(popup.hidden).toBe(true);
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

  it.each([["bottom"], ["top"], ["right"], ["left"]] as const)(
    "positions the popup with inline geometry on the %s side",
    (side) => {
      const { popup, root, trigger } = createPopover({ defaultOpen: true });
      root.side = side;
      root.sideOffset = 5;
      mockGeometry(trigger, popup);
      document.body.append(root);

      expect(popup.dataset.side).toBe(side);
      expect(popup.style.position).toBe("fixed");
      expect(popup.style.left).not.toBe("");
      expect(popup.style.top).not.toBe("");
      // Trigger 300,300 20x20; popup 120x60; gap 5.
      const expected = {
        bottom: ["250px", "325px"],
        top: ["250px", "235px"],
        right: ["325px", "280px"],
        left: ["175px", "280px"],
      }[side];
      expect(popup.style.left).toBe(expected[0]);
      expect(popup.style.top).toBe(expected[1]);
    },
  );

  it("flips to the side with room and shifts inside the viewport", () => {
    const { popup, root, trigger } = createPopover({ defaultOpen: true });
    vi.spyOn(trigger, "getBoundingClientRect").mockReturnValue(
      rect({ bottom: 760, height: 20, left: 750, right: 770, top: 740, width: 20, x: 750, y: 740 }),
    );
    vi.spyOn(popup, "getBoundingClientRect").mockReturnValue(
      rect({ height: 60, width: 120, x: 0, y: 0 }),
    );
    document.body.append(root);

    expect(popup.dataset.side).toBe("top");
    expect(Number.parseFloat(popup.style.left) + 120).toBeLessThanOrEqual(window.innerWidth);
  });

  it("aligns start/end with an align offset", () => {
    const { popup, root, trigger } = createPopover({ defaultOpen: true });
    root.align = "start";
    root.alignOffset = 4;
    mockGeometry(trigger, popup);
    document.body.append(root);

    expect(popup.dataset.align).toBe("start");
    expect(popup.style.left).toBe("304px");
  });

  it("positions an arrow child on the cross axis", () => {
    const { popup, root, trigger } = createPopover({ defaultOpen: true });
    const arrow = document.createElement("div");
    arrow.dataset.arrow = "";
    popup.append(arrow);
    mockGeometry(trigger, popup);
    document.body.append(root);

    expect(arrow.hasAttribute("data-floating-arrow")).toBe(true);
    expect(arrow.style.left).not.toBe("");
    expect(arrow.dataset.side).toBe("bottom");
  });

  it("repositions on resize/scroll while open and detaches on close", () => {
    const { popup, root, trigger } = createPopover({ defaultOpen: true });
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
    const first = createPopover();
    const second = createPopover();
    document.body.append(first.root, second.root);

    // Vitest stubs `?inline` CSS to an empty string, so this guards the
    // install mechanism only; content ships via the build (see dist output).
    expect(document.getElementById("bwc-popover-style")?.localName).toBe("style");
    expect(document.querySelectorAll("#bwc-popover-style")).toHaveLength(1);
  });
});

describe("imperative open/close", () => {
  it("opens, closes, and toggles through methods with events", () => {
    const { popup, root, trigger } = createPopover();
    const callback = vi.fn();
    const events: Array<unknown> = [];
    root.onOpenChange = callback;
    root.addEventListener("open-change", (event) => events.push((event as CustomEvent).detail));
    document.body.append(root);

    expect(typeof root.show).toBe("function");
    expect(typeof root.close).toBe("function");
    expect(typeof root.toggle).toBe("function");

    root.show();
    expect(root.open).toBe(true);
    expect(popup.hidden).toBe(false);
    expect(popup.style.top).not.toBe("");

    root.toggle();
    expect(root.open).toBe(false);
    root.toggle(true);
    expect(root.open).toBe(true);
    root.close();
    expect(root.open).toBe(false);

    expect(callback.mock.calls).toEqual([[true], [false], [true], [false]]);
    expect(events).toEqual([{ open: true }, { open: false }, { open: true }, { open: false }]);
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
  });

  it("reflects the open property to the open attribute", async () => {
    const { root } = createPopover();
    document.body.append(root);

    root.open = true;
    await vi.waitFor(() => expect(root.getAttribute("open")).toBe(""));
    expect(root.open).toBe(true);

    root.open = false;
    await vi.waitFor(() => expect(root.hasAttribute("open")).toBe(false));
  });

  it("anchors programmatic opens to the trigger by default", () => {
    const { popup, root, trigger } = createPopover();
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
    expect(popup.style.top).toBe("40px");
  });

  it("honors an anchor selector override", () => {
    const { popup, root, trigger } = createPopover();
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
    expect(popup.style.top).toBe("220px");
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

describe("open on hover", () => {
  it("stays click-only by default", () => {
    const { root, trigger } = createPopover();
    document.body.append(root);

    trigger.dispatchEvent(new Event("pointerenter"));
    expect(root.open).toBe(false);
  });

  it("opens and closes on hover with zero delays", () => {
    const { popup, root, trigger } = createPopover();
    root.openOnHover = true;
    root.delay = 0;
    root.closeDelay = 0;
    document.body.append(root);

    trigger.dispatchEvent(new Event("pointerenter"));
    expect(root.open).toBe(true);
    expect(popup.hidden).toBe(false);

    trigger.dispatchEvent(new Event("pointerleave"));
    expect(root.open).toBe(false);
  });

  it("honors hover delays", () => {
    vi.useFakeTimers();
    try {
      const { root, trigger } = createPopover();
      root.openOnHover = true;
      root.delay = 500;
      root.closeDelay = 300;
      document.body.append(root);

      trigger.dispatchEvent(new Event("pointerenter"));
      expect(root.open).toBe(false);
      vi.advanceTimersByTime(500);
      expect(root.open).toBe(true);

      trigger.dispatchEvent(new Event("pointerleave"));
      expect(root.open).toBe(true);
      vi.advanceTimersByTime(300);
      expect(root.open).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  it("keeps the popover open while the pointer rests on it", () => {
    vi.useFakeTimers();
    try {
      const { popup, root, trigger } = createPopover();
      root.openOnHover = true;
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
      vi.advanceTimersByTime(500);
      expect(root.open).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("modal", () => {
  it("renders no backdrop outside modal mode", () => {
    const { root } = createPopover();
    document.body.append(root);

    root.show();
    expect(document.body.querySelector('[data-testid="bwc-popover-backdrop"]')).toBeNull();
    root.close();
  });

  it("renders a backdrop and locks scroll while open", () => {
    const { root } = createPopover();
    root.modal = true;
    document.body.append(root);

    root.show();
    const backdrop = document.body.querySelector('[data-testid="bwc-popover-backdrop"]');
    expect(backdrop?.localName).toBe("div");
    expect(backdrop?.hasAttribute("data-backdrop")).toBe(true);
    expect(document.documentElement.style.overflow).toBe("hidden");

    root.close();
    expect(document.body.querySelector('[data-testid="bwc-popover-backdrop"]')).toBeNull();
    expect(document.documentElement.style.overflow).toBe("");
  });

  it("forwards a backdrop class", () => {
    const { root } = createPopover();
    root.modal = true;
    root.backdropClass = "scrim";
    document.body.append(root);

    root.show();
    expect(document.body.querySelector('[data-testid="bwc-popover-backdrop"]')?.className).toBe(
      "popover-backdrop scrim",
    );
    root.close();
  });
});

describe("title and description", () => {
  function createTitledPopover() {
    const { close, popup, root, trigger } = createPopover();
    const title = document.createElement("h2");
    title.dataset.title = "";
    title.textContent = "Options";
    const description = document.createElement("p");
    description.dataset.description = "";
    description.textContent = "Pick one.";
    popup.prepend(title, description);
    return { close, description, popup, root, title, trigger };
  }

  it("wires aria-labelledby/describedby to slotted title and description", () => {
    const { description, popup, root, title } = createTitledPopover();
    root.titleClass = "title-a";
    root.descriptionClass = "description-a";
    document.body.append(root);

    expect(title.id).not.toBe("");
    expect(title.dataset.testid).toBe("bwc-popover-title");
    expect(title.className).toBe("popover-title title-a");
    expect(description.id).not.toBe("");
    expect(description.dataset.testid).toBe("bwc-popover-description");
    expect(description.className).toBe("popover-description description-a");
    expect(popup.getAttribute("aria-labelledby")).toBe(title.id);
    expect(popup.getAttribute("aria-describedby")).toBe(description.id);
  });

  it("omits labelledby/describedby without slotted title and description", () => {
    const { popup, root } = createPopover();
    document.body.append(root);

    expect(popup.hasAttribute("aria-labelledby")).toBe(false);
    expect(popup.hasAttribute("aria-describedby")).toBe(false);
  });
});

describe("focus", () => {
  it("moves initial focus into the popup and restores the trigger on close", () => {
    const { popup, root, trigger } = createPopover();
    const field = document.createElement("input");
    popup.append(field);
    root.initialFocus = field;
    document.body.append(root);

    root.show();
    expect(document.activeElement).toBe(field);

    root.close();
    expect(document.activeElement).toBe(trigger);
  });

  it("resolves initial focus from a selector", () => {
    const { popup, root } = createPopover();
    const field = document.createElement("input");
    field.id = "popover-field";
    popup.append(field);
    root.initialFocus = "#popover-field";
    document.body.append(root);

    root.show();
    expect(document.activeElement).toBe(field);
    root.close();
  });

  it("honors an explicit final focus target", () => {
    const { root } = createPopover();
    const final = document.createElement("button");
    final.textContent = "After";
    document.body.append(final);
    root.finalFocus = final;
    document.body.append(root);

    root.show();
    root.close();
    expect(document.activeElement).toBe(final);
  });

  it("focuses the popup itself for modal popovers without initial focus", () => {
    const { popup, root } = createPopover();
    root.modal = true;
    document.body.append(root);

    root.show();
    expect(document.activeElement).toBe(popup);
    root.close();
  });

  it("rejects a non-element focus target", () => {
    const { root } = createPopover();
    expect(() => {
      root.initialFocus = 42 as never;
    }).toThrow(TypeError);
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
    const { popup, root, trigger } = createPopover({ defaultOpen: true });
    root.side = "bottom";
    root.align = "start";
    root.collisionPadding = 400;
    mockGeometry(trigger, popup);
    document.body.append(root);

    // Base x would be 300; padding clamps it to 400.
    expect(popup.style.left).toBe("400px");
  });

  it("keeps the arrow away from the popup edges", () => {
    const { popup, root, trigger } = createPopover({ defaultOpen: true });
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
    const { root } = createPopover();
    expect(() => {
      root.collisionPadding = Number.NaN;
    }).toThrow(TypeError);
  });
});

describe("anchor tracking", () => {
  it("stops repositioning when disable-anchor-tracking is set", () => {
    const tracked = createPopover({ defaultOpen: true });
    const trackedMeasure = vi.spyOn(tracked.trigger, "getBoundingClientRect");
    document.body.append(tracked.root);
    const calls = trackedMeasure.mock.calls.length;
    window.dispatchEvent(new Event("resize"));
    expect(trackedMeasure.mock.calls.length).toBeGreaterThan(calls);
    document.body.replaceChildren();

    const frozen = createPopover({ defaultOpen: true });
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
    const { popup, root } = createPopover({ defaultOpen: true });
    document.body.append(root);

    expect(popup.hasAttribute("data-starting-style")).toBe(true);
    await vi.waitFor(() => expect(popup.hasAttribute("data-starting-style")).toBe(false));
  });

  it("hides synchronously without a transition and delays hide with one", async () => {
    const plain = createPopover();
    document.body.append(plain.root);
    plain.root.show();
    plain.root.close();
    expect(plain.popup.hidden).toBe(true);
    expect(plain.popup.hasAttribute("data-ending-style")).toBe(false);
    document.body.replaceChildren();

    const animated = createPopover();
    animated.popup.style.transitionDuration = "0.1s";
    document.body.append(animated.root);
    animated.root.show();
    animated.root.close();
    expect(animated.popup.hasAttribute("data-ending-style")).toBe(true);
    expect(animated.popup.hidden).toBe(false);
    await vi.waitFor(() => expect(animated.popup.hidden).toBe(true));
    expect(animated.popup.hasAttribute("data-ending-style")).toBe(false);
  });

  it("exposes the anchor point as --transform-origin", () => {
    const { popup, root } = createPopover({ defaultOpen: true });
    document.body.append(root);

    // No arrow: align center on the bottom side resolves to the top-center edge.
    expect(popup.style.getPropertyValue("--transform-origin")).toBe("50% 0");
  });

  it("suppresses the native title while open and restores it on close", () => {
    const { root, trigger } = createPopover();
    trigger.title = "Native hint";
    document.body.append(root);

    root.show();
    expect(root.open).toBe(true);
    expect(trigger.hasAttribute("title")).toBe(false);

    root.close();
    expect(trigger.title).toBe("Native hint");
  });
});
