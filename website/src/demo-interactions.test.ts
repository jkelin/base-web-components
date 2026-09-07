// Live-demo interaction coverage: every website demo except tooltip (owned by
// a sibling) opens through its trigger and through its JS controls, and the
// COMPONENTS readout wiring observes the real events. Runtime behavior runs
// against the built package bundles; static markup contracts live in
// site.test.ts ("demo controls").
// @ts-ignore: bun:test types ship with the Bun runtime, not as a workspace package.
import { afterEach, describe, expect, it } from "bun:test";
import { Window } from "happy-dom";
import { COMPONENTS } from "./site.ts";
import type { ComponentPage } from "./site.ts";

const window = new Window({ url: "http://localhost/" });
const globals = globalThis as unknown as Record<string, unknown>;
const scope = window as unknown as Record<string, unknown>;
// Mirror the DOM into the Node global scope (bun has no DOM): only fill
// gaps so Node natives (URL, Response, …) keep precedence.
for (const key of Object.getOwnPropertyNames(scope)) {
  if (!(key in globals)) {
    try {
      globals[key] = scope[key];
    } catch {
      // Read-only globals (e.g. `undefined`) stay untouched.
    }
  }
}

// The dist bundles read DOM globals at evaluation time, so they must load
// after the happy-dom mirror above — static imports (hoisted above it) fail
// with `HTMLElement is not defined`.
// Event classes must be happy-dom's: its dispatchEvent rejects cross-realm
// (bun-native) events, and the components construct events at dispatch time
// and instanceof-check the ones tests dispatch.
globals["Event"] = scope["Event"];
globals["CustomEvent"] = scope["CustomEvent"];
globals["MouseEvent"] = scope["MouseEvent"];
globals["KeyboardEvent"] = scope["KeyboardEvent"];
globals["FocusEvent"] = scope["FocusEvent"];
globals["PointerEvent"] = scope["PointerEvent"];
// @ts-ignore: dist bundles ship no type declarations.
await import("../../packages/basic-web-components/dist/accordion.js");
// @ts-ignore: dist bundles ship no type declarations.
await import("../../packages/basic-web-components/dist/modal.js");
// @ts-ignore: dist bundles ship no type declarations.
await import("../../packages/basic-web-components/dist/popover.js");
// @ts-ignore: dist bundles ship no type declarations.
await import("../../packages/basic-web-components/dist/preview-card.js");
// @ts-ignore: dist bundles ship no type declarations.
await import("../../packages/basic-web-components/dist/menu.js");
// @ts-ignore: dist bundles ship no type declarations.
await import("../../packages/basic-web-components/dist/context-menu.js");
// @ts-ignore: dist bundles ship no type declarations.
await import("../../packages/basic-web-components/dist/select.js");
// @ts-ignore: dist bundles ship no type declarations.
await import("../../packages/basic-web-components/dist/switch.js");
// @ts-ignore: dist bundles ship no type declarations.
await import("../../packages/basic-web-components/dist/otp.js");
// @ts-ignore: dist bundles ship no type declarations.
await import("../../packages/basic-web-components/dist/tabs.js");
// @ts-ignore: dist bundles ship no type declarations.
await import("../../packages/basic-web-components/dist/slide-out.js");
// @ts-ignore: dist bundles ship no type declarations.
await import("../../packages/basic-web-components/dist/alert-dialog.js");
// @ts-ignore: dist bundles ship no type declarations.
await import("../../packages/basic-web-components/dist/toast.js");
// @ts-ignore: dist bundles ship no type declarations.
await import("../../packages/basic-web-components/dist/menubar.js");
// @ts-ignore: dist bundles ship no type declarations.
await import("../../packages/basic-web-components/dist/navigation-menu.js");

interface Openable {
  open: boolean;
}

interface Imperative {
  show(): void;
  close(): void;
  toggle(force?: boolean): void;
}

