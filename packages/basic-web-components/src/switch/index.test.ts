import { afterEach, describe, expect, it, vi } from "vitest";
import {
  BWC_SWITCH_BUTTON_TEST_ID,
  BWC_SWITCH_INPUT_TEST_ID,
  BWC_SWITCH_THUMB_TEST_ID,
} from "./index";

type SwitchApi = HTMLElement & {
  checked: boolean;
  defaultChecked: boolean;
  disabled: boolean;
  readOnly: boolean;
  required: boolean;
  name: string;
  value: string;
  form: string;
  ariaLabel: string;
  buttonClass: string;
  thumbClass: string;
  inputClass: string;
  onCheckedChange: ((checked: boolean) => void) | null;
};

function mount(attributes = ""): SwitchApi {
  document.body.innerHTML = `<bwc-switch ${attributes}></bwc-switch>`;
  const root = document.querySelector<SwitchApi>("bwc-switch");
  if (!root) throw new Error("switch did not mount");
  return root;
}

function parts(root: HTMLElement) {
  const button = root.querySelector<HTMLButtonElement>(
    `[data-testid="${BWC_SWITCH_BUTTON_TEST_ID}"]`,
  );
  const thumb = root.querySelector<HTMLSpanElement>(`[data-testid="${BWC_SWITCH_THUMB_TEST_ID}"]`);
  const input = root.querySelector<HTMLInputElement>(`[data-testid="${BWC_SWITCH_INPUT_TEST_ID}"]`);
  if (!button || !thumb || !input) throw new Error("switch parts did not render");
  return { button, thumb, input };
}

afterEach(() => document.body.replaceChildren());

