// Hover open/close with delays and a hoverable bridge: the pointer may move
// between trigger and panel without closing, for future hover floaters
// (tooltip, preview-card). Click floaters (popover) don't use this.

export interface HoverOptions {
  openDelay?: number;
  closeDelay?: number;
  onOpen: () => void;
  onClose: () => void;
}

/**
 * Open on hovering the trigger, keep open while hovering either surface,
 * close after leaving both. Returns a detach function; safe to call twice.
 */
export function attachHover(
  trigger: Element,
  floating: Element,
  options: HoverOptions,
): () => void {
  let detached = false;
  const openDelay = options.openDelay ?? 0;
  const closeDelay = options.closeDelay ?? 0;
  let openTimer = 0;
  let closeTimer = 0;

  const clearTimers = () => {
    window.clearTimeout(openTimer);
    window.clearTimeout(closeTimer);
  };
  const scheduleOpen = () => {
    window.clearTimeout(closeTimer);
    window.clearTimeout(openTimer);
    if (openDelay <= 0) options.onOpen();
    else openTimer = window.setTimeout(options.onOpen, openDelay);
  };
  const scheduleClose = () => {
    window.clearTimeout(openTimer);
    window.clearTimeout(closeTimer);
    if (closeDelay <= 0) options.onClose();
    else closeTimer = window.setTimeout(options.onClose, closeDelay);
  };

  trigger.addEventListener("pointerenter", scheduleOpen);
  trigger.addEventListener("pointerleave", scheduleClose);
  floating.addEventListener("pointerenter", scheduleOpen);
  floating.addEventListener("pointerleave", scheduleClose);

  return () => {
    if (detached) return;
    detached = true;
    clearTimers();
    trigger.removeEventListener("pointerenter", scheduleOpen);
    trigger.removeEventListener("pointerleave", scheduleClose);
    floating.removeEventListener("pointerenter", scheduleOpen);
    floating.removeEventListener("pointerleave", scheduleClose);
  };
}
