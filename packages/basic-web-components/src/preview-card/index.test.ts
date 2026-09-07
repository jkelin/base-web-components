import { afterEach, describe, expect, it, vi } from "vitest";
import { type BwcPreviewCardElement } from "./index";
// Side-effect import: registering `bwc-preview-card` happens on module load.
import "./index";

type PreviewCardElement = BwcPreviewCardElement;

function createPreviewCard(options: { defaultOpen?: boolean; open?: boolean } = {}) {
  const root = document.createElement("bwc-preview-card") as PreviewCardElement;
  root.toggleAttribute("default-open", options.defaultOpen ?? false);
  root.toggleAttribute("open", options.open ?? false);

  const trigger = document.createElement("a");
  trigger.slot = "trigger";
  trigger.href = "#docs";
  trigger.textContent = "Documentation";
  const popup = document.createElement("div");
  popup.slot = "popup";
  popup.textContent = "Preview";
  root.append(trigger, popup);

  return { popup, root, trigger };
}

function clickTrigger(trigger: HTMLElement) {
  trigger.dispatchEvent(new MouseEvent("click", { bubbles: true }));
}

afterEach(() => document.body.replaceChildren());

describe("slot structure", () => {
  it("requires one anchor trigger and one div popup", () => {
    const root = document.createElement("bwc-preview-card");
    const trigger = document.createElement("a");
    trigger.slot = "trigger";
    trigger.href = "#docs";
    const first = document.createElement("div");
    first.slot = "popup";
    const second = document.createElement("div");
    second.slot = "popup";
    root.append(trigger, first, second);

    expect(() => document.body.append(root)).toThrow(TypeError);
  });

  it("rejects a non-anchor trigger", () => {
    const root = document.createElement("bwc-preview-card");
    const trigger = document.createElement("button");
    trigger.slot = "trigger";
    const popup = document.createElement("div");
    popup.slot = "popup";
    root.append(trigger, popup);

    expect(() => document.body.append(root)).toThrow(TypeError);
  });

  it("rejects an anchor trigger without href", () => {
    const root = document.createElement("bwc-preview-card");
    const trigger = document.createElement("a");
    trigger.slot = "trigger";
    const popup = document.createElement("div");
    popup.slot = "popup";
    root.append(trigger, popup);

    expect(() => document.body.append(root)).toThrow(TypeError);
  });

  it("rebinds dynamically replaced slots", async () => {
    const { popup, root } = createPreviewCard({ defaultOpen: true });
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
    const { root, trigger } = createPreviewCard();
    document.body.append(root);

    root.disabled = true;
    expect(trigger.getAttribute("aria-disabled")).toBe("true");
    expect(trigger.style.cursor).toBe("not-allowed");

    root.disabled = false;
    expect(trigger.hasAttribute("aria-disabled")).toBe(false);
    expect(trigger.style.cursor).toBe("pointer");
  });

  it("preserves uncontrolled state across reconnects", () => {
    const { popup, root } = createPreviewCard();
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
    const { popup, root } = createPreviewCard();
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
    const { root } = createPreviewCard({ open: true });
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
    const { popup, root, trigger } = createPreviewCard();
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
    const { popup, root, trigger } = createPreviewCard();
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

  it("keeps the card open while the pointer rests on it", () => {
    vi.useFakeTimers();
    try {
      const { popup, root, trigger } = createPreviewCard();
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

  it("opens on focus and closes on blur outside", () => {
    const { popup, root, trigger } = createPreviewCard();
    document.body.append(root);

    trigger.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
    expect(root.open).toBe(true);

    popup.dispatchEvent(
      new FocusEvent("focusout", { bubbles: true, relatedTarget: document.body }),
    );
    expect(root.open).toBe(false);
  });

  it("stays open when focus moves into the card", () => {
    const { popup, root, trigger } = createPreviewCard();
    document.body.append(root);

    trigger.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
    trigger.dispatchEvent(new FocusEvent("focusout", { bubbles: true, relatedTarget: popup }));
    expect(root.open).toBe(true);
  });

  it("closes an open card on Escape and outside pointerdown", () => {
    const { root, trigger } = createPreviewCard({ defaultOpen: true });
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
    const closable = createPreviewCard({ defaultOpen: true });
    document.body.append(closable.root);
    clickTrigger(closable.trigger);
    expect(closable.root.open).toBe(false);
    document.body.replaceChildren();

    const sticky = createPreviewCard({ defaultOpen: true });
    sticky.root.closeOnClick = false;
    document.body.append(sticky.root);
    clickTrigger(sticky.trigger);
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

  it("opens below by default with inline geometry", () => {
    const { popup, root, trigger } = createPreviewCard({ defaultOpen: true });
    mockGeometry(trigger, popup);
    document.body.append(root);

    // Trigger 300,300 20x20; popup 120x60; no gap.
    expect(popup.dataset.side).toBe("bottom");
    expect(popup.dataset.align).toBe("center");
    expect(popup.style.position).toBe("fixed");
    expect(popup.style.left).toBe("250px");
    expect(popup.style.top).toBe("320px");
  });

  it("honors side, align, and align-offset attributes", () => {
    const { popup, root, trigger } = createPreviewCard({ defaultOpen: true });
    root.side = "top";
    root.align = "start";
    root.alignOffset = 4;
    mockGeometry(trigger, popup);
    document.body.append(root);

    expect(popup.dataset.side).toBe("top");
    expect(popup.dataset.align).toBe("start");
    expect(popup.style.left).toBe("304px");
    expect(popup.style.top).toBe("240px");
  });

  it("positions an arrow child on the cross axis", () => {
    const { popup, root, trigger } = createPreviewCard({ defaultOpen: true });
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
    const { popup, root, trigger } = createPreviewCard({ defaultOpen: true });
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
    const first = createPreviewCard();
    const second = createPreviewCard();
    document.body.append(first.root, second.root);

    // Vitest stubs `?inline` CSS to an empty string, so this guards the
    // install mechanism only; content ships via the build (see dist output).
    expect(document.getElementById("bwc-preview-card-style")?.localName).toBe("style");
    expect(document.querySelectorAll("#bwc-preview-card-style")).toHaveLength(1);
  });
});

describe("imperative open/close", () => {
  it("opens, closes, and toggles through methods with events", () => {
    const { popup, root, trigger } = createPreviewCard();
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
    const { root } = createPreviewCard();
    document.body.append(root);

    root.open = true;
    await vi.waitFor(() => expect(root.getAttribute("open")).toBe(""));
    expect(root.open).toBe(true);

    root.open = false;
    await vi.waitFor(() => expect(root.hasAttribute("open")).toBe(false));
  });

  it("anchors programmatic opens to the trigger by default", () => {
    const { popup, root, trigger } = createPreviewCard();
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
    // Default side bottom below the 20..40 trigger.
    expect(popup.style.top).toBe("40px");
  });

  it("honors an anchor selector override", () => {
    const { popup, root, trigger } = createPreviewCard();
    const alt = document.createElement("a");
    alt.id = "alt-anchor";
    alt.href = "#alt";
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
    // Default side bottom below the 200..220 anchor.
    expect(popup.style.top).toBe("220px");
  });
});

describe("parts", () => {
  it("preserves reactive classes and adds stable selectors, ARIA, and cursors", async () => {
    const { popup, root, trigger } = createPreviewCard();
    trigger.className = "author-trigger";
    popup.className = "author-popup";
    root.triggerClass = "trigger-a";
    root.popupClass = "popup-a";
    document.body.append(root);

    expect(trigger.className).toBe("preview-card-trigger author-trigger trigger-a");
    expect(popup.className).toBe("preview-card-popup author-popup popup-a");
    expect(trigger.id).not.toBe("");
    expect(trigger.dataset.testid).toBe("bwc-preview-card-trigger");
    expect(trigger.style.cursor).toBe("pointer");
    expect(trigger.getAttribute("aria-haspopup")).toBe("dialog");
    expect(trigger.getAttribute("aria-controls")).toBe(popup.id);
    expect(popup.dataset.testid).toBe("bwc-preview-card-popup");
    expect(popup.getAttribute("role")).toBe("dialog");
    expect(popup.hasAttribute("data-floating")).toBe(true);

    root.popupClass = "popup-b";
    popup.className = "new-author";
    await Promise.resolve();
    expect(popup.className).toBe("preview-card-popup new-author popup-b");
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
    const { popup, root, trigger } = createPreviewCard({ defaultOpen: true });
    root.align = "start";
    root.collisionPadding = 400;
    mockGeometry(trigger, popup);
    document.body.append(root);

    // Base x would be 300; padding clamps it to 400.
    expect(popup.style.left).toBe("400px");
  });

  it("keeps the arrow away from the popup edges", () => {
    const { popup, root, trigger } = createPreviewCard({ defaultOpen: true });
    const arrow = document.createElement("div");
    arrow.dataset.arrow = "";
    popup.append(arrow);
    root.align = "start";
    root.arrowPadding = 20;
    mockGeometry(trigger, popup);
    vi.spyOn(arrow, "getBoundingClientRect").mockReturnValue(rect({ height: 8, width: 8 }));
    document.body.append(root);

    // Anchor center 310 against popup x 300 leaves 6px; padding lifts it to 20.
    expect(arrow.style.left).toBe("20px");
  });

  it("rejects non-finite padding", () => {
    const { root } = createPreviewCard();
    expect(() => {
      root.collisionPadding = Number.NaN;
    }).toThrow(TypeError);
  });
});

describe("anchor tracking", () => {
  it("stops repositioning when disable-anchor-tracking is set", () => {
    const tracked = createPreviewCard({ defaultOpen: true });
    const trackedMeasure = vi.spyOn(tracked.trigger, "getBoundingClientRect");
    document.body.append(tracked.root);
    const calls = trackedMeasure.mock.calls.length;
    window.dispatchEvent(new Event("resize"));
    expect(trackedMeasure.mock.calls.length).toBeGreaterThan(calls);
    document.body.replaceChildren();

    const frozen = createPreviewCard({ defaultOpen: true });
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
    const { popup, root } = createPreviewCard({ defaultOpen: true });
    document.body.append(root);

    expect(popup.hasAttribute("data-starting-style")).toBe(true);
    await vi.waitFor(() => expect(popup.hasAttribute("data-starting-style")).toBe(false));
  });

  it("hides synchronously without a transition and delays hide with one", async () => {
    const plain = createPreviewCard();
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

    const animated = createPreviewCard();
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
    const { popup, root } = createPreviewCard({ defaultOpen: true });
    document.body.append(root);

    // No arrow: align center on the bottom side resolves to the top-center edge.
    expect(popup.style.getPropertyValue("--transform-origin")).toBe("50% 0");
  });

  it("suppresses the native title while open and restores it on close", () => {
    const { popup, root, trigger } = createPreviewCard();
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