async function settle(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

function entryFor(slug: string): ComponentPage {
  const entry = COMPONENTS.find((component) => component.slug === slug);
  if (!entry) throw new Error(`no COMPONENTS entry for slug "${slug}"`);
  return entry;
}

function mountDemo(slug: string): HTMLElement {
  const holder = document.createElement("div");
  // Parse detached: happy-dom fires connectedCallback while parsing attached
  // markup, so the component would validate half-built slots.
  holder.innerHTML = entryFor(slug).demo;
  document.body.append(holder);
  const host = document.getElementById(`demo-${slug}`);
  if (!host) throw new Error(`demo-${slug} missing after mount`);
  return host as HTMLElement;
}

function byId(id: string): HTMLElement {
  const found = document.getElementById(id);
  if (!found) throw new Error(`missing #${id}`);
  return found as HTMLElement;
}

/** Capture runtime events even when the page intentionally omits its readout island. */
function formatObserved(entry: ComponentPage, value: unknown): string {
  return (
    entry.formatReadout?.(value) ??
    (value === "" ? "—" : typeof value === "boolean" ? (value ? "open" : "closed") : String(value))
  );
}

function watchReadout(host: HTMLElement, entry: ComponentPage): Array<unknown> {
  const seen: Array<unknown> = [];
  const eventName =
    entry.readoutEvent ?? (entry.slug === "navigation-menu" ? "value-change" : "open-change");
  const readoutKey = entry.readoutKey ?? (entry.slug === "navigation-menu" ? "value" : "open");
  host.addEventListener(eventName, (event: Event) => {
    if (event instanceof CustomEvent) seen.push(event.detail?.[readoutKey]);
  });
  return seen;
}
describe("component registration", () => {
  it("defines every covered COMPONENTS demo tag after client-load imports", () => {
    // Tooltip is owned by a sibling and excluded from this file's imports.
    for (const component of COMPONENTS.filter((entry) => entry.slug !== "tooltip")) {
      expect(customElements.get(component.tag)).toBeDefined();
    }
  });
});

afterEach(() => {
  document.body.replaceChildren();
});

describe("accordion demo", () => {
  it("opens through summary clicks and reports the value", async () => {
    const entry = entryFor("accordion");
    const host = mountDemo("accordion") as HTMLElement & { value: Array<string> };
    const seen = watchReadout(host, entry);
    await settle();
    expect(host.value).toEqual(["two"]);
    expect((byId("demo-accordion-two") as HTMLDetailsElement).open).toBe(true);

    byId("demo-accordion-one-trigger").click();
    await settle();
    expect(host.value).toEqual(["one"]);
    expect((byId("demo-accordion-one") as HTMLDetailsElement).open).toBe(true);
    expect((byId("demo-accordion-two") as HTMLDetailsElement).open).toBe(false);
    expect(seen.at(-1)).toEqual(["one"]);
    expect(formatObserved(entry, seen.at(-1))).toBe("one");
  });
});

describe("modal demo", () => {
  it("opens through the trigger, the open property, and reports state", async () => {
    const entry = entryFor("modal");
    const host = mountDemo("modal") as HTMLElement & Openable;
    const seen = watchReadout(host, entry);
    const popup = byId("demo-modal-popup") as HTMLDialogElement;
    await settle();
    expect(host.open).toBe(false);

    byId("demo-modal-trigger").click();
    await settle();
    expect(host.open).toBe(true);
    expect(popup.open).toBe(true);

    byId("demo-modal-close").click();
    await settle();
    expect(host.open).toBe(false);

    host.open = true;
    await settle();
    expect(popup.open).toBe(true);
    host.open = false;
    await settle();
    expect(host.open).toBe(false);
    expect(seen).toContain(true);
    expect(seen.at(-1)).toBe(false);
    expect(formatObserved(entry, seen.at(-1))).toBe("closed");
  });
});

describe("popover demo", () => {
  it("opens through the trigger and show()/close()/toggle()", async () => {
    const entry = entryFor("popover");
    const host = mountDemo("popover") as HTMLElement & Openable & Imperative;
    const seen = watchReadout(host, entry);
    await settle();

    byId("demo-popover-trigger").click();
    await settle();
    expect(host.open).toBe(true);

    host.close();
    await settle();
    expect(host.open).toBe(false);

    host.show();
    await settle();
    expect(host.open).toBe(true);

    host.toggle();
    await settle();
    expect(host.open).toBe(false);

    byId("demo-popover-trigger").click();
    await settle();
    byId("demo-popover-close").click();
    await settle();
    expect(host.open).toBe(false);
    expect(seen).toContain(true);
    expect(formatObserved(entry, seen.at(-1))).toBe("closed");
  });
});

describe("preview-card demo", () => {
  it("opens on hover and through show()/close()/toggle()", async () => {
    const entry = entryFor("preview-card");
    const host = mountDemo("preview-card") as HTMLElement &
      Openable &
      Imperative & { delay: number; closeDelay: number };
    const seen = watchReadout(host, entry);
    // Zero delays keep the hover path synchronous; the shipped demo keeps its
    // 300/150ms delays for real pointers.
    host.delay = 0;
    host.closeDelay = 0;
    await settle();

    byId("demo-preview-card-trigger").dispatchEvent(new Event("pointerenter"));
    await settle();
    expect(host.open).toBe(true);

    host.close();
    await settle();
    expect(host.open).toBe(false);

    host.show();
    await settle();
    expect(host.open).toBe(true);

    host.toggle();
    await settle();
    expect(host.open).toBe(false);
    expect(seen).toContain(true);
    expect(formatObserved(entry, seen.at(-1))).toBe("closed");
  });
});

describe("menu demo", () => {
  it("opens through the trigger and show()/close()/toggle()", async () => {
    const entry = entryFor("menu");
    const host = mountDemo("menu") as HTMLElement & Openable & Imperative;
    const seen = watchReadout(host, entry);
    await settle();

    byId("demo-menu-trigger").click();
    await settle();
    expect(host.open).toBe(true);

    byId("demo-menu-edit").click();
    await settle();
    expect(host.open).toBe(false);

    host.show();
    await settle();
    expect(host.open).toBe(true);

    host.toggle();
    await settle();
    expect(host.open).toBe(false);

    host.toggle(true);
    await settle();
    expect(host.open).toBe(true);
    expect(seen).toContain(true);
    expect(formatObserved(entry, seen.at(-1))).toBe("open");
  });
});

describe("context-menu demo", () => {
  it("opens on right-click and through show()/close()/toggle()", async () => {
    const entry = entryFor("context-menu");
    const host = mountDemo("context-menu") as HTMLElement & Openable & Imperative;
    const seen = watchReadout(host, entry);
    await settle();

    byId("demo-context-menu-trigger").dispatchEvent(
      new MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: 50, clientY: 60 }),
    );
    await settle();
    expect(host.open).toBe(true);

    host.close();
    await settle();
    expect(host.open).toBe(false);

    host.show();
    await settle();
    expect(host.open).toBe(true);

    host.toggle();
    await settle();
    expect(host.open).toBe(false);
    expect(seen).toContain(true);
    expect(formatObserved(entry, seen.at(-1))).toBe("closed");
  });
});

