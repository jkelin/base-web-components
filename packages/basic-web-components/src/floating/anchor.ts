// Anchor resolution + live tracking for floating panels.
//
// The panel anchors to the trigger element by default; any component may
// override it with an element or a selector (its `anchor` option). While
// open, scroll/resize/layout changes re-run the update callback; the caller
// owns positioning (usually positionFloating).

export type AnchorOption = Element | string | null;

export interface AnchorHost {
  getRootNode(): Node;
}

/**
 * Resolve the anchor element: an element is used as-is, a string is a
 * selector queried in the host's root, null/unknown falls back to `trigger`.
 */
export function resolveAnchor(
  host: AnchorHost,
  anchor: AnchorOption,
  trigger: Element | null,
): Element | null {
  if (anchor instanceof Element) return anchor;
  if (typeof anchor === "string" && anchor !== "") {
    const root = host.getRootNode() as Document | ShadowRoot;
    const found = typeof root.querySelector === "function" ? root.querySelector(anchor) : null;
    if (found instanceof Element) return found;
  }
  return trigger;
}

export interface TrackAnchorOptions {
  /** Observe anchor + panel size changes. Defaults to true when available. */
  resizeObserver?: boolean;
}

/**
 * Re-run `update` on scroll (capture), viewport resize, and optionally on
 * anchor/panel resizes. Returns a detach function; safe to call twice.
 */
export function trackAnchor(
  anchorEl: Element,
  floatingEl: Element,
  update: () => void,
  options: TrackAnchorOptions = {},
): () => void {
  let detached = false;
  const onScroll = () => update();
  const onResize = () => update();
  const observe = options.resizeObserver ?? true;

  window.addEventListener("scroll", onScroll, true);
  window.addEventListener("resize", onResize);

  let observer: ResizeObserver | null = null;
  if (observe && typeof ResizeObserver === "function") {
    observer = new ResizeObserver(() => update());
    observer.observe(anchorEl);
    observer.observe(floatingEl);
  }

  return () => {
    if (detached) return;
    detached = true;
    window.removeEventListener("scroll", onScroll, true);
    window.removeEventListener("resize", onResize);
    observer?.disconnect();
  };
}
