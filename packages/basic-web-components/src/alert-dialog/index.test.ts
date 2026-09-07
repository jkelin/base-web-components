import { afterEach, describe, expect, it, vi } from "vitest";
import { type BwcAlertDialogElement } from "./index";
// Side-effect import: registering `bwc-alert-dialog` happens on module load.
import "./index";
import "../menu/index";
import { type BwcMenuElement } from "../menu/index";

type DialogElement = BwcAlertDialogElement;

function createDialog(options: { defaultOpen?: boolean; open?: boolean; modal?: boolean } = {}) {
  const root = document.createElement("bwc-alert-dialog") as DialogElement;
  root.toggleAttribute("default-open", options.defaultOpen ?? false);
  root.toggleAttribute("open", options.open ?? false);
  if (options.modal === false) root.setAttribute("modal", "false");

  const trigger = document.createElement("button");
  trigger.slot = "trigger";
  trigger.textContent = "Delete";
  const popup = document.createElement("div");
  popup.slot = "popup";
  const title = document.createElement("h2");
  title.setAttribute("data-title", "");
  title.textContent = "Discard draft?";
  const description = document.createElement("p");
  description.setAttribute("data-description", "");
  description.textContent = "You can't undo this action.";
  const cancel = document.createElement("button");
  cancel.setAttribute("data-cancel", "");
  cancel.textContent = "Cancel";
  const action = document.createElement("button");
  action.setAttribute("data-action", "");
  action.textContent = "Discard";
  popup.append(title, description, cancel, action);
  root.append(trigger, popup);

  return { action, cancel, description, popup, root, title, trigger };
}

function backdrop(): HTMLElement | null {
  return document.body.querySelector('[data-testid="bwc-alert-dialog-backdrop"]');
}

afterEach(() => {
  document.body.replaceChildren();
  document.documentElement.style.overflow = "";
});

describe("slot structure", () => {
  it("requires a button trigger and a div popup", () => {
    const root = document.createElement("bwc-alert-dialog");
    const trigger = document.createElement("div");
    trigger.slot = "trigger";
    const popup = document.createElement("div");
    popup.slot = "popup";
    root.append(trigger, popup);

    expect(() => document.body.append(root)).toThrow(TypeError);
  });

  it("wires alertdialog role and title/description ids", () => {
    const { description, popup, root, title, trigger } = createDialog();
    document.body.append(root);

    expect(popup.getAttribute("role")).toBe("alertdialog");
    expect(popup.getAttribute("aria-labelledby")).toBe(title.id);
    expect(popup.getAttribute("aria-describedby")).toBe(description.id);
    expect(trigger.getAttribute("aria-controls")).toBe(popup.id);
    expect(popup.hidden).toBe(true);
  });
});

describe("open flows", () => {
  it("opens from the trigger and closes from cancel", () => {
    const { cancel, popup, root, trigger } = createDialog();
    document.body.append(root);

    trigger.click();
    expect(root.open).toBe(true);
    expect(popup.hidden).toBe(false);
    expect(popup.hasAttribute("data-open")).toBe(true);

    cancel.click();
    expect(root.open).toBe(false);
  });

  it("supports methods and property writes after uncontrolled transitions", () => {
    const { popup, root, trigger } = createDialog();
    document.body.append(root);

    trigger.click();
    root.open = false;
    expect(root.open).toBe(false);
    root.show();
    expect(root.open).toBe(true);
    root.close();
    expect(root.open).toBe(false);
    root.toggle();
    expect(root.open).toBe(true);
    expect(popup.hidden).toBe(false);
    root.toggle(false);
    expect(root.open).toBe(false);
  });

  it("emits open-change for imperative calls", () => {
    const { root } = createDialog();
    document.body.append(root);
    const callback = vi.fn();
    root.onOpenChange = callback;

    root.show();
    root.close();
    expect(callback.mock.calls).toEqual([[true], [false]]);
  });

  it("action closes by default, keeps open with data-keep-open", () => {
    const { action, root } = createDialog();
    document.body.append(root);

    root.show();
    action.click();
    expect(root.open).toBe(false);

    action.setAttribute("data-keep-open", "");
    root.show();
    action.click();
    expect(root.open).toBe(true);
  });
});

describe("modal backdrop and shared scroll-lock", () => {
  it("renders a backdrop and locks document scroll while open", () => {
    const { root, trigger } = createDialog();
    document.body.append(root);

    trigger.click();
    expect(backdrop()).not.toBeNull();
    expect(document.documentElement.style.overflow).toBe("hidden");

    root.close();
    expect(backdrop()).toBeNull();
    expect(document.documentElement.style.overflow).toBe("");
  });

  it("backdrop click requests close", () => {
    const { root, trigger } = createDialog();
    document.body.append(root);

    trigger.click();
    backdrop()?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(root.open).toBe(false);
  });

  it("skips backdrop and lock when modal is false", () => {
    const { root, trigger } = createDialog({ modal: false });
    document.body.append(root);

    trigger.click();
    expect(root.open).toBe(true);
    expect(backdrop()).toBeNull();
    expect(document.documentElement.style.overflow).toBe("");
  });

  it("keeps scroll locked until both a dialog and a menu close", () => {
    const { root } = createDialog();
    document.body.append(root);
    root.show();

    const menu = document.createElement("bwc-menu") as BwcMenuElement;
    const menuTrigger = document.createElement("button");
    menuTrigger.slot = "trigger";
    menuTrigger.textContent = "Menu";
    const menuPopup = document.createElement("div");
    menuPopup.slot = "popup";
    menu.append(menuTrigger, menuPopup);
    document.body.append(menu);
    menuTrigger.click();

    expect(document.documentElement.style.overflow).toBe("hidden");
    root.close();
    // The menu still holds the shared lock.
    expect(document.documentElement.style.overflow).toBe("hidden");
    menu.close();
    expect(document.documentElement.style.overflow).toBe("");
  });
});

describe("focus", () => {
  it("moves focus into the popup on open and returns to the trigger", () => {
    const { popup, root, trigger } = createDialog();
    document.body.append(root);

    root.show();
    expect(document.activeElement).toBe(popup);

    root.close();
    expect(document.activeElement).toBe(trigger);
  });

  it("honors initial-focus and final-focus selectors", () => {
    const { action, root } = createDialog();
    document.body.append(root);
    const elsewhere = document.createElement("button");
    elsewhere.id = "elsewhere";
    elsewhere.className = "final-target";
    document.body.append(elsewhere);
    root.initialFocus = "button[data-action]";
    root.finalFocus = "#elsewhere";

    root.show();
    expect(document.activeElement).toBe(action);

    root.close();
    expect(document.activeElement).toBe(elsewhere);
  });

  it("traps Tab inside the popup", () => {
    const { action, cancel, popup, root } = createDialog();
    document.body.append(root);
    root.show();

    cancel.focus();
    cancel.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", bubbles: true }));
    expect(document.activeElement).toBe(cancel);

    action.focus();
    action.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", bubbles: true }));
    expect(document.activeElement).toBe(popup);
  });

  it("Escape requests close", () => {
    const { popup, root } = createDialog();
    document.body.append(root);
    root.show();

    popup.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(root.open).toBe(false);
  });
});
