import { afterEach, describe, expect, it, vi } from "vitest";
import { type BwcNavigationMenuElement } from "./index";
// Side-effect import: registering `bwc-navigation-menu` happens on module load.
import "./index";

type NavElement = BwcNavigationMenuElement;

function createTrigger(label: string, value: string) {
  const trigger = document.createElement("button");
  trigger.dataset.navTrigger = "";
  trigger.dataset.value = value;
  trigger.textContent = label;
  return trigger;
}

function createPanel(value: string, linkText: string) {
  const panel = document.createElement("div");
  panel.dataset.navPanel = "";
  panel.dataset.value = value;
  const link = document.createElement("a");
  link.href = `#${value}`;
  link.textContent = linkText;
  panel.append(link);
  return { link, panel };
}

function createNav() {
  const root = document.createElement("bwc-navigation-menu") as NavElement;
  const overviewTrigger = createTrigger("Overview", "overview");
  const { link: overviewLink, panel: overviewPanel } = createPanel("overview", "Quick start");
  const handbookTrigger = createTrigger("Handbook", "handbook");
  const { link: handbookLink, panel: handbookPanel } = createPanel("handbook", "Styling");
  root.append(overviewTrigger, overviewPanel, handbookTrigger, handbookPanel);
  return {
    handbookLink,
    handbookPanel,
    handbookTrigger,
    overviewLink,
    overviewPanel,
    overviewTrigger,
    root,
  };
}

afterEach(() => document.body.replaceChildren());

describe("topology", () => {
  it("requires at least one trigger", () => {
    const root = document.createElement("bwc-navigation-menu");
    expect(() => document.body.append(root)).toThrow(TypeError);
  });

  it("rejects triggers without a value and duplicate values", () => {
    const missing = document.createElement("bwc-navigation-menu");
    const trigger = document.createElement("button");
    trigger.dataset.navTrigger = "";
    missing.append(trigger);
    expect(() => document.body.append(missing)).toThrow(TypeError);

    const duplicate = document.createElement("bwc-navigation-menu");
    duplicate.append(createTrigger("A", "same"), createTrigger("B", "same"));
    expect(() => document.body.append(duplicate)).toThrow(TypeError);
  });

  it("rejects panels without a matching trigger", () => {
    const root = document.createElement("bwc-navigation-menu");
    const { panel } = createPanel("orphan", "Lost");
    root.append(createTrigger("Overview", "overview"), panel);
    expect(() => document.body.append(root)).toThrow(TypeError);
  });

  it("exposes navigation role, testids, and region panels", () => {
    const { overviewPanel, overviewTrigger, root } = createNav();
    document.body.append(root);

    expect(root.getAttribute("role")).toBe("navigation");
    expect(root.dataset.testid).toBe("bwc-navigation-menu");
    expect(overviewTrigger.dataset.testid).toBe("bwc-navigation-menu-trigger");
    expect(overviewPanel.dataset.testid).toBe("bwc-navigation-menu-panel");
    expect(overviewPanel.getAttribute("role")).toBe("region");
    expect(overviewPanel.classList).toContain("navigation-menu-panel");
    expect(overviewPanel.hasAttribute("data-floating")).toBe(true);
    expect(overviewTrigger.getAttribute("aria-controls")).toBe(overviewPanel.id);
    expect(overviewPanel.hidden).toBe(true);
  });
});

describe("keyboard navigation", () => {
  it("roves across triggers with arrows and Home/End", () => {
    const { handbookTrigger, overviewTrigger, root } = createNav();
    document.body.append(root);

    overviewTrigger.focus();
    overviewTrigger.dispatchEvent(
      new KeyboardEvent("keydown", { bubbles: true, key: "ArrowRight" }),
    );
    expect(document.activeElement).toBe(handbookTrigger);
    handbookTrigger.dispatchEvent(
      new KeyboardEvent("keydown", { bubbles: true, key: "ArrowRight" }),
    );
    expect(document.activeElement).toBe(overviewTrigger);
    overviewTrigger.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "End" }));
    expect(document.activeElement).toBe(handbookTrigger);
    handbookTrigger.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "Home" }));
    expect(document.activeElement).toBe(overviewTrigger);
  });

  it("opens with Enter, focuses panel content, and closes on Escape", async () => {
    const { overviewLink, overviewPanel, overviewTrigger, root } = createNav();
    document.body.append(root);

    overviewTrigger.focus();
    overviewTrigger.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "Enter" }));
    expect(root.value).toBe("overview");
    expect(overviewPanel.hidden).toBe(false);
    expect(overviewTrigger.getAttribute("aria-expanded")).toBe("true");
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(document.activeElement).toBe(overviewLink);

    overviewPanel.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "Escape" }));
    expect(root.value).toBe("");
    expect(overviewPanel.hidden).toBe(true);
    expect(document.activeElement).toBe(overviewTrigger);
  });

  it("switches panels with arrows while open", () => {
    const { handbookPanel, handbookTrigger, overviewPanel, overviewTrigger, root } = createNav();
    document.body.append(root);

    root.show("overview");
    overviewTrigger.focus();
    overviewTrigger.dispatchEvent(
      new KeyboardEvent("keydown", { bubbles: true, key: "ArrowRight" }),
    );
    expect(document.activeElement).toBe(handbookTrigger);
    expect(root.value).toBe("handbook");
    expect(handbookPanel.hidden).toBe(false);
    expect(overviewPanel.hidden).toBe(true);
  });
});

