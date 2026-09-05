import { afterEach, describe, expect, it, vi } from "vitest";
import {
  BWC_TAB_PANEL_TAG,
  BWC_TAB_TAG,
  BWC_TABS_LIST_TAG,
  BWC_TABS_TAG,
  BwcTabsElement,
} from "./index";

type TabsApi = HTMLElement & {
  activationMode: "automatic" | "manual";
  defaultValue: string;
  disabled: boolean;
  onValueChange: ((value: string) => void) | null;
  value: string;
};
type TabApi = HTMLButtonElement & { value: string };
type PanelApi = HTMLElement & { value: string };
type TabsFixture = {
  root: TabsApi;
  list: HTMLElement;
  first: TabApi;
  second: TabApi;
  firstPanel: PanelApi;
  secondPanel: PanelApi;
};

const TabConstructor = customElements.get(BWC_TAB_TAG) as { new (): TabApi };

function createTab(): TabApi {
  const tab = new TabConstructor();
  tab.setAttribute("is", BWC_TAB_TAG);
  return tab;
}

function createTabs(): TabsFixture {
  const root = document.createElement(BWC_TABS_TAG) as TabsApi;
  const list = document.createElement(BWC_TABS_LIST_TAG);
  const first = createTab();
  const second = createTab();
  const firstPanel = document.createElement(BWC_TAB_PANEL_TAG) as PanelApi;
  const secondPanel = document.createElement(BWC_TAB_PANEL_TAG) as PanelApi;
  first.value = "first";
  second.value = "second";
  firstPanel.value = "first";
  secondPanel.value = "second";
  list.append(first, second);
  return { root, list, first, second, firstPanel, secondPanel };
}

