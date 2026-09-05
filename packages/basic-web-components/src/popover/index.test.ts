import { afterEach, describe, expect, it, vi } from "vitest";
import {
  BWC_POPOVER_CLOSE_TAG,
  BWC_POPOVER_POPUP_TAG,
  BWC_POPOVER_TRIGGER_TAG,
  BwcPopoverElement,
} from "./index";

type StatefulElement<State extends object> = HTMLElement & { context: () => State };
function createHost<Element extends HTMLElement>(nativeTag: string, is: string): Element {
  const element = document.createElement(nativeTag) as Element;
  element.setAttribute("is", is);
  return element;
}

afterEach(() => document.body.replaceChildren());

describe("popover reconnects", () => {
  it("preserves popover open state and reattaches controls", () => {
    const root = new BwcPopoverElement() as unknown as StatefulElement<{ open: boolean }> & {
      onOpenChange: ((open: boolean) => void) | null;
      open: boolean;
    };
    const callback = vi.fn();
    root.onOpenChange = callback;
    const trigger = createHost<HTMLButtonElement>("button", BWC_POPOVER_TRIGGER_TAG);
    const popup = createHost<HTMLDivElement>("div", BWC_POPOVER_POPUP_TAG);
    const close = createHost<HTMLButtonElement>("button", BWC_POPOVER_CLOSE_TAG);
    root.append(trigger, popup, close);
    document.body.append(root);
    trigger.dispatchEvent(new MouseEvent("click", { bubbles: true, composed: true }));
    expect(root.open).toBe(true);
    const state = root.context();

    root.remove();
    document.body.append(root);

    expect(root.context()).toBe(state);
    expect(root.open).toBe(true);
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    expect(popup.hidden).toBe(false);
    close.dispatchEvent(new MouseEvent("click", { bubbles: true, composed: true }));
    expect(root.open).toBe(false);
    expect(callback).toHaveBeenCalledTimes(2);
  });
});

it("resets removed controlled state without reapplying the default", () => {
  const root = new BwcPopoverElement() as HTMLElement & { open: boolean };
  root.setAttribute("default-open", "");
  document.body.append(root);
  expect(root.open).toBe(true);
  root.setAttribute("open", "");
  expect(root.open).toBe(true);
  root.removeAttribute("open");
  expect(root.open).toBe(false);
});
describe("fixed positioning", () => {
  it.each([
    ["bottom", "translate3d(10px, 45px, 0)"],
    ["top", "translate3d(10px, 15px, 0) translateY(-100%)"],
    ["right", "translate3d(35px, 20px, 0)"],
    ["left", "translate3d(5px, 20px, 0) translateX(-100%)"],
  ] as const)("positions on the %s without reading popup size", (side, transform) => {
    const root = new BwcPopoverElement() as HTMLElement & { open: boolean };
    root.setAttribute("default-open", "");
    root.setAttribute("side", side);
    root.setAttribute("side-offset", "5");
    const trigger = createHost<HTMLButtonElement>("button", BWC_POPOVER_TRIGGER_TAG);
    const popup = createHost<HTMLDivElement>("div", BWC_POPOVER_POPUP_TAG);
    popup.style.inset = "10px 20px 30px 40px";
    popup.style.margin = "8px";
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
    vi.spyOn(popup, "getBoundingClientRect").mockImplementation(() => {
      throw new Error("popup getBoundingClientRect must not be read");
    });
    Object.defineProperties(popup, {
      offsetHeight: {
        get: () => {
          throw new Error("offsetHeight must not be read");
        },
      },
      offsetWidth: {
        get: () => {
          throw new Error("offsetWidth must not be read");
        },
      },
    });
    root.append(trigger, popup);
    document.body.append(root);

    expect(popup.style.position).toBe("fixed");
    expect(popup.style.inset).toBe("0 auto auto 0");
    expect(popup.style.margin).toBe("0px");
    expect(popup.style.transform).toBe(transform);
  });
});

describe("native dismissal", () => {
  it("synchronizes uncontrolled light-dismiss and reopens on the next trigger click", () => {
    const root = new BwcPopoverElement() as HTMLElement & {
      onOpenChange: ((open: boolean) => void) | null;
      open: boolean;
    };
    const callback = vi.fn();
    const trigger = createHost<HTMLButtonElement>("button", BWC_POPOVER_TRIGGER_TAG);
    const popup = createHost<HTMLDivElement>("div", BWC_POPOVER_POPUP_TAG);
    root.onOpenChange = callback;
    root.append(trigger, popup);
    document.body.append(root);

    trigger.click();
    expect(popup.hidden).toBe(false);
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    expect(popup.hasAttribute("data-open")).toBe(true);

    popup.hidden = true;
    const toggle = new Event("toggle");
    Object.defineProperty(toggle, "newState", { value: "closed" });
    popup.dispatchEvent(toggle);
    expect(root.open).toBe(false);
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    expect(popup.hasAttribute("data-open")).toBe(false);
    expect(callback).toHaveBeenLastCalledWith(false);

    trigger.click();
    expect(root.open).toBe(true);
    expect(popup.hidden).toBe(false);
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    expect(popup.hasAttribute("data-open")).toBe(true);
    expect(callback.mock.calls).toEqual([[true], [false], [true]]);
  });
});
