import { afterEach, describe, expect, it, vi } from "vitest";
import { type BwcSlideOutElement } from "./index";
// Side-effect import: registering `bwc-slide-out` happens on module load.
import "./index";

type SlideOutElement = BwcSlideOutElement;

function createSlideOut(options: { defaultOpen?: boolean; open?: boolean } = {}) {
  const root = document.createElement("bwc-slide-out") as SlideOutElement;
  root.toggleAttribute("default-open", options.defaultOpen ?? false);
  root.toggleAttribute("open", options.open ?? false);

  const trigger = document.createElement("button");
  trigger.slot = "trigger";
  trigger.textContent = "Menu";
  const panel = document.createElement("div");
  panel.slot = "panel";
  const link = document.createElement("a");
  link.href = "./counter.html";
  link.textContent = "Counter";
  const close = document.createElement("button");
  close.dataset.close = "";
  close.textContent = "Close";
  panel.append(link, close);
  root.append(trigger, panel);

  return { close, link, panel, root, trigger };
}

function overlayOf(root: SlideOutElement): HTMLElement {
  const veil = root.shadowRoot?.querySelector<HTMLElement>("[data-overlay]");
  if (!veil) throw new Error("slide-out overlay is missing");
  return veil;
}

afterEach(() => document.body.replaceChildren());

describe("native slot structure", () => {
  it("requires one button trigger and one panel", () => {
    const root = document.createElement("bwc-slide-out") as SlideOutElement;
    expect(() => document.body.append(root)).toThrow();
    document.body.replaceChildren();
  });

  it("rebinds dynamically replaced slots", async () => {
    const { panel, root, trigger } = createSlideOut();
    document.body.append(root);
    trigger.click();
    expect(root.open).toBe(true);

    const replacement = document.createElement("div");
    replacement.slot = "panel";
    replacement.textContent = "replaced";
    panel.replaceWith(replacement);

    await vi.waitFor(() => expect(replacement.dataset.testid).toBe("bwc-slide-out-panel"));
    expect(root.open).toBe(true);
  });
});

describe("state and dismissal", () => {
  it("starts closed with a hidden overlay", () => {
    const { panel, root } = createSlideOut();
    document.body.append(root);

    expect(root.open).toBe(false);
    expect(panel.hasAttribute("data-closed")).toBe(true);
    expect(overlayOf(root).hidden).toBe(true);
  });

  it("opens from default-open and moves focus into the panel", () => {
    const { link, root, trigger } = createSlideOut({ defaultOpen: true });
    document.body.append(root);
    trigger.focus();

    trigger.click();
    trigger.click();
    expect(root.open).toBe(true);
    expect(document.activeElement).toBe(link);
  });

  it("toggles from the trigger and emits open-change", () => {
    const { panel, root, trigger } = createSlideOut();
    const seen: Array<boolean> = [];
    root.onOpenChange = (value) => {
      seen.push(value);
    };
    document.body.append(root);

    trigger.click();
    expect(root.open).toBe(true);
    expect(panel.hasAttribute("data-open")).toBe(true);
    expect(overlayOf(root).hidden).toBe(false);

    trigger.click();
    expect(root.open).toBe(false);
    expect(seen).toEqual([true, false]);
  });

  it("closes from the inner close button", () => {
    const { close, root, trigger } = createSlideOut();
    document.body.append(root);

    trigger.click();
    close.click();
    expect(root.open).toBe(false);
    expect(overlayOf(root).hidden).toBe(true);
  });

  it("closes from an overlay click", () => {
    const { root, trigger } = createSlideOut();
    document.body.append(root);

    trigger.click();
    overlayOf(root).click();
    expect(root.open).toBe(false);
  });

  it("closes on Escape and restores trigger focus", () => {
    const { root, trigger } = createSlideOut();
    document.body.append(root);
    trigger.focus();

    trigger.click();
    document.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "Escape" }));
    expect(root.open).toBe(false);
  });
  it("keeps the trigger cursor synchronized with disabled state", () => {
    const { root, trigger } = createSlideOut();
    document.body.append(root);
    expect(trigger.style.cursor).toBe("pointer");

    root.disabled = true;
    expect(trigger.style.cursor).toBe("not-allowed");
    trigger.click();
    expect(root.open).toBe(false);

    root.disabled = false;
    expect(trigger.style.cursor).toBe("pointer");
  });

  it("notifies controlled interactions without changing state until the attribute changes", async () => {
    const { close, root, trigger } = createSlideOut({ open: true });
    const callback = vi.fn();
    root.onOpenChange = callback;
    document.body.append(root);
    expect(root.open).toBe(true);

    close.click();
    expect(root.open).toBe(true);
    expect(callback).toHaveBeenCalledWith(false);

    root.removeAttribute("open");
    await vi.waitFor(() => expect(root.open).toBe(false));
    expect(overlayOf(root).hidden).toBe(true);
    trigger.click();
    expect(root.open).toBe(false);
  });

  it("preserves uncontrolled state across reconnects", () => {
    const { root, trigger } = createSlideOut();
    document.body.append(root);

    trigger.click();
    expect(root.open).toBe(true);
    root.remove();
    document.body.append(root);
    expect(root.open).toBe(true);
  });
});

describe("parts", () => {
  it("applies part classes after the stable marker class", () => {
    const { close, panel, root, trigger } = createSlideOut();
    root.triggerClass = "author-trigger";
    root.panelClass = "author-panel";
    root.closeClass = "author-close";
    document.body.append(root);

    for (const [part, marker, author] of [
      [trigger, "slide-out-trigger", "author-trigger"],
      [panel, "slide-out-panel", "author-panel"],
      [close, "slide-out-close", "author-close"],
    ] as const) {
      const tokens = part.className.split(/\s+/);
      expect(tokens[0]).toBe(marker);
      expect(tokens).toContain(author);
    }
  });
  it("rejects an invalid side at the boundary", () => {
    const { root } = createSlideOut();
    document.body.append(root);
    expect(() => {
      (root as unknown as Record<string, unknown>).side = "top";
    }).toThrow(/side must be one of/);
  });

  it("supports the left side", () => {
    const { panel, root } = createSlideOut();
    root.side = "left";
    document.body.append(root);
    expect(panel.dataset.side).toBe("left");
  });

  it("removes listeners on unmount", () => {
    const { root, trigger } = createSlideOut();
    const removeSpy = vi.spyOn(document, "removeEventListener");
    document.body.append(root);
    root.remove();
    expect(removeSpy).toHaveBeenCalledWith("keydown", expect.any(Function));
    removeSpy.mockRestore();
    expect(trigger.isConnected).toBe(false);
  });
});
