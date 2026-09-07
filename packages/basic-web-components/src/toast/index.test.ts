import { afterEach, describe, expect, it, vi } from "vitest";
import { type BwcToastElement, type BwcToastRegionElement } from "./index";
// Side-effect import: registering `bwc-toast-region`/`bwc-toast` on module load.
import "./index";

type RegionElement = BwcToastRegionElement;
type ToastElement = BwcToastElement;

function createRegion(options: { limit?: number; duration?: number } = {}) {
  const region = document.createElement("bwc-toast-region") as RegionElement;
  if (options.limit !== undefined) region.setAttribute("limit", String(options.limit));
  if (options.duration !== undefined) region.setAttribute("duration", String(options.duration));
  document.body.append(region);
  return region;
}

function createToast(region: RegionElement, options: { duration?: number; open?: boolean } = {}) {
  const toast = document.createElement("bwc-toast") as ToastElement;
  if (options.duration !== undefined) toast.setAttribute("duration", String(options.duration));
  toast.toggleAttribute("default-open", options.open ?? false);
  const title = document.createElement("div");
  title.setAttribute("data-title", "");
  title.textContent = "Saved";
  const close = document.createElement("button");
  close.setAttribute("data-close", "");
  close.textContent = "Dismiss";
  toast.append(title, close);
  region.append(toast);
  return { close, title, toast };
}

afterEach(() => {
  document.body.replaceChildren();
  vi.useRealTimers();
});

describe("region", () => {
  it("positions via data-position and defaults duration", () => {
    const region = createRegion();
    expect(region.dataset.position).toBe("bottom-right");
    expect(region.duration).toBe(5000);

    region.position = "top-center";
    expect(region.dataset.position).toBe("top-center");
  });

  it("showToast builds an open toast with title and close in one header", () => {
    const region = createRegion();
    const toast = region.showToast({ description: "Hello", title: "Hi", type: "success" });

    expect(toast.parentElement).toBe(region);
    expect(toast.open).toBe(true);
    expect(toast.hidden).toBe(false);
    expect(toast.dataset.type).toBe("success");
    const header = toast.querySelector("[data-toast-header]");
    expect(header?.querySelector("[data-title]")?.textContent).toBe("Hi");
    const close = header?.querySelector<HTMLButtonElement>("button[data-close]");
    expect(close).not.toBeNull();
    expect(close?.id).not.toBe("");
    expect(close?.dataset.testid).toBe("bwc-toast-close");
    expect(toast.querySelector("[data-description]")?.textContent).toBe("Hello");
  });

  it("showToast wires an action button when actionLabel is given", () => {
    const region = createRegion();
    const toast = region.showToast({ actionLabel: "Undo", title: "Deleted" });

    expect(toast.querySelector("button[data-action]")?.textContent).toBe("Undo");
  });
  it("enforces limit by parking extras with data-limited", async () => {
    const region = createRegion({ limit: 2 });
    const first = region.showToast({ title: "One" });
    const second = region.showToast({ title: "Two" });
    const third = region.showToast({ title: "Three" });

    expect(first.hasAttribute("data-limited")).toBe(false);
    expect(second.hasAttribute("data-limited")).toBe(false);
    expect(third.hasAttribute("data-limited")).toBe(true);
    expect(third.hidden).toBe(true);

    first.close();
    await vi.waitFor(() => expect(third.hasAttribute("data-limited")).toBe(false));
    expect(third.hidden).toBe(false);
  });
});

describe("toast", () => {
  it("opens declaratively and via show()", () => {
    const region = createRegion();
    const { toast } = createToast(region);

    expect(toast.open).toBe(false);
    expect(toast.hidden).toBe(true);

    toast.show();
    expect(toast.open).toBe(true);
    expect(toast.hidden).toBe(false);
    expect(toast.hasAttribute("data-open")).toBe(true);
    expect(toast.dataset.type).toBe("info");
  });

  it("emits open-change and mirrors data-type", () => {
    const region = createRegion();
    const { toast } = createToast(region);
    const callback = vi.fn();
    toast.onOpenChange = callback;
    toast.type = "error";

    toast.show();
    toast.close();
    expect(toast.dataset.type).toBe("error");
    expect(callback.mock.calls).toEqual([[true], [false]]);
  });
  it("applies property writes after uncontrolled opens", () => {
    const region = createRegion();
    const { toast } = createToast(region);
    const callback = vi.fn();
    toast.onOpenChange = callback;

    toast.show();
    toast.open = false;

    expect(toast.open).toBe(false);
    expect(toast.hidden).toBe(true);
    expect(callback.mock.calls).toEqual([[true], [false]]);
  });

  it("auto-dismisses after duration and stays sticky at 0", () => {
    vi.useFakeTimers();
    const region = createRegion({ duration: 100 });
    const first = region.showToast({ title: "Auto" });
    const { toast: sticky } = createToast(region, { duration: 0 });
    sticky.show();

    expect(first.open).toBe(true);
    vi.advanceTimersByTime(100);
    expect(first.open).toBe(false);
    expect(sticky.open).toBe(true);
  });

  it("pauses the countdown on hover and resumes on leave", () => {
    vi.useFakeTimers();
    const region = createRegion({ duration: 100 });
    const toast = region.showToast({ title: "Hover me" });

    vi.advanceTimersByTime(60);
    toast.dispatchEvent(new PointerEvent("pointerenter", { bubbles: true }));
    vi.advanceTimersByTime(100);
    expect(toast.open).toBe(true);

    toast.dispatchEvent(new PointerEvent("pointerleave", { bubbles: true }));
    vi.advanceTimersByTime(40);
    expect(toast.open).toBe(false);
  });

  it("close button dismisses", () => {
    const region = createRegion();
    const { close, toast } = createToast(region);
    toast.show();

    close.click();
    expect(toast.open).toBe(false);
  });
});
