import { afterEach, describe, expect, it, vi } from "vitest";
import {
  BWC_MODAL_CLOSE_TAG,
  BWC_MODAL_POPUP_TAG,
  BWC_MODAL_TRIGGER_TAG,
  BwcModalElement,
} from "./index";

type StatefulElement<State extends object> = HTMLElement & { context: () => State };
function createHost<Element extends HTMLElement>(nativeTag: string, is: string): Element {
  const element = document.createElement(nativeTag) as Element;
  element.setAttribute("is", is);
  return element;
}

afterEach(() => {
  document.body.replaceChildren();
  document.documentElement.style.overflow = "";
});

describe("modal reconnects", () => {
  it("preserves modal open state and reattaches controls", () => {
    const root = new BwcModalElement() as unknown as StatefulElement<{ open: boolean }> & {
      onOpenChange: ((open: boolean) => void) | null;
      open: boolean;
    };
    const callback = vi.fn();
    root.onOpenChange = callback;
    const trigger = createHost<HTMLButtonElement>("button", BWC_MODAL_TRIGGER_TAG);
    const popup = createHost<HTMLDialogElement>("dialog", BWC_MODAL_POPUP_TAG);
    const close = createHost<HTMLButtonElement>("button", BWC_MODAL_CLOSE_TAG);
    root.append(trigger, popup, close);
    document.body.append(root);
    trigger.dispatchEvent(new MouseEvent("click", { bubbles: true, composed: true }));
    expect(root.open).toBe(true);
    expect(document.documentElement.style.overflow).toBe("hidden");
    const state = root.context();

    root.remove();
    expect(document.documentElement.style.overflow).toBe("");
    document.body.append(root);
    expect(document.documentElement.style.overflow).toBe("hidden");

    expect(root.context()).toBe(state);
    expect(root.open).toBe(true);
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    expect(popup.open).toBe(true);
    close.dispatchEvent(new MouseEvent("click", { bubbles: true, composed: true }));
    expect(root.open).toBe(false);
    expect(document.documentElement.style.overflow).toBe("");
    expect(callback).toHaveBeenCalledTimes(2);
  });
});

it("resets removed controlled state without reapplying the default", () => {
  const root = new BwcModalElement() as HTMLElement & { open: boolean };
  root.setAttribute("default-open", "");
  document.body.append(root);
  expect(root.open).toBe(true);
  root.setAttribute("open", "");
  expect(root.open).toBe(true);
  root.removeAttribute("open");
  expect(root.open).toBe(false);
});

describe("document scroll locking", () => {
  it("restores prior inline overflow after native close", async () => {
    document.documentElement.style.overflow = "clip";
    const root = new BwcModalElement() as HTMLElement & { open: boolean };
    const trigger = createHost<HTMLButtonElement>("button", BWC_MODAL_TRIGGER_TAG);
    const popup = createHost<HTMLDialogElement>("dialog", BWC_MODAL_POPUP_TAG);
    root.append(trigger, popup);
    document.body.append(root);

    trigger.click();
    expect(document.documentElement.style.overflow).toBe("hidden");
    popup.close();
    await Promise.resolve();
    expect(root.open).toBe(false);
    expect(document.documentElement.style.overflow).toBe("clip");
  });

  it("unlocks after backdrop dismissal", () => {
    document.documentElement.style.overflow = "scroll";
    const root = new BwcModalElement() as HTMLElement & { open: boolean };
    const trigger = createHost<HTMLButtonElement>("button", BWC_MODAL_TRIGGER_TAG);
    const popup = createHost<HTMLDialogElement>("dialog", BWC_MODAL_POPUP_TAG);
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
    root.append(trigger, popup);
    document.body.append(root);

    trigger.click();
    popup.dispatchEvent(new MouseEvent("click", { bubbles: true, clientX: 0, clientY: 0 }));
    expect(root.open).toBe(false);
    expect(document.documentElement.style.overflow).toBe("scroll");
  });
  it("keeps scrolling locked until every open modal releases ownership", () => {
    document.documentElement.style.overflow = "auto";
    const createModal = () => {
      const root = new BwcModalElement() as HTMLElement & { open: boolean };
      const trigger = createHost<HTMLButtonElement>("button", BWC_MODAL_TRIGGER_TAG);
      const popup = createHost<HTMLDialogElement>("dialog", BWC_MODAL_POPUP_TAG);
      const close = createHost<HTMLButtonElement>("button", BWC_MODAL_CLOSE_TAG);
      root.append(trigger, popup, close);
      document.body.append(root);
      return { close, root, trigger };
    };
    const first = createModal();
    const second = createModal();

    first.trigger.click();
    second.trigger.click();
    first.close.click();
    expect(document.documentElement.style.overflow).toBe("hidden");
    second.close.click();
    expect(document.documentElement.style.overflow).toBe("auto");
  });
});

