import { afterEach, describe, expect, it, vi } from "vitest";
import { BwcTabsElement } from "./index";

type Orientation = "horizontal" | "vertical";
type ActivationMode = "automatic" | "manual";
type TabsApi = HTMLElement & {
  activationMode: ActivationMode;
  defaultValue: string;
  disabled: boolean;
  onValueChange: ((value: string) => void) | null;
  orientation: Orientation;
  value: string;
};

type TabsFixture = {
  root: TabsApi;
  list: HTMLDivElement;
  first: HTMLButtonElement;
  second: HTMLButtonElement;
  firstPanel: HTMLElement;
  secondPanel: HTMLElement;
};

function tab(value: string, label = value): HTMLButtonElement {
  const button = document.createElement("button");
  button.value = value;
  button.textContent = label;
  return button;
}

function panel(value: string): HTMLElement {
  const section = document.createElement("section");
  section.slot = "panel";
  section.dataset.value = value;
  section.textContent = `${value} panel`;
  return section;
}

function createTabs(): TabsFixture {
  const root = document.createElement("bwc-tabs") as TabsApi;
  const list = document.createElement("div");
  list.slot = "list";
  const first = tab("first");
  const second = tab("second");
  const firstPanel = panel("first");
  const secondPanel = panel("second");
  list.append(first, second);
  root.append(list, firstPanel, secondPanel);
  return { root, list, first, second, firstPanel, secondPanel };
}

function connectTabs(tabs: TabsFixture): void {
  document.body.append(tabs.root);
}

async function settle(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

function key(button: HTMLButtonElement, value: string): void {
  button.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: value }));
}

afterEach(() => {
  vi.unstubAllGlobals();
  document.body.replaceChildren();
});

