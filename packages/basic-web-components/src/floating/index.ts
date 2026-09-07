// Shared floating core for popover, menu, preview-card, context-menu,
// tooltip, and select: pure placement (position.ts), anchor resolution +
// live tracking (anchor.ts), light-dismiss (dismiss.ts), hover with delays
// and a hoverable bridge (hover.ts).
export {
  computePosition,
  positionFloating,
  floatingAligns,
  floatingSides,
  type AnchorRect,
  type CollisionBoundary,
  type ComputePositionOptions,
  type ComputePositionResult,
  type FloatingAlign,
  type FloatingSide,
  type FloatingSize,
  type FloatingStrategy,
  type PositionFloatingOptions,
} from "./position";
export {
  resolveAnchor,
  trackAnchor,
  type AnchorHost,
  type AnchorOption,
  type TrackAnchorOptions,
} from "./anchor";
export { attachDismiss, type DismissOptions } from "./dismiss";
export { attachHover, type HoverOptions } from "./hover";
export { acquireScrollLock, releaseScrollLock, scrollLockCount } from "./scroll-lock";
