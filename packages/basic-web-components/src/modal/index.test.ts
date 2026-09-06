import { afterEach, describe, expect, it, vi } from "vitest";
import { type BwcModalElement } from "./index";
// Side-effect import: registering `bwc-modal` happens on module load.
import "./index";

type ModalElement = BwcModalElement;

function createModal(options: { defaultOpen?: boolean; open?: boolean } = {}) {
  const root = document.createElement("bwc-modal") as ModalElement;
  root.toggleAttribute("default-open", options.defaultOpen ?? false);
  root.toggleAttribute("open", options.open ?? false);

  const trigger = document.createElement("button");
  trigger.slot = "trigger";
  trigger.textContent = "Open";
  const popup = document.createElement("dialog");
  popup.slot = "popup";
  const close = document.createElement("button");
  close.dataset.close = "";
  close.textContent = "Close";
  popup.append(close);
  root.append(trigger, popup);

  return { close, popup, root, trigger };
}

afterEach(() => {
  document.body.replaceChildren();
  document.documentElement.style.overflow = "";
});

describe("native slot structure", () => {
  it("requires one button trigger and one dialog popup", () => {
    const root = document.createElement("bwc-modal");
    const trigger = document.createElement("div");
    trigger.slot = "trigger";
    const popup = document.createElement("dialog");
    popup.slot = "popup";
    root.append(trigger, popup);

    expect(() => document.body.append(root)).toThrow(TypeError);
  });

  it("rebinds replacement slots without dropping an active lock", async () => {
    const { popup, root, trigger } = createModal();
    document.body.append(root);
    trigger.click();
    expect(document.documentElement.style.overflow).toBe("hidden");

    const replacement = document.createElement("dialog");
    replacement.slot = "popup";
    popup.replaceWith(replacement);

    await vi.waitFor(() => expect(replacement.open).toBe(true));
    expect(popup.open).toBe(false);
    expect(document.documentElement.style.overflow).toBe("hidden");
  });
});

describe("state and native dismissal", () => {
  it("keeps the trigger cursor synchronized with disabled state", () => {
    const { root, trigger } = createModal();
    document.body.append(root);

    root.disabled = true;
    expect(trigger.disabled).toBe(true);
    expect(trigger.style.cursor).toBe("not-allowed");

    root.disabled = false;
    expect(trigger.disabled).toBe(false);
    expect(trigger.style.cursor).toBe("pointer");
  });

  it("preserves uncontrolled state across reconnects and reattaches controls", () => {
    const { close, popup, root, trigger } = createModal();
    const callback = vi.fn();
    root.onOpenChange = callback;
    document.body.append(root);

    trigger.click();
    root.remove();
    expect(document.documentElement.style.overflow).toBe("");
    document.body.append(root);

    expect(root.open).toBe(true);
    expect(popup.open).toBe(true);
    expect(document.documentElement.style.overflow).toBe("hidden");
    close.click();
    expect(root.open).toBe(false);
    expect(callback.mock.calls).toEqual([[true], [false]]);
  });

  it("notifies controlled interactions without changing state until the attribute changes", async () => {
    const { close, popup, root, trigger } = createModal({ open: true });
    const callback = vi.fn();
    root.onOpenChange = callback;
    const changes: boolean[] = [];
    root.addEventListener("open-change", (event: Event) => {
      changes.push((event as CustomEvent<{ open: boolean }>).detail.open);
    });
    document.body.append(root);

    close.click();
    expect(root.open).toBe(true);
    expect(popup.open).toBe(true);
    expect(callback).toHaveBeenCalledWith(false);
    expect(changes).toEqual([false]);

    root.removeAttribute("open");
    await vi.waitFor(() => expect(root.open).toBe(false));
    expect(popup.open).toBe(false);
    trigger.click();
    expect(root.open).toBe(false);
  });

  it("handles cancel and backdrop dismissal and restores trigger focus", () => {
    const { popup, root, trigger } = createModal();
    vi.spyOn(popup, "getBoundingClientRect").mockReturnValue({
      bottom: 30,
      height: 20,
      left: 10,
      right: 30,
      top: 10,
      width: 20,
      x: 10,
      y: 10,
      toJSON: () => ({}),
    });
    document.body.append(root);

    trigger.click();
    const cancel = new Event("cancel", { cancelable: true });
    popup.dispatchEvent(cancel);
    expect(cancel.defaultPrevented).toBe(true);
    expect(root.open).toBe(false);
    expect(document.activeElement).toBe(trigger);

    trigger.click();
    popup.dispatchEvent(new MouseEvent("click", { bubbles: true, clientX: 0, clientY: 0 }));
    expect(root.open).toBe(false);
  });

  it("synchronizes a native close and can reopen", () => {
    const { popup, root, trigger } = createModal();
    document.body.append(root);

    trigger.click();
    popup.close();
    expect(root.open).toBe(false);
    trigger.click();
    expect(popup.open).toBe(true);
  });
});

describe("document scroll locking", () => {
  it("restores prior overflow after the last owner closes", () => {
    document.documentElement.style.overflow = "clip";
    const first = createModal();
    const second = createModal();
    document.body.append(first.root, second.root);

    first.trigger.click();
    second.trigger.click();
    first.close.click();
    expect(document.documentElement.style.overflow).toBe("hidden");
    second.close.click();
    expect(document.documentElement.style.overflow).toBe("clip");
  });

  it("does not leak a lock when showModal fails and permits retry", () => {
    const { popup, root, trigger } = createModal();
    const showModal = vi.spyOn(popup, "showModal");
    showModal.mockImplementationOnce(() => {
      throw new DOMException("failed", "InvalidStateError");
    });
    document.body.append(root);

    expect(() => trigger.click()).toThrow(DOMException);
    expect(root.open).toBe(false);
    expect(document.documentElement.style.overflow).toBe("");
    trigger.click();
    expect(root.open).toBe(true);
    expect(document.documentElement.style.overflow).toBe("hidden");
  });
});

describe("parts", () => {
  it("preserves author classes and reacts without token growth", async () => {
    const { close, popup, root, trigger } = createModal();
    trigger.className = "author-trigger";
    popup.className = "author-popup";
    close.className = "author-close";
    root.triggerClass = "trigger-a";
    root.popupClass = "popup-a";
    root.closeClass = "close-a";
    document.body.append(root);

    expect(trigger.className).toBe("modal-trigger author-trigger trigger-a");
    expect(popup.className).toBe("modal-popup author-popup popup-a");
    expect(close.className).toBe("modal-close author-close close-a");
    expect(trigger.id).not.toBe("");
    expect(trigger.dataset.testid).toBe("bwc-modal-trigger");
    expect(trigger.style.cursor).toBe("pointer");
    expect(popup.dataset.testid).toBe("bwc-modal-popup");
    expect(close.dataset.testid).toBe("bwc-modal-close");

    root.triggerClass = "trigger-b";
    trigger.className = "new-author";
    await Promise.resolve();
    expect(trigger.className).toBe("modal-trigger new-author trigger-b");
  });

  it("ignores data-close buttons owned by a nested modal", () => {
    const outer = createModal();
    const inner = createModal();
    outer.popup.append(inner.root);
    document.body.append(outer.root);
    outer.trigger.click();

    inner.close.click();
    expect(outer.root.open).toBe(true);
  });
});