describe("select demo", () => {
  it("opens through the trigger, picks an option, and reports the value", async () => {
    const entry = entryFor("select");
    const host = mountDemo("select") as HTMLElement & Openable & Imperative & { value: string };
    const seen = watchReadout(host, entry);
    await settle();

    byId("demo-select-trigger").click();
    await settle();
    expect(host.open).toBe(true);

    host.close();
    await settle();
    expect(host.open).toBe(false);

    host.show();
    await settle();
    byId("demo-select-apple").click();
    await settle();
    expect(host.value).toBe("apple");
    expect(seen.at(-1)).toBe("apple");
    expect(formatObserved(entry, seen.at(-1))).toBe("apple");
  });
});

describe("switch demo", () => {
  it("toggles through clicks and reports on/off", async () => {
    const entry = entryFor("switch");
    const host = mountDemo("switch") as HTMLElement & { checked: boolean };
    const seen = watchReadout(host, entry);
    const control = host.querySelector("button");
    if (!control) throw new Error("switch renders no control button");
    await settle();
    expect(host.checked).toBe(true);

    control.click();
    await settle();
    expect(host.checked).toBe(false);
    expect(seen.at(-1)).toBe(false);
    expect(formatObserved(entry, seen.at(-1))).toBe("off");

    control.click();
    await settle();
    expect(host.checked).toBe(true);
    expect(formatObserved(entry, seen.at(-1))).toBe("on");
  });
});

