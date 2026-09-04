import { afterEach, describe, expect, it, vi } from "vitest";
import "../src/index";

const P = "preact";
const settle = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

describe(`${P} component suites`, () => {
  afterEach(() => document.body.replaceChildren());

  it("derives control IDs from author host IDs", async () => {
    document.body.innerHTML = `<${P}-accordion><${P}-accordion-item value="one"><${P}-accordion-trigger id="shipping-trigger">Shipping</${P}-accordion-trigger><${P}-accordion-panel>Panel</${P}-accordion-panel></${P}-accordion-item></${P}-accordion>`;
    await settle();
    expect(document.querySelector(`${P}-accordion-trigger > button`)?.id).toBe(
      "shipping-trigger-button",
    );
  });

  it("coordinates accordion and tabs with accessible state", async () => {
    document.body.innerHTML = `<${P}-accordion><${P}-accordion-item value="a"><${P}-accordion-trigger>One</${P}-accordion-trigger><${P}-accordion-panel>Panel</${P}-accordion-panel></${P}-accordion-item></${P}-accordion><${P}-tabs><${P}-tabs-list><${P}-tab value="a">A</${P}-tab><${P}-tab value="b">B</${P}-tab></${P}-tabs-list><${P}-tab-panel value="a">Alpha</${P}-tab-panel><${P}-tab-panel value="b">Beta</${P}-tab-panel></${P}-tabs>`;
    await settle();
    const accordion = document.querySelector(`${P}-accordion`)!;
    const trigger = accordion.querySelector("button") as HTMLButtonElement;
    const panel = accordion.querySelector(`${P}-accordion-panel`)!;
    expect(panel.hasAttribute("hidden")).toBe(true);
    trigger.click();
    expect(panel.hasAttribute("hidden")).toBe(false);
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    const tabs = document.querySelector(`${P}-tabs`)!;
    const buttons = tabs.querySelectorAll("button");
    expect(buttons[0]?.getAttribute("aria-selected")).toBe("true");
    (buttons[1] as HTMLButtonElement).click();
    expect(buttons[1]?.getAttribute("aria-selected")).toBe("true");
  });

  it("keeps controlled open and checked values authoritative", async () => {
    document.body.innerHTML = `<${P}-modal open><${P}-modal-trigger>Open</${P}-modal-trigger><${P}-modal-popup>Body<${P}-modal-close>Close</${P}-modal-close></${P}-modal-popup></${P}-modal><${P}-toggle-checkbox checked aria-label="Choice"></${P}-toggle-checkbox>`;
    await settle();
    const modal = document.querySelector(`${P}-modal`)!;
    const openEvent = vi.fn();
    modal.addEventListener("open-change", openEvent);
    (modal.querySelector(`${P}-modal-close button`) as HTMLButtonElement).click();
    expect(openEvent).toHaveBeenCalledWith(expect.objectContaining({ detail: { open: false } }));
    expect(modal.hasAttribute("data-open")).toBe(true);
    const toggle = document.querySelector(`${P}-toggle-checkbox`)!;
    const checkedEvent = vi.fn();
    toggle.addEventListener("checked-change", checkedEvent);
    (toggle.querySelector("input") as HTMLInputElement).click();
    expect(checkedEvent).toHaveBeenCalledWith(
      expect.objectContaining({ detail: { checked: false } }),
    );
    expect((toggle.querySelector("input") as HTMLInputElement).checked).toBe(true);
  });

  it("filters OTP input and publishes completion", async () => {
    document.body.innerHTML = `<${P}-otp-field length="4" validation-type="numeric" name="code"></${P}-otp-field>`;
    await settle();
    const otp = document.querySelector(`${P}-otp-field`)!;
    const complete = vi.fn();
    otp.addEventListener("value-complete", complete);
    const fields = otp.querySelectorAll<HTMLInputElement>('input:not([type="hidden"])');
    fields[0]!.value = "12x34";
    fields[0]!.dispatchEvent(new InputEvent("input", { bubbles: true }));
    expect(complete).toHaveBeenCalledWith(expect.objectContaining({ detail: { value: "1234" } }));
    expect((otp.querySelector('input[type="hidden"]') as HTMLInputElement).value).toBe("1234");
    expect(otp.hasAttribute("data-complete")).toBe(true);
  });

  it("opens popover and exposes geometry state", async () => {
    document.body.innerHTML = `<${P}-popover side="right" side-offset="8"><${P}-popover-trigger>Open</${P}-popover-trigger><${P}-popover-popup>Body</${P}-popover-popup></${P}-popover>`;
    await settle();
    const root = document.querySelector(`${P}-popover`)!;
    (root.querySelector("button") as HTMLButtonElement).click();
    const popup = root.querySelector(`${P}-popover-popup`) as HTMLElement;
    expect(popup.getAttribute("data-side")).toBe("right");
    expect(popup.style.getPropertyValue("--popover-anchor-x")).toMatch(/px$/);
    expect(popup.getAttribute("role")).toBe("dialog");
  });
});
