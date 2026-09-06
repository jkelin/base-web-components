// @ts-ignore: bun:test types ship with the Bun runtime, not as a workspace package.
import { describe, expect, it } from "bun:test";
import { COMPONENTS, stripExampleAttributes } from "./site.ts";

describe("stripExampleAttributes", () => {
  it("strips id, data-testid, and class but keeps behavior attributes", () => {
    const input =
      `<bwc-counter id="demo-counter" data-testid="demo-counter" default-value="3" class="flex gap-3">` +
      `<button slot="decrement" id="x" data-testid="y" class="btn">−</button></bwc-counter>`;
    expect(stripExampleAttributes(input)).toBe(
      `<bwc-counter default-value="3"><button slot="decrement">−</button></bwc-counter>`,
    );
  });

  it("handles single-quoted values", () => {
    expect(
      stripExampleAttributes(`<bwc-accordion default-value='["two"]' class='grid gap-2'>`),
    ).toBe(`<bwc-accordion default-value='["two"]'>`);
  });

  it("strips *-class part attributes in every quote style", () => {
    expect(
      stripExampleAttributes(`<bwc-switch button-class="h-7 w-12" thumb-class="size-5">`),
    ).toBe(`<bwc-switch>`);
    expect(stripExampleAttributes(`<bwc-switch thumb-class='size-5' field-class='x'>`)).toBe(
      `<bwc-switch>`,
    );
    expect(stripExampleAttributes(`<bwc-switch thumb-class=size-5 input-class=x>`)).toBe(
      `<bwc-switch>`,
    );
  });

  it("keeps for, side, side-offset, and substring traps", () => {
    const input =
      `<div classy="wrap" myclass="x"><label for="demo-switch-button">N</label>` +
      `<bwc-switch id="s" side="left" class="flex">` +
      `</bwc-switch><bwc-popover side="bottom" side-offset="4" declass="x"></bwc-popover></div>`;
    expect(stripExampleAttributes(input)).toBe(
      `<div classy="wrap" myclass="x"><label for="demo-switch-button">N</label>` +
        `<bwc-switch side="left">` +
        `</bwc-switch><bwc-popover side="bottom" side-offset="4" declass="x"></bwc-popover></div>`,
    );
  });

  it("leaves attribute-free elements and whitespace intact", () => {
    expect(stripExampleAttributes(`<span>Popover content</span>`)).toBe(
      `<span>Popover content</span>`,
    );
  });

  it("strips every demo without touching the live markup", () => {
    for (const component of COMPONENTS) {
      const stripped = stripExampleAttributes(component.demo);
      expect(stripped).not.toContain("data-testid=");
      expect(stripped).not.toMatch(/\sclass="/);
      expect(stripped).not.toMatch(/\sid="/);
      expect(stripped).not.toMatch(/\s[A-Za-z0-9_-]+-class=/);
      // Live demo keeps its hooks; only the displayed source is stripped.
      expect(component.demo).toContain(`id="demo-${component.slug}"`);
      expect(stripped).toContain(`<${component.tag}`);
    }
  });
});