const customizedBuiltInProbe = createTabs();
connectTabs(customizedBuiltInProbe);
const supportsCustomizedBuiltIns = customizedBuiltInProbe.first.getAttribute("role") === "tab";
customizedBuiltInProbe.root.remove();
// Children own their DOM synchronization; the root only coordinates registered records.
function connectTabs(tabs: TabsFixture): void {
  document.body.append(tabs.root);
  tabs.root.append(tabs.list, tabs.firstPanel, tabs.secondPanel);
}
describe.runIf(supportsCustomizedBuiltIns)("tabs context registration", () => {
  afterEach(() => {
    document.body.replaceChildren();
  });

  it("configures registered children without querying or iterating the child DOM", () => {
    const tabs = createTabs();
    tabs.root.defaultValue = "second";
    tabs.root.querySelectorAll = () => {
      throw new Error("tabs root must not query children");
    };
    connectTabs(tabs);

    expect(tabs.list.getAttribute("role")).toBe("tablist");
    expect(tabs.first.getAttribute("aria-selected")).toBe("false");
    expect(tabs.first.tabIndex).toBe(-1);
    expect(tabs.second.getAttribute("aria-selected")).toBe("true");
    expect(tabs.second.tabIndex).toBe(0);
    expect(tabs.firstPanel.hidden).toBe(true);
    expect(tabs.secondPanel.hidden).toBe(false);
    expect(tabs.second.getAttribute("aria-controls")).toBe(tabs.secondPanel.id);
    expect(tabs.secondPanel.getAttribute("aria-labelledby")).toBe(tabs.second.id);
  });

  it("registers dynamic children, unregisters on disconnect, and reconnects cleanly", () => {
    const tabs = createTabs();
    connectTabs(tabs);

    const third = createTab();
    const thirdPanel = document.createElement(BWC_TAB_PANEL_TAG) as PanelApi;
    third.value = "third";
    thirdPanel.value = "third";
    tabs.list.append(third);
    tabs.root.append(thirdPanel);
    third.click();
    expect(tabs.root.value).toBe("third");
    expect(thirdPanel.hidden).toBe(false);

    third.remove();
    thirdPanel.remove();
    tabs.list.append(third);
    tabs.root.append(thirdPanel);
    third.click();
    expect(tabs.root.value).toBe("third");
    expect(third.getAttribute("data-active")).toBe("");

    third.remove();
    thirdPanel.remove();
    tabs.second.click();
    expect(tabs.root.value).toBe("second");
    expect(tabs.secondPanel.hidden).toBe(false);
  });

  it("preserves uncontrolled selection and callback state when the root reconnects", () => {
    const tabs = createTabs();
    const third = createTab();
    const thirdPanel = document.createElement(BWC_TAB_PANEL_TAG) as PanelApi;
    const callback = vi.fn();
    tabs.first.value = "one";
    tabs.second.value = "two";
    tabs.firstPanel.value = "one";
    tabs.secondPanel.value = "two";
    third.value = "three";
    thirdPanel.value = "three";
    tabs.list.append(third);
    tabs.root.defaultValue = "one";
    tabs.root.onValueChange = callback;
    connectTabs(tabs);
    tabs.root.append(thirdPanel);
    third.click();
    expect(tabs.root.value).toBe("three");
    const stateBefore = (tabs.root as TabsApi & { context: () => { value: unknown } }).context();

    tabs.root.remove();
    document.body.append(tabs.root);

    const stateAfter = (tabs.root as TabsApi & { context: () => { value: unknown } }).context();
    expect(stateAfter).toBe(stateBefore);
    expect(stateAfter.value).toBe(stateBefore.value);
    expect(tabs.root.value).toBe("three");
    expect(tabs.root.onValueChange).toBe(callback);
    expect(third.getAttribute("aria-selected")).toBe("true");
    expect(thirdPanel.hidden).toBe(false);
    tabs.second.click();
    expect(callback).toHaveBeenCalledTimes(2);
    expect(callback).toHaveBeenLastCalledWith("two");
  });

  it("reactively synchronizes orientation, disabled state, values, and keyboard selection", () => {
    const tabs = createTabs();
    connectTabs(tabs);

    tabs.root.activationMode = "manual";
    tabs.root.setAttribute("orientation", "vertical");
    tabs.root.disabled = true;
    expect(tabs.list.getAttribute("aria-orientation")).toBe("vertical");
    expect(tabs.first.disabled).toBe(true);
    expect(tabs.first.style.cursor).toBe("not-allowed");

    tabs.root.disabled = false;
    tabs.second.focus();
    tabs.second.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "Enter" }));
    expect(tabs.root.value).toBe("second");

    tabs.second.value = "renamed";
    tabs.secondPanel.value = "renamed";
    expect(tabs.second.getAttribute("aria-controls")).toBe(tabs.secondPanel.id);
    expect(tabs.secondPanel.getAttribute("aria-labelledby")).toBe(tabs.second.id);
  });

  it("fails fast for duplicate or empty registered values", () => {
    const duplicate = createTabs();
    duplicate.second.value = "first";
    expect(() => connectTabs(duplicate)).toThrow(/unique and nonempty/);

    document.body.replaceChildren();
    const empty = createTabs();
    empty.firstPanel = document.createElement(BWC_TAB_PANEL_TAG) as PanelApi;
    expect(() => connectTabs(empty)).toThrow(/nonempty/);
  });
});

describe("tabs public tags", () => {
  it("registers flat tab and tab-panel names", () => {
    expect(BWC_TAB_TAG).toBe("bwc-tab");
    expect(BWC_TAB_PANEL_TAG).toBe("bwc-tab-panel");
    expect(customElements.get(BWC_TAB_TAG)).toBeDefined();
    expect(customElements.get(BWC_TAB_PANEL_TAG)).toBeDefined();
    expect(customElements.get("bwc-tabs-tab")).toBeUndefined();
    expect(customElements.get("bwc-tabs-panel")).toBeUndefined();
  });
});

it("resets a removed controlled value without reapplying the default", () => {
  const root = new BwcTabsElement() as HTMLElement & { value: string };
  root.setAttribute("default-value", "one");
  document.body.append(root);
  const TabConstructor = customElements.get(BWC_TAB_TAG) as { new (): HTMLButtonElement };
  const tab = new TabConstructor();
  tab.setAttribute("is", BWC_TAB_TAG);
  tab.setAttribute("value", "one");
  const list = document.createElement(BWC_TABS_LIST_TAG);
  const panel = document.createElement(BWC_TAB_PANEL_TAG);
  panel.setAttribute("value", "one");
  list.append(tab);
  root.append(list, panel);
  expect(root.value).toBe("one");
  root.setAttribute("value", "two");
  expect(root.value).toBe("two");
  root.removeAttribute("value");
  expect(root.value).toBe("");
});