describe("native dismissal", () => {
  it("synchronizes an uncontrolled native close and reopens on the next trigger click", async () => {
    const root = new BwcModalElement() as HTMLElement & {
      onOpenChange: ((open: boolean) => void) | null;
      open: boolean;
    };
    const callback = vi.fn();
    const trigger = createHost<HTMLButtonElement>("button", BWC_MODAL_TRIGGER_TAG);
    const popup = createHost<HTMLDialogElement>("dialog", BWC_MODAL_POPUP_TAG);
    root.onOpenChange = callback;
    root.append(trigger, popup);
    document.body.append(root);

    trigger.click();
    expect(popup.open).toBe(true);
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    expect(popup.hasAttribute("data-open")).toBe(true);

    popup.close();
    await Promise.resolve();
    expect(root.open).toBe(false);
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    expect(popup.hasAttribute("data-open")).toBe(false);
    expect(callback).toHaveBeenLastCalledWith(false);

    trigger.click();
    expect(root.open).toBe(true);
    expect(popup.open).toBe(true);
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    expect(popup.hasAttribute("data-open")).toBe(true);
    expect(callback.mock.calls).toEqual([[true], [false], [true]]);
  });
});

describe("part classes", () => {
  it("reactively composes part props with authored classes without token growth", async () => {
    const root = new BwcModalElement() as HTMLElement & {
      triggerClass: string;
      popupClass: string;
      closeClass: string;
    };
    root.id = "consumer-modal";
    root.className = "consumer";
    root.setAttribute("trigger-class", "trigger-a");
    root.setAttribute("popup-class", "popup-a");
    root.setAttribute("close-class", "close-a");
    const trigger = createHost<HTMLButtonElement>("button", BWC_MODAL_TRIGGER_TAG);
    const popup = createHost<HTMLDialogElement>("dialog", BWC_MODAL_POPUP_TAG);
    const close = createHost<HTMLButtonElement>("button", BWC_MODAL_CLOSE_TAG);
    trigger.className = "author-trigger";
    popup.className = "author-popup";
    close.className = "author-close";
    root.append(trigger, popup, close);
    document.body.append(root);

    expect(root.id).toBe("consumer-modal");
    expect(root.className).toBe("consumer");
    expect(trigger.className).toBe("modal-trigger author-trigger trigger-a");
    expect(popup.className).toBe("modal-popup author-popup popup-a");
    expect(close.className).toBe("modal-close author-close close-a");

    root.triggerClass = "trigger-b";
    root.popupClass = "popup-b";
    root.closeClass = "close-b";
    await Promise.resolve();
    expect(trigger.className).toBe("modal-trigger author-trigger trigger-b");
    expect(popup.className).toBe("modal-popup author-popup popup-b");
    expect(close.className).toBe("modal-close author-close close-b");

    trigger.className = "new-author";
    await Promise.resolve();
    expect(trigger.className).toBe("modal-trigger new-author trigger-b");
  });
});