describe("hover with bridge", () => {
  it("opens after the delay and closes after the close delay", () => {
    vi.useFakeTimers();
    try {
      const { overviewPanel, overviewTrigger, root } = createNav();
      root.setAttribute("delay", "200");
      root.setAttribute("close-delay", "150");
      document.body.append(root);

      overviewTrigger.dispatchEvent(new PointerEvent("pointerenter"));
      expect(root.value).toBe("");
      vi.advanceTimersByTime(200);
      expect(root.value).toBe("overview");
      expect(overviewPanel.hidden).toBe(false);

      overviewTrigger.dispatchEvent(new PointerEvent("pointerleave"));
      vi.advanceTimersByTime(149);
      expect(root.value).toBe("overview");
      vi.advanceTimersByTime(1);
      expect(root.value).toBe("");
    } finally {
      vi.useRealTimers();
    }
  });

  it("keeps the panel open while traveling trigger to panel", () => {
    vi.useFakeTimers();
    try {
      const { overviewPanel, overviewTrigger, root } = createNav();
      root.setAttribute("delay", "20");
      root.setAttribute("close-delay", "150");
      document.body.append(root);

      overviewTrigger.dispatchEvent(new PointerEvent("pointerenter"));
      vi.advanceTimersByTime(20);
      expect(root.value).toBe("overview");

      overviewTrigger.dispatchEvent(new PointerEvent("pointerleave"));
      overviewPanel.dispatchEvent(new PointerEvent("pointerenter"));
      vi.advanceTimersByTime(200);
      expect(root.value).toBe("overview");

      overviewPanel.dispatchEvent(new PointerEvent("pointerleave"));
      vi.advanceTimersByTime(150);
      expect(root.value).toBe("");
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("value state", () => {
  it("shows, closes, and toggles through methods with events", () => {
    const { handbookPanel, overviewPanel, root } = createNav();
    const values: Array<unknown> = [];
    const opens: Array<unknown> = [];
    root.onValueChange = (value) => values.push(value);
    root.onOpenChange = (open) => opens.push(open);
    root.addEventListener("value-change", (event) =>
      values.push((event as CustomEvent).detail.value),
    );
    document.body.append(root);

    root.show("overview");
    expect(root.value).toBe("overview");
    expect(overviewPanel.hidden).toBe(false);

    root.toggle("overview");
    expect(root.value).toBe("");
    root.toggle("handbook");
    expect(root.value).toBe("handbook");
    expect(handbookPanel.hidden).toBe(false);
    root.close();
    expect(root.value).toBe("");

    expect(values).toEqual(["overview", "overview", "", "", "handbook", "handbook", "", ""]);
    expect(opens).toEqual([true, false, true, false]);
  });

  it("rejects empty and unknown panel values", () => {
    const { root } = createNav();
    document.body.append(root);

    expect(() => root.show("")).toThrow(TypeError);
    expect(() => root.show("missing")).toThrow(RangeError);
  });

  it("applies controlled property writes and imperative overrides", () => {
    const seeded = createNav();
    seeded.root.setAttribute("default-value", "overview");
    document.body.append(seeded.root);
    expect(seeded.root.value).toBe("overview");
    expect(seeded.overviewPanel.hidden).toBe(false);
    seeded.root.value = "";
    expect(seeded.root.value).toBe("");
    document.body.replaceChildren();

    const { handbookPanel, root } = createNav();
    root.setAttribute("value", "overview");
    document.body.append(root);
    root.show("handbook");
    expect(root.value).toBe("handbook");
    expect(handbookPanel.hidden).toBe(false);
  });

  it("blocks opens while disabled", () => {
    const { overviewPanel, overviewTrigger, root } = createNav();
    document.body.append(root);

    root.disabled = true;
    overviewTrigger.click();
    root.show("overview");
    expect(root.value).toBe("");
    expect(overviewPanel.hidden).toBe(true);
    expect(root.hasAttribute("data-disabled")).toBe(true);
  });

  it("closes on outside pointerdown and returns focus to the trigger", () => {
    const { overviewPanel, overviewTrigger, root } = createNav();
    document.body.append(root);

    root.show("overview");
    overviewTrigger.focus();
    document.body.dispatchEvent(new Event("pointerdown", { bubbles: true }));
    expect(root.value).toBe("");

    root.show("overview");
    overviewPanel.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "Escape" }));
    expect(root.value).toBe("");
    expect(document.activeElement).toBe(overviewTrigger);
  });
});

describe("animation hooks", () => {
  it("sets data-starting-style on open and clears it next frame", async () => {
    const { overviewPanel, root } = createNav();
    document.body.append(root);

    root.show("overview");
    expect(overviewPanel.hasAttribute("data-starting-style")).toBe(true);
    await new Promise((resolve) => requestAnimationFrame(resolve));
    await new Promise((resolve) => requestAnimationFrame(resolve));
    expect(overviewPanel.hasAttribute("data-starting-style")).toBe(false);
  });

  it("hides synchronously without transitions", () => {
    const { overviewPanel, root } = createNav();
    document.body.append(root);

    root.show("overview");
    root.close();
    expect(overviewPanel.hidden).toBe(true);
    expect(overviewPanel.hasAttribute("data-ending-style")).toBe(false);
  });

  it("defers hide with data-ending-style while a transition is present", () => {
    const { overviewPanel, root } = createNav();
    document.body.append(root);
    overviewPanel.style.transitionDuration = "50ms";

    root.show("overview");
    root.close();
    expect(overviewPanel.hidden).toBe(false);
    expect(overviewPanel.hasAttribute("data-ending-style")).toBe(true);

    overviewPanel.dispatchEvent(new TransitionEvent("transitionend", { bubbles: true }));
    expect(overviewPanel.hidden).toBe(true);
    expect(overviewPanel.hasAttribute("data-ending-style")).toBe(false);
  });
});
