import { afterEach, describe, expect, it, vi } from "vitest";
import "../src/index";

const prefix = "atomico";
const tag = (name: string) => `${prefix}-${name}`;

function mount(markup: string): HTMLElement {
  document.body.innerHTML = markup;
  const element = document.body.firstElementChild;
  if (!(element instanceof HTMLElement)) throw new Error("component did not mount");
  return element;
}

afterEach(() => document.body.replaceChildren());

describe("component suites", () => {
  it("coordinates an uncontrolled and controlled accordion", async () => {
    const root = mount(
      `<${tag("accordion")}><${tag("accordion-item")} value="a"><${tag("accordion-trigger")}>A</${tag("accordion-trigger")}><${tag("accordion-panel")}>Panel A</${tag("accordion-panel")}></${tag("accordion-item")}><${tag("accordion-item")} value="b"><${tag("accordion-trigger")}>B</${tag("accordion-trigger")}><${tag("accordion-panel")}>Panel B</${tag("accordion-panel")}></${tag("accordion-item")}></${tag("accordion")}>`,
    ) as HTMLElement & { value: string[]; onValueChange: (value: string[]) => void };
    await Promise.resolve();
    const buttons = root.querySelectorAll<HTMLButtonElement>("button");
    const panels = root.querySelectorAll<HTMLElement>(tag("accordion-panel"));
    expect(root.shadowRoot).toBeNull();
    expect(buttons[0]?.dataset.testid).toBe(tag("accordion-trigger"));
    expect(buttons[0]?.textContent).toBe("A");
    expect(panels[0]?.hidden).toBe(true);
    buttons[0]?.click();
    expect(panels[0]?.hidden).toBe(false);
    const callback = vi.fn();
    root.onValueChange = callback;
    root.value = ["a"];
    buttons[1]?.click();
    expect(callback).toHaveBeenCalledWith(["b"]);
    expect(panels[0]?.hidden).toBe(false);
  });

  it("opens and closes modal and popover controls", async () => {
    const modal = mount(
      `<${tag("modal")}><${tag("modal-trigger")}>Open</${tag("modal-trigger")}><${tag("modal-popup")} aria-label="Dialog">Body <${tag("modal-close")}>Close</${tag("modal-close")}></${tag("modal-popup")}></${tag("modal")}>`,
    );
    await Promise.resolve();
    modal.querySelector<HTMLButtonElement>(`${tag("modal-trigger")} > button`)?.click();
    expect(modal.querySelector("dialog")?.open).toBe(true);
    modal.querySelector<HTMLButtonElement>(`${tag("modal-close")} > button`)?.click();
    expect(modal.querySelector("dialog")?.open).toBe(false);

    const popover = mount(
      `<${tag("popover")} side="right" side-offset="4"><${tag("popover-trigger")}>Open</${tag("popover-trigger")}><${tag("popover-popup")}>Body <${tag("popover-close")}>Close</${tag("popover-close")}></${tag("popover-popup")}></${tag("popover")}>`,
    );
    await Promise.resolve();
    const trigger = popover.querySelector<HTMLButtonElement>("button");
    trigger?.click();
    expect(trigger?.getAttribute("aria-expanded")).toBe("true");
    expect(popover.querySelector(tag("popover-popup"))?.getAttribute("data-side")).toBe("right");
  });

  it("supports native checkbox state and controlled restoration", () => {
    const checkbox = mount(
      `<${tag("toggle-checkbox")} default-checked name="choice"></${tag("toggle-checkbox")}>`,
    ) as HTMLElement & { checked: boolean; onCheckedChange: (value: boolean) => void };
    const input = checkbox.querySelector<HTMLInputElement>("input")!;
    expect(input.checked).toBe(true);
    expect(input.name).toBe("choice");
    checkbox.checked = true;
    const callback = vi.fn();
    checkbox.onCheckedChange = callback;
    input.click();
    expect(callback).toHaveBeenCalledWith(false);
    expect(input.checked).toBe(true);
  });

  it("filters OTP input, distributes paste, and emits completion", () => {
    const otp = mount(
      `<${tag("otp-field")} length="4" name="code"></${tag("otp-field")}>`,
    ) as HTMLElement & { value: string; onValueComplete: (value: string) => void };
    const complete = vi.fn();
    otp.onValueComplete = complete;
    const inputs = otp.querySelectorAll<HTMLInputElement>('input:not([type="hidden"])');
    inputs[0]!.dispatchEvent(
      new ClipboardEvent("paste", { bubbles: true, clipboardData: new DataTransfer() }),
    );
    const data = new DataTransfer();
    data.setData("text", "1a23-4");
    inputs[0]!.dispatchEvent(new ClipboardEvent("paste", { bubbles: true, clipboardData: data }));
    expect(otp.value).toBe("1234");
    expect(complete).toHaveBeenCalledWith("1234");
    expect(otp.querySelector<HTMLInputElement>('input[type="hidden"]')?.value).toBe("1234");
  });

  it("implements tabs selection and roving keyboard focus", async () => {
    const tabs = mount(
      `<${tag("tabs")}><${tag("tabs-list")}><${tag("tab")} value="a">A</${tag("tab")}><${tag("tab")} value="b">B</${tag("tab")}></${tag("tabs-list")}><${tag("tab-panel")} value="a">Panel A</${tag("tab-panel")}><${tag("tab-panel")} value="b">Panel B</${tag("tab-panel")}></${tag("tabs")}>`,
    );
    await Promise.resolve();
    const buttons = tabs.querySelectorAll<HTMLButtonElement>("button");
    const panels = tabs.querySelectorAll<HTMLElement>(tag("tab-panel"));
    expect(buttons[0]?.getAttribute("aria-selected")).toBe("true");
    expect(panels[1]?.hidden).toBe(true);
    buttons[1]?.click();
    expect(panels[1]?.hidden).toBe(false);
    buttons[1]?.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
    expect(document.activeElement).toBe(buttons[0]);
  });

  it("rejects invalid values clearly", () => {
    expect(() => mount(`<${tag("otp-field")} length="0"></${tag("otp-field")}>`)).toThrow(
      /positive integer/,
    );
    expect(() => mount(`<${tag("popover")} side="diagonal"></${tag("popover")}>`)).toThrow(
      /side must be one of/,
    );
  });
});