describe("native tabs", () => {
  it("projects one direct list and matched direct panels", async () => {
    const tabs = createTabs();
    tabs.root.defaultValue = "second";
    connectTabs(tabs);
    await settle();

    expect(tabs.root.shadowRoot?.querySelector('slot[name="list"]')).not.toBeNull();
    expect(tabs.root.shadowRoot?.querySelector('slot[name="panel"]')).not.toBeNull();
    expect(tabs.list.getAttribute("role")).toBe("tablist");
    expect(tabs.root.value).toBe("second");
    expect(tabs.first.getAttribute("aria-selected")).toBe("false");
    expect(tabs.first.tabIndex).toBe(-1);
    expect(tabs.second.getAttribute("aria-selected")).toBe("true");
    expect(tabs.second.tabIndex).toBe(0);
    expect(tabs.firstPanel.hidden).toBe(true);
    expect(tabs.secondPanel.hidden).toBe(false);
    expect(tabs.second.getAttribute("aria-controls")).toBe(tabs.secondPanel.id);
    expect(tabs.secondPanel.getAttribute("aria-labelledby")).toBe(tabs.second.id);
  });

  it("selects by click and emits callback then composed event", async () => {
    const tabs = createTabs();
    const order: string[] = [];
    tabs.root.defaultValue = "first";
    tabs.root.onValueChange = (value) => order.push(`callback:${value}`);
    tabs.root.addEventListener("value-change", (event) => {
      order.push(`event:${(event as CustomEvent<{ value: string }>).detail.value}`);
    });
    connectTabs(tabs);
    await settle();

    tabs.second.click();

    expect(tabs.root.value).toBe("second");
    expect(tabs.secondPanel.hidden).toBe(false);
    expect(order).toEqual(["callback:second", "event:second"]);
  });

  it("keeps controlled selection authoritative and resets when control is removed", async () => {
    const tabs = createTabs();
    tabs.root.defaultValue = "first";
    tabs.root.value = "second";
    const changes = vi.fn();
    tabs.root.onValueChange = changes;
    connectTabs(tabs);
    await settle();

    tabs.first.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
    tabs.first.focus();
    await settle();
    tabs.first.dispatchEvent(new MouseEvent("click", { bubbles: true, detail: 1 }));
    expect(changes).toHaveBeenCalledTimes(1);
    expect(changes).toHaveBeenCalledWith("first");
    tabs.first.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
    tabs.first.dispatchEvent(new MouseEvent("click", { bubbles: true, detail: 1 }));
    expect(changes).toHaveBeenCalledTimes(2);
    expect(tabs.root.value).toBe("second");
    expect(tabs.secondPanel.hidden).toBe(false);

    tabs.root.removeAttribute("value");
    await settle();
    expect(tabs.root.value).toBe("");
    expect(tabs.firstPanel.hidden).toBe(true);
    expect(tabs.secondPanel.hidden).toBe(true);
  });

  it("supports roving focus and automatic activation in both orientations", async () => {
    const tabs = createTabs();
    tabs.root.defaultValue = "first";
    connectTabs(tabs);
    await settle();

    tabs.first.focus();
    key(tabs.first, "ArrowRight");
    expect(document.activeElement).toBe(tabs.second);
    expect(tabs.root.value).toBe("second");

    key(tabs.second, "Home");
    expect(document.activeElement).toBe(tabs.first);
    expect(tabs.root.value).toBe("first");

    tabs.root.orientation = "vertical";
    await settle();
    expect(tabs.list.getAttribute("aria-orientation")).toBe("vertical");
    key(tabs.first, "ArrowDown");
    expect(document.activeElement).toBe(tabs.second);
    key(tabs.second, "End");
    expect(document.activeElement).toBe(tabs.second);
  });

  it("moves focus without selecting until Enter or Space in manual mode", async () => {
    const tabs = createTabs();
    tabs.root.defaultValue = "first";
    tabs.root.activationMode = "manual";
    connectTabs(tabs);
    await settle();

    tabs.first.focus();
    key(tabs.first, "ArrowRight");
    expect(document.activeElement).toBe(tabs.second);
    expect(tabs.root.value).toBe("first");

    key(tabs.second, "Enter");
    expect(tabs.root.value).toBe("second");
    key(tabs.first, " ");
    expect(tabs.root.value).toBe("first");
  });

  it("filters disabled tabs from activation and keyboard navigation", async () => {
    const tabs = createTabs();
    tabs.root.defaultValue = "first";
    tabs.second.disabled = true;
    connectTabs(tabs);
    await settle();

    tabs.second.click();
    expect(tabs.root.value).toBe("first");
    tabs.first.focus();
    key(tabs.first, "ArrowRight");
    expect(document.activeElement).toBe(tabs.first);
    expect(tabs.second.style.cursor).toBe("not-allowed");
    expect(tabs.second.hasAttribute("data-disabled")).toBe(true);

    tabs.root.disabled = true;
    await settle();
    tabs.first.click();
    expect(tabs.first.disabled).toBe(true);
    expect(tabs.first.style.cursor).toBe("not-allowed");
    tabs.root.disabled = false;
    await settle();
    expect(tabs.first.disabled).toBe(false);
    expect(tabs.second.disabled).toBe(true);
  });

  it("validates one list and complete unique nonempty button-panel matches", () => {
    const missingList = document.createElement("bwc-tabs");
    expect(() => document.body.append(missingList)).toThrow(/exactly one/);
    document.body.replaceChildren();

    const twoLists = createTabs();
    const extra = document.createElement("div");
    extra.slot = "list";
    twoLists.root.append(extra);
    expect(() => connectTabs(twoLists)).toThrow(/exactly one/);
    document.body.replaceChildren();

    const empty = createTabs();
    empty.first.value = "";
    expect(() => connectTabs(empty)).toThrow(/unique and nonempty/);
    document.body.replaceChildren();

    const duplicate = createTabs();
    duplicate.second.value = "first";
    expect(() => connectTabs(duplicate)).toThrow(/unique and nonempty/);
    document.body.replaceChildren();

    const unmatched = createTabs();
    unmatched.secondPanel.dataset.value = "other";
    expect(() => connectTabs(unmatched)).toThrow(/matched/);
  });

  it("reacts to button and panel attributes, additions, removals, and replacements", async () => {
    const tabs = createTabs();
    tabs.root.defaultValue = "first";
    connectTabs(tabs);
    await settle();

    tabs.second.value = "renamed";
    tabs.secondPanel.dataset.value = "renamed";
    await settle();
    tabs.second.click();
    expect(tabs.root.value).toBe("renamed");
    expect(tabs.second.getAttribute("aria-controls")).toBe(tabs.secondPanel.id);

    const third = tab("third");
    const thirdPanel = panel("third");
    tabs.list.replaceChild(third, tabs.second);
    tabs.root.replaceChild(thirdPanel, tabs.secondPanel);
    await settle();
    third.click();
    expect(tabs.root.value).toBe("third");
    expect(thirdPanel.hidden).toBe(false);

    third.remove();
    thirdPanel.remove();
    await settle();
    expect(tabs.root.value).toBe("third");
  });

  it("ignores tabs owned by a nested root", async () => {
    const outer = createTabs();
    outer.root.defaultValue = "first";
    const inner = createTabs();
    inner.root.defaultValue = "first";
    outer.firstPanel.append(inner.root);
    connectTabs(outer);
    await settle();

    inner.second.click();

    expect(inner.root.value).toBe("second");
    expect(outer.root.value).toBe("first");
  });

  it("preserves uncontrolled selection and callback behavior across reconnects", async () => {
    const tabs = createTabs();
    tabs.root.defaultValue = "first";
    const changes = vi.fn();
    tabs.root.onValueChange = changes;
    connectTabs(tabs);
    await settle();
    tabs.second.click();

    tabs.root.remove();
    document.body.append(tabs.root);
    await settle();

    expect(tabs.root.value).toBe("second");
    expect(tabs.secondPanel.hidden).toBe(false);
    tabs.first.click();
    expect(changes).toHaveBeenCalledTimes(2);
    expect(changes).toHaveBeenLastCalledWith("first");
  });

  it("decorates author buttons without making meaningful labels or panels unselectable", async () => {
    const tabs = createTabs();
    connectTabs(tabs);
    await settle();

    expect(tabs.first.dataset.testid).toBeTruthy();
    expect(tabs.first.id || tabs.first.className).toBeTruthy();
    expect(tabs.first.style.cursor).toBe("pointer");
    expect(tabs.first.style.userSelect).not.toBe("none");
    expect(tabs.firstPanel.style.userSelect).not.toBe("none");
  });
  it("does not retain delegated listeners when observer setup fails", () => {
    const NativeMutationObserver = MutationObserver;
    let constructions = 0;
    class FailingMutationObserver extends NativeMutationObserver {
      constructor(callback: MutationCallback) {
        super(callback);
        constructions += 1;
        if (constructions === 2) throw new Error("observer setup failed");
      }
    }
    vi.stubGlobal("MutationObserver", FailingMutationObserver);
    const tabs = createTabs();
    const changes = vi.fn();
    tabs.root.onValueChange = changes;

    expect(() => connectTabs(tabs)).toThrow("observer setup failed");
    vi.unstubAllGlobals();
    tabs.second.click();

    expect(changes).not.toHaveBeenCalled();
  });
});

it("retains a constructible root export", () => {
  expect(new BwcTabsElement()).toBeInstanceOf(HTMLElement);
});