describe("otp demo", () => {
  it("commits typed digits and reports the value", async () => {
    const entry = entryFor("otp");
    const host = mountDemo("otp") as HTMLElement & { value: string };
    const seen = watchReadout(host, entry);
    const first = host.querySelector("input");
    if (!first) throw new Error("otp renders no fields");
    await settle();

    first.value = "1";
    first.dispatchEvent(new Event("input", { bubbles: true }));
    await settle();
    expect(host.value).toBe("1");
    expect(seen.at(-1)).toBe("1");
    expect(formatObserved(entry, seen.at(-1))).toBe("1");
  });
});

describe("tabs demo", () => {
  it("switches through tab clicks and reports the value", async () => {
    const entry = entryFor("tabs");
    const host = mountDemo("tabs") as HTMLElement & { value: string };
    const seen = watchReadout(host, entry);
    await settle();
    expect(host.value).toBe("one");

    byId("demo-tab-two").click();
    await settle();
    expect(host.value).toBe("two");
    expect(byId("demo-tab-panel-two").hidden).toBe(false);
    expect(byId("demo-tab-panel-one").hidden).toBe(true);
    expect(seen.at(-1)).toBe("two");
    expect(formatObserved(entry, seen.at(-1))).toBe("two");
  });
});

describe("slide-out demo", () => {
  it("opens through the trigger and the open property", async () => {
    const entry = entryFor("slide-out");
    const host = mountDemo("slide-out") as HTMLElement & Openable;
    const seen = watchReadout(host, entry);
    await settle();

    byId("demo-slide-out-trigger").click();
    await settle();
    expect(host.open).toBe(true);

    byId("demo-slide-out-close").click();
    await settle();
    expect(host.open).toBe(false);

    host.open = true;
    await settle();
    expect(host.open).toBe(true);
    host.open = false;
    await settle();
    expect(host.open).toBe(false);
    expect(seen).toContain(true);
    expect(formatObserved(entry, seen.at(-1))).toBe("closed");
  });
});

