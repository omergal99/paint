// js/services/selection/selectionAppearance.js
// Presentation rules for the selection overlay: the marching-ants frame, the
// "active" highlight, and the corner/rotate handle sizing.
//
// Split out of `main.js` so the visual contract is one place instead of being
// spread across the outline painter, the handle positioner and the stylesheet.
// Settings write CSS custom properties; nothing here reads them back, so the
// stylesheet stays the single source for colour and size.

export const DEFAULT_SELECTION_APPEARANCE = Object.freeze({
  // Canvas-pixel stroke widths. Divided by zoom at paint time so the dashes
  // stay the same weight on screen.
  outlineWidth: 1,
  activeOutlineWidth: 2,
  dashPattern: Object.freeze([4, 3]),
  // Screen-pixel handle size; converted to canvas size as base / zoom.
  handleSize: 9,
  rotateHandleSize: 24,
  // Handle gap above the selection, in screen pixels.
  rotateHandleGap: 28,
});

const FALLBACK_COLORS = Object.freeze({
  idle: '#0078d4',
  active: '#0b3d91',
});

const clamp = (value, min, max, fallback) => {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, number));
};

const readColor = (name, fallback) => {
  if (typeof document === 'undefined' || typeof getComputedStyle !== 'function') return fallback;
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || fallback;
};

/** Current appearance, merged from defaults and the live CSS custom properties. */
export const readSelectionAppearance = () => {
  const defaults = DEFAULT_SELECTION_APPEARANCE;
  return Object.freeze({
    outlineColor: readColor('--selection-outline-color', FALLBACK_COLORS.idle),
    activeOutlineColor: readColor('--selection-outline-active-color', FALLBACK_COLORS.active),
    handleSize: clamp(readColor('--selection-handle-size', ''), 5, 40, defaults.handleSize),
    rotateHandleSize: clamp(readColor('--selection-rotate-size', ''), 12, 64, defaults.rotateHandleSize),
    outlineWidth: defaults.outlineWidth,
    activeOutlineWidth: defaults.activeOutlineWidth,
    dashPattern: defaults.dashPattern,
    rotateHandleGap: defaults.rotateHandleGap,
  });
};

/**
 * Paint the marching-ants frame. `active` marks a selection that is floating
 * and ready to move, which is the state a user is most likely to misread as a
 * rendering glitch. `preview` suppresses the frame entirely.
 */
export const paintSelectionFrame = (context, region, {
  appearance = readSelectionAppearance(),
  active = false,
  preview = false,
  zoom = 1,
} = {}) => {
  if (!context || !region || !region.w || !region.h || preview) return false;
  const scale = Number.isFinite(zoom) && zoom > 0 ? zoom : 1;
  context.save();
  context.strokeStyle = active ? appearance.activeOutlineColor : appearance.outlineColor;
  context.lineWidth = (active ? appearance.activeOutlineWidth : appearance.outlineWidth) / scale;
  context.setLineDash(appearance.dashPattern.map((value) => value / scale));
  // Half-pixel offset keeps a 1px stroke from smearing across two pixels.
  context.strokeRect(region.x + 0.5 / scale, region.y + 0.5 / scale, region.w, region.h);
  context.restore();
  return true;
};