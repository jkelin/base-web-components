// Shared floating-positioning core (dependency-free).
//
// One pure placement function plus a thin DOM applier, reused by popover and
// future floating components (menu, preview-card, context-menu, tooltip,
// select). All geometry lives in a single coordinate space chosen by the
// caller: viewport-relative rects for `fixed`, document/offset-parent
// relative rects for `absolute` (see anchor.ts + positionFloating).

export type FloatingSide = "top" | "right" | "bottom" | "left";
export type FloatingAlign = "start" | "center" | "end";
export type FloatingStrategy = "absolute" | "fixed";

export interface AnchorRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface FloatingSize {
  width: number;
  height: number;
}

export interface CollisionBoundary {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ComputePositionOptions {
  side?: FloatingSide;
  align?: FloatingAlign;
  /** Gap between anchor and panel on the main axis, in px. */
  sideOffset?: number;
  /** Shift along the alignment axis, in px. */
  alignOffset?: number;
  /** Keep this much space between panel and boundary, in px. */
  collisionPadding?: number;
  /** Space the panel must stay inside. Defaults to an infinite space. */
  collisionBoundary?: CollisionBoundary;
  /** Arrow box size in px. Reserves clamp room; 0 disables arrow output. */
  arrowSize?: number;
  /** Flip to the opposite side when the requested side overflows. */
  flip?: boolean;
  /** Clamp (shift) the panel inside the boundary on the cross axis. */
  shift?: boolean;
}

export interface ComputePositionResult {
  x: number;
  y: number;
  placedSide: FloatingSide;
  placedAlign: FloatingAlign;
  /** Arrow offset inside the panel on the cross axis; null when no arrow. */
  arrowX: number | null;
  arrowY: number | null;
}

export const floatingSides: readonly FloatingSide[] = ["top", "right", "bottom", "left"];
export const floatingAligns: readonly FloatingAlign[] = ["start", "center", "end"];

function oppositeSide(side: FloatingSide): FloatingSide {
  switch (side) {
    case "top":
      return "bottom";
    case "bottom":
      return "top";
    case "left":
      return "right";
    case "right":
      return "left";
  }
}

function isVertical(side: FloatingSide): boolean {
  return side === "top" || side === "bottom";
}

// Base (unclamped) origin for a side/align pair. Align offset shifts along
// the alignment axis with the same sign for every side.
function baseOrigin(
  anchor: AnchorRect,
  size: FloatingSize,
  side: FloatingSide,
  align: FloatingAlign,
  sideOffset: number,
  alignOffset: number,
): { x: number; y: number } {
  let x: number;
  let y: number;
  if (side === "bottom") {
    y = anchor.y + anchor.height + sideOffset;
  } else if (side === "top") {
    y = anchor.y - size.height - sideOffset;
  } else if (align === "start") {
    y = anchor.y + alignOffset;
  } else if (align === "end") {
    y = anchor.y + anchor.height - size.height + alignOffset;
  } else {
    y = anchor.y + (anchor.height - size.height) / 2 + alignOffset;
  }
  if (side === "right") {
    x = anchor.x + anchor.width + sideOffset;
  } else if (side === "left") {
    x = anchor.x - size.width - sideOffset;
  } else if (align === "start") {
    x = anchor.x + alignOffset;
  } else if (align === "end") {
    x = anchor.x + anchor.width - size.width + alignOffset;
  } else {
    x = anchor.x + (anchor.width - size.width) / 2 + alignOffset;
  }
  return { x, y };
}

function clampToRange(value: number, min: number, max: number): number {
  // Panel larger than the available space: center it instead of sticking out
  // on one side.
  if (max < min) return (min + max) / 2;
  return Math.min(max, Math.max(min, value));
}

/**
 * Pure placement: given the anchor rect and floating size (same coordinate
 * space), return the panel origin, actually used side/align, and arrow
 * offsets inside the panel.
 */
export function computePosition(
  anchor: AnchorRect,
  size: FloatingSize,
  options: ComputePositionOptions = {},
): ComputePositionResult {
  const side = options.side ?? "bottom";
  const align: FloatingAlign = options.align ?? "center";
  const sideOffset = options.sideOffset ?? 0;
  const alignOffset = options.alignOffset ?? 0;
  const padding = options.collisionPadding ?? 0;
  const flip = options.flip ?? true;
  const shift = options.shift ?? true;
  const arrowSize = Math.max(0, options.arrowSize ?? 0);
  const boundary = options.collisionBoundary;

  let placedSide = side;
  let origin = baseOrigin(anchor, size, placedSide, align, sideOffset, alignOffset);

  if (boundary && flip) {
    const minX = boundary.x + padding;
    const maxX = boundary.x + boundary.width - padding;
    const minY = boundary.y + padding;
    const maxY = boundary.y + boundary.height - padding;
    // Main-axis overflow of the current side vs the opposite side; flip when
    // the current side overflows and the opposite side overflows less.
    const currentOverflow = mainOverflow(origin, size, placedSide, minX, maxX, minY, maxY);
    const opposite = oppositeSide(placedSide);
    const oppositeOrigin = baseOrigin(anchor, size, opposite, align, sideOffset, alignOffset);
    const oppositeOverflow = mainOverflow(oppositeOrigin, size, opposite, minX, maxX, minY, maxY);
    if (currentOverflow > 0 && oppositeOverflow < currentOverflow) {
      placedSide = opposite;
      origin = oppositeOrigin;
    }
  }

  if (boundary && shift) {
    if (isVertical(placedSide)) {
      const min = boundary.x + padding;
      const max = boundary.x + boundary.width - size.width - padding;
      origin = { x: clampToRange(origin.x, min, max), y: origin.y };
    } else {
      const min = boundary.y + padding;
      const max = boundary.y + boundary.height - size.height - padding;
      origin = { x: origin.x, y: clampToRange(origin.y, min, max) };
    }
  }

  let arrowX: number | null = null;
  let arrowY: number | null = null;
  if (arrowSize > 0) {
    if (isVertical(placedSide)) {
      const center = anchor.x + anchor.width / 2;
      arrowX = clampToRange(
        center - origin.x - arrowSize / 2,
        padding,
        size.width - arrowSize - padding,
      );
    } else {
      const center = anchor.y + anchor.height / 2;
      arrowY = clampToRange(
        center - origin.y - arrowSize / 2,
        padding,
        size.height - arrowSize - padding,
      );
    }
  }

  return { x: origin.x, y: origin.y, placedSide, placedAlign: align, arrowX, arrowY };
}

function mainOverflow(
  origin: { x: number; y: number },
  size: FloatingSize,
  side: FloatingSide,
  minX: number,
  maxX: number,
  minY: number,
  maxY: number,
): number {
  switch (side) {
    case "bottom":
      return origin.y + size.height - maxY;
    case "top":
      return minY - origin.y;
    case "right":
      return origin.x + size.width - maxX;
    case "left":
      return minX - origin.x;
  }
}

export interface PositionFloatingOptions extends ComputePositionOptions {
  strategy?: FloatingStrategy;
}

/**
 * Measure anchor + panel, compute placement, and apply it as inline styles.
 * Writes `position`/`left`/`top` plus `data-side`/`data-align` hooks, and
 * positions the arrow element when provided. Returns the placement result.
 */
export function positionFloating(
  anchorEl: Element,
  floatingEl: HTMLElement,
  arrowEl: HTMLElement | null,
  options: PositionFloatingOptions = {},
): ComputePositionResult {
  const strategy = options.strategy ?? "fixed";
  const anchorRect = anchorEl.getBoundingClientRect();
  const floatingRect = floatingEl.getBoundingClientRect();
  const size = { width: floatingRect.width, height: floatingRect.height };

  let anchor: AnchorRect = {
    x: anchorRect.x,
    y: anchorRect.y,
    width: anchorRect.width,
    height: anchorRect.height,
  };
  let boundary = options.collisionBoundary;
  if (strategy === "absolute") {
    const offsetParent = floatingEl.offsetParent as Element | null;
    if (offsetParent) {
      const parentRect = offsetParent.getBoundingClientRect();
      const scrollX = window.scrollX;
      const scrollY = window.scrollY;
      // Document-space anchor minus document-space offset-parent origin.
      anchor = {
        x: anchorRect.left + scrollX - (parentRect.left + scrollX),
        y: anchorRect.top + scrollY - (parentRect.top + scrollY),
        width: anchorRect.width,
        height: anchorRect.height,
      };
      boundary ??= {
        x: scrollX - (parentRect.left + scrollX),
        y: scrollY - (parentRect.top + scrollY),
        width: window.innerWidth,
        height: window.innerHeight,
      };
    } else {
      // Top-layer (e.g. native popover) has no offset parent: absolute
      // behaves like fixed.
      boundary ??= { x: 0, y: 0, width: window.innerWidth, height: window.innerHeight };
    }
  } else {
    boundary ??= { x: 0, y: 0, width: window.innerWidth, height: window.innerHeight };
  }

  const arrowSize = options.arrowSize ?? (arrowEl ? arrowEl.getBoundingClientRect().width || 8 : 0);
  const result = computePosition(anchor, size, {
    ...options,
    collisionBoundary: boundary,
    arrowSize,
  });

  const absolute = strategy === "absolute" && floatingEl.offsetParent;
  floatingEl.style.position = absolute ? "absolute" : "fixed";
  floatingEl.style.left = `${result.x}px`;
  floatingEl.style.top = `${result.y}px`;
  if (floatingEl.dataset.side !== result.placedSide) {
    floatingEl.dataset.side = result.placedSide;
  }
  if (floatingEl.dataset.align !== result.placedAlign) {
    floatingEl.dataset.align = result.placedAlign;
  }

  if (arrowEl) {
    arrowEl.style.position = "absolute";
    if (result.arrowX !== null) {
      arrowEl.style.left = `${result.arrowX}px`;
      arrowEl.style.top = "";
    } else if (result.arrowY !== null) {
      arrowEl.style.top = `${result.arrowY}px`;
      arrowEl.style.left = "";
    }
    if (arrowEl.dataset.side !== result.placedSide) {
      arrowEl.dataset.side = result.placedSide;
    }
  }

  return result;
}
