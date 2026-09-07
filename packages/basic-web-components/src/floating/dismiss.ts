// Light-dismiss for floating panels: outside pointerdown, Escape, and
// optionally focus leaving the panel. Native-popover components keep the
// platform behavior instead; this serves future non-popover floaters.

export interface DismissOptions {
  /** Close on pointerdown outside panel + anchors. Default true. */
  outside?: boolean;
  /** Close on Escape. Default true. */
  escape?: boolean;
  /** Close when focus leaves panel + anchors. Default false. */
  focusOut?: boolean;
  onDismiss: () => void;
}

/**
 * Attach dismiss listeners. `anchors` stay "inside" (e.g. the trigger, so
 * the click that opens doesn't immediately close). Returns a detach
 * function; safe to call twice.
 */
export function attachDismiss(
  floating: HTMLElement,
  anchors: Array<Element | null | undefined>,
  options: DismissOptions,
): () => void {
  let detached = false;
  const outside = options.outside ?? true;
  const escape = options.escape ?? true;
  const focusOut = options.focusOut ?? false;
  const { onDismiss } = options;

  const isInside = (target: EventTarget | null): boolean => {
    if (target instanceof Element && floating.contains(target)) return true;
    return anchors.some((anchor) => anchor instanceof Element && anchor.contains(target as Node));
  };

  const onPointerDown = (event: Event) => {
    if (!isInside(event.target)) onDismiss();
  };
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === "Escape") onDismiss();
  };
  const onFocusOut = (event: FocusEvent) => {
    const next = event.relatedTarget;
    if (next === null || !isInside(next)) onDismiss();
  };

  if (outside) document.addEventListener("pointerdown", onPointerDown, true);
  if (escape) document.addEventListener("keydown", onKeyDown, true);
  if (focusOut) document.addEventListener("focusout", onFocusOut);

  return () => {
    if (detached) return;
    detached = true;
    if (outside) document.removeEventListener("pointerdown", onPointerDown, true);
    if (escape) document.removeEventListener("keydown", onKeyDown, true);
    if (focusOut) document.removeEventListener("focusout", onFocusOut);
  };
}