describe("alert-dialog demo", () => {
  it("opens through the trigger and show()/close()/toggle()/open", async () => {
    const entry = entryFor("alert-dialog");
    const host = mountDemo("alert-dialog") as HTMLElement & Openable & Imperative;
    const seen = watchReadout(host, entry);
    await settle();

    byId("demo-alert-dialog-trigger").click();
    await settle();
    expect(host.open).toBe(true);

    byId("demo-alert-dialog-cancel").click();
    await settle();
    expect(host.open).toBe(false);

    host.show();
    await settle();
    expect(host.open).toBe(true);

    byId("demo-alert-dialog-trigger").click();
    await settle();
    expect(host.open).toBe(true);

    byId("demo-alert-dialog-action").click();
    await settle();
    expect(host.open).toBe(false);

    host.toggle();
    await settle();
    expect(host.open).toBe(true);
    host.toggle(false);
    await settle();
    expect(host.open).toBe(false);
    host.open = true;
    await settle();
    expect(host.open).toBe(true);
    host.open = false;
    await settle();
    expect(host.open).toBe(false);
    expect(seen).toContain(true);
    expect(formatObserved(entry, seen.at(-1))).toBe("closed");
  });
  it("shows toasts through showToast() and controls the demo toast", async () => {
    const entry = entryFor("toast");
    const region = mountDemo("toast") as HTMLElement & {
      showToast(options?: {
        title?: string;
        description?: string;
        type?: string;
      }): HTMLElement & Openable & Imperative;
    };
    const seen = watchReadout(region, entry);
    const demoToast = byId("demo-toast-toast") as HTMLElement & Openable & Imperative;
    await settle();
    expect(demoToast.open).toBe(true);

    const toast = region.showToast({ description: "Your changes are live.", title: "Saved" });
    await settle();
    expect(toast.open).toBe(true);
    expect(region.contains(toast)).toBe(true);

    demoToast.close();
    await settle();
    expect(demoToast.open).toBe(false);

    demoToast.show();
    await settle();
    expect(demoToast.open).toBe(true);

    demoToast.toggle();
    await settle();
    expect(demoToast.open).toBe(false);
    expect(seen).toContain(true);
    expect(formatObserved(entry, seen.at(-1))).toBe("closed");
  });
});

describe("menubar demo", () => {
  it("opens through triggers, openMenu(), and file show()/close()", async () => {
    const entry = entryFor("menubar");
    const bar = mountDemo("menubar") as HTMLElement & {
      openMenu(id: string): void;
      closeAll(): void;
    };
    const seen = watchReadout(bar, entry);
    const file = byId("demo-menubar-file") as HTMLElement & Openable & Imperative;
    const edit = byId("demo-menubar-edit") as HTMLElement & Openable & Imperative;
    await settle();

    byId("demo-menubar-file-trigger").click();
    await settle();
    expect(file.open).toBe(true);

    bar.openMenu("demo-menubar-edit");
    await settle();
    expect(edit.open).toBe(true);
    expect(file.open).toBe(false);

    bar.closeAll();
    await settle();
    expect(edit.open).toBe(false);

    file.show();
    await settle();
    expect(file.open).toBe(true);
    file.close();
    await settle();
    expect(file.open).toBe(false);

    edit.toggle();
    await settle();
    expect(edit.open).toBe(true);
    edit.toggle();
    await settle();
    expect(edit.open).toBe(false);
    expect(seen).toContain(true);
    expect(formatObserved(entry, seen.at(-1))).toBe("closed");
  });
});

describe("navigation-menu demo", () => {
  it("opens through Enter and show()/close()/toggle()/value", async () => {
    const entry = entryFor("navigation-menu");
    const host = mountDemo("navigation-menu") as HTMLElement & {
      value: string;
      show(value: string): void;
      close(): void;
      toggle(value?: string): void;
    };
    const seen = watchReadout(host, entry);
    await settle();

    const overviewTrigger = byId("demo-navigation-menu-overview-trigger");
    overviewTrigger.focus();
    overviewTrigger.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "Enter" }));
    await settle();
    expect(host.value).toBe("overview");
    expect(byId("demo-navigation-menu-overview-panel").hidden).toBe(false);

    host.close();
    await settle();
    expect(host.value).toBe("");

    host.show("handbook");
    await settle();
    expect(host.value).toBe("handbook");
    expect(byId("demo-navigation-menu-handbook-panel").hidden).toBe(false);

    host.toggle("overview");
    await settle();
    expect(host.value).toBe("overview");

    host.value = "handbook";
    await settle();
    expect(host.value).toBe("handbook");
    host.value = "";
    await settle();
    expect(host.value).toBe("");
    // Property writes commit effective state and notify the live readout.
    expect(seen.at(-1)).toBe("");
    expect(formatObserved(entry, seen.at(-1))).toBe("—");
  });
});
