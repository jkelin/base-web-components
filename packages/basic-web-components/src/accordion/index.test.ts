import { afterEach, describe, expect, it, vi } from "vitest";
import {
  BWC_ACCORDION_ITEM_TAG,
  BWC_ACCORDION_PANEL_TAG,
  BWC_ACCORDION_TRIGGER_TAG,
  BwcAccordionElement,
} from "./index";

type StatefulElement<State extends object> = HTMLElement & { context: () => State };
function createHost<Element extends HTMLElement>(nativeTag: string, is: string): Element {
  const element = document.createElement(nativeTag) as Element;
  element.setAttribute("is", is);
  return element;
}

afterEach(() => document.body.replaceChildren());

describe("accordion reconnects", () => {
  it("preserves accordion expanded values and reattaches delegation", () => {
    const root = new BwcAccordionElement() as unknown as StatefulElement<{
      value: string[];
    }> & {
      defaultValue: string[];
      onValueChange: ((value: string[]) => void) | null;
      value: string[];
    };
    const callback = vi.fn();
    root.defaultValue = ["one"];
    root.onValueChange = callback;

    const item = document.createElement(BWC_ACCORDION_ITEM_TAG);
    item.setAttribute("value", "two");
    const trigger = createHost<HTMLButtonElement>("button", BWC_ACCORDION_TRIGGER_TAG);
    const panel = document.createElement(BWC_ACCORDION_PANEL_TAG);
    item.append(trigger, panel);
    root.append(item);
    document.body.append(root);
    trigger.dispatchEvent(new MouseEvent("click", { bubbles: true, composed: true }));
    expect(root.value).toEqual(["two"]);
    const state = root.context();

    root.remove();
    document.body.append(root);

    expect(root.context()).toBe(state);
    expect(root.value).toEqual(["two"]);
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    expect(panel.hidden).toBe(false);
    trigger.dispatchEvent(new MouseEvent("click", { bubbles: true, composed: true }));
    expect(root.value).toEqual([]);
    expect(callback).toHaveBeenCalledTimes(2);
  });
});

it("resets removed controlled state without reapplying the default", () => {
  const root = new BwcAccordionElement() as HTMLElement & { value: string[] };
  root.setAttribute("default-value", '["one"]');
  document.body.append(root);
  expect(root.value).toEqual(["one"]);
  root.setAttribute("value", '["two"]');
  expect(root.value).toEqual(["two"]);
  root.removeAttribute("value");
  expect(root.value).toEqual([]);
});