describe("switch behavior", () => {
  it("uses a native switch button and toggles uncontrolled state", () => {
    const root = mount('default-checked aria-label="Notifications"');
    const { button, thumb } = parts(root);
    const callback = vi.fn();
    root.onCheckedChange = callback;

    expect(button.type).toBe("button");
    expect(button.getAttribute("role")).toBe("switch");
    expect(button.getAttribute("aria-label")).toBe("Notifications");
    expect(button.getAttribute("aria-checked")).toBe("true");
    expect(root.id).toMatch(/^bwc-switch-/);
    expect(button.id).toBe(`${root.id}-button`);
    expect(button.style.cursor).toBe("pointer");
    expect(thumb.hasAttribute("data-checked")).toBe(true);

    button.click();
    expect(root.checked).toBe(false);
    expect(button.getAttribute("aria-checked")).toBe("false");
    expect(root.hasAttribute("data-unchecked")).toBe(true);
    expect(callback).toHaveBeenCalledWith(false);
  });

  it("keeps controlled state while emitting requested changes", () => {
    const root = mount("checked");
    const callback = vi.fn();
    root.onCheckedChange = callback;

    parts(root).button.click();
    expect(root.checked).toBe(true);
    expect(parts(root).button.getAttribute("aria-checked")).toBe("true");
    expect(callback).toHaveBeenCalledOnce();
    expect(callback).toHaveBeenCalledWith(false);
  });

  it("ignores readonly and disabled activation with correct states and cursors", () => {
    const root = mount("readonly required");
    const callback = vi.fn();
    root.onCheckedChange = callback;
    let { button, thumb } = parts(root);

    button.click();
    expect(root.checked).toBe(false);
    expect(callback).not.toHaveBeenCalled();
    expect(button.disabled).toBe(false);
    expect(button.hasAttribute("data-readonly")).toBe(true);
    expect(thumb.hasAttribute("data-required")).toBe(true);

    root.disabled = true;
    ({ button } = parts(root));
    expect(button.disabled).toBe(true);
    expect(button.style.cursor).toBe("not-allowed");
    expect(button.hasAttribute("data-disabled")).toBe(true);
  });

  it("follows native label activation and reconnects the checkbox listener", () => {
    document.body.innerHTML = "<label>Notifications <bwc-switch></bwc-switch></label>";
    const label = document.querySelector<HTMLLabelElement>("label");
    const root = document.querySelector<SwitchApi>("bwc-switch");
    if (!label || !root) throw new Error("labelled switch did not mount");
    const callback = vi.fn();
    root.onCheckedChange = callback;
    const { button, input, thumb } = parts(root);

    label.click();
    expect(root.checked).toBe(true);
    expect(input.checked).toBe(true);
    expect(button.getAttribute("aria-checked")).toBe("true");
    expect(thumb.hasAttribute("data-checked")).toBe(true);
    expect(callback.mock.calls).toEqual([[true]]);

    root.remove();
    label.append(root);
    input.click();
    expect(root.checked).toBe(false);
    expect(callback.mock.calls).toEqual([[true], [false]]);
  });

  it("activates exactly once through an external label targeting the derived button id", () => {
    document.body.innerHTML =
      '<label for="consumer-switch-button">Choice</label><bwc-switch id="consumer-switch"></bwc-switch>';
    const label = document.querySelector<HTMLLabelElement>("label");
    const root = document.querySelector<SwitchApi>("bwc-switch");
    if (!label || !root) throw new Error("externally labelled switch did not mount");
    const callback = vi.fn();
    root.onCheckedChange = callback;
    const { button, input } = parts(root);

    expect(root.id).toBe("consumer-switch");
    expect(button.id).toBe(`${root.id}-button`);
    label.click();
    expect(root.checked).toBe(true);
    expect(input.checked).toBe(true);
    expect(callback.mock.calls).toEqual([[true]]);
  });
  it("restores controlled and readonly state after native checkbox activation", () => {
    const controlled = mount("checked");
    const controlledCallback = vi.fn();
    controlled.onCheckedChange = controlledCallback;
    parts(controlled).input.click();
    expect(controlled.checked).toBe(true);
    expect(parts(controlled).input.checked).toBe(true);
    expect(controlledCallback).toHaveBeenCalledWith(false);

    document.body.replaceChildren();
    const readOnly = mount("readonly");
    const readOnlyCallback = vi.fn();
    readOnly.onCheckedChange = readOnlyCallback;
    parts(readOnly).input.click();
    expect(readOnly.checked).toBe(false);
    expect(parts(readOnly).input.checked).toBe(false);
    expect(readOnlyCallback).not.toHaveBeenCalled();
  });

  it("uses native checkbox validity and successful-value gating", () => {
    document.body.innerHTML =
      '<form id="settings"><bwc-switch name="alerts" required></bwc-switch></form>';
    const form = document.querySelector<HTMLFormElement>("form");
    const root = document.querySelector<SwitchApi>("bwc-switch");
    if (!form || !root) throw new Error("required switch did not mount");
    const { button, input } = parts(root);

    expect(input.type).toBe("checkbox");
    expect(input.tabIndex).toBe(-1);
    expect(input.value).toBe("on");
    expect(input.checked).toBe(false);
    expect(input.disabled).toBe(false);
    expect(button.getAttribute("aria-required")).toBe("true");
    expect(form.checkValidity()).toBe(false);
    expect([...new FormData(form).entries()]).toEqual([]);

    button.click();
    expect(input.checked).toBe(true);
    expect(form.checkValidity()).toBe(true);
    expect([...new FormData(form).entries()]).toEqual([["alerts", "on"]]);

    root.disabled = true;
    expect(input.disabled).toBe(true);
    expect(form.checkValidity()).toBe(true);
    expect([...new FormData(form).entries()]).toEqual([]);
  });

  it("reactively applies part classes without changing root class or id", () => {
    const root = mount(
      'id="consumer-switch" class="consumer" button-class="button-a" thumb-class="thumb-a" input-class="input-a"',
    );
    let { button, thumb, input } = parts(root);
    expect(root.id).toBe("consumer-switch");
    expect(root.className).toBe("consumer");
    expect(button.id).toBe("consumer-switch-button");
    expect(button.className).toBe("switch-button button-a");
    expect(thumb.className).toBe("switch-thumb thumb-a");
    expect(input.className).toBe("switch-input input-a");

    root.buttonClass = "button-b";
    root.thumbClass = "thumb-b";
    root.inputClass = "input-b";
    ({ button, thumb, input } = parts(root));
    expect(button.className).toBe("switch-button button-b");
    expect(thumb.className).toBe("switch-thumb thumb-b");
    expect(input.className).toBe("switch-input input-b");
  });

  it("preserves an authored generated-button id across reconnects", () => {
    const root = mount('id="consumer-switch"');
    const button = parts(root).button;
    button.id = "authored-label-target";

    root.remove();
    document.body.append(root);
    expect(parts(root).button.id).toBe("authored-label-target");
  });
});
