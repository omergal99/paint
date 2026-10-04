// js/utils/color.js
// Small, dependency-free color helpers shared across the app.

/** Convert {r,g,b} (0-255 each) to "#rrggbb" */
export const rgbToHex = (r, g, b) => {
  const toHex = (n) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toLowerCase();
}

/** Convert "#rrggbb" or "#rgb" to {r,g,b}. Returns null if invalid. */
export const hexToRgb = (hex) => {
  if (!hex) return null;
  let h = hex.trim().replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  if (!/^[0-9a-fA-F]{6}$/.test(h)) return null;
  const num = parseInt(h, 16);
  return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 };
}

/** Format an {r,g,b} object as "rgb(r, g, b)" text for display/copy. */
export const rgbToString = ({ r, g, b }) => {
  return `rgb(${r}, ${g}, ${b})`;
}

/** Pick black or white text color for best contrast against a given hex bg. */
export const contrastTextColor = (hex) => {
  const rgb = hexToRgb(hex);
  if (!rgb) return '#000000';
  const luminance = (0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b) / 255;
  return luminance > 0.6 ? '#000000' : '#ffffff';
}

/** Convert an {h,s,l} (h 0-360, s/l 0-100) object to "#rrggbb". */
export const hslToHex = ({ h = 0, s = 0, l = 0 } = {}) => {
  const hue = ((Number(h) % 360) + 360) % 360;
  const saturation = Math.max(0, Math.min(100, Number(s))) / 100;
  const lightness = Math.max(0, Math.min(100, Number(l))) / 100;
  const chroma = (1 - Math.abs(2 * lightness - 1)) * saturation;
  const second = chroma * (1 - Math.abs(((hue / 60) % 2) - 1));
  const match = lightness - chroma / 2;
  let r = 0;
  let g = 0;
  let b = 0;
  if (hue < 60) [r, g, b] = [chroma, second, 0];
  else if (hue < 120) [r, g, b] = [second, chroma, 0];
  else if (hue < 180) [r, g, b] = [0, chroma, second];
  else if (hue < 240) [r, g, b] = [0, second, chroma];
  else if (hue < 300) [r, g, b] = [second, 0, chroma];
  else [r, g, b] = [chroma, 0, second];
  return rgbToHex((r + match) * 255, (g + match) * 255, (b + match) * 255);
};

/** Convert "#rrggbb"/"#rgb" to {h,s,l} (h 0-360, s/l 0-100). Null if invalid. */
export const hexToHsl = (hex) => {
  const rgb = hexToRgb(hex);
  if (!rgb) return null;
  const r = rgb.r / 255;
  const g = rgb.g / 255;
  const b = rgb.b / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const lightness = (max + min) / 2;
  const delta = max - min;
  let hue = 0;
  let saturation = 0;
  if (delta !== 0) {
    saturation = delta / (1 - Math.abs(2 * lightness - 1));
    if (max === r) hue = ((g - b) / delta) % 6;
    else if (max === g) hue = (b - r) / delta + 2;
    else hue = (r - g) / delta + 4;
    hue *= 60;
    if (hue < 0) hue += 360;
  }
  return {
    h: Math.round(hue),
    s: Math.round(saturation * 100),
    l: Math.round(lightness * 100),
  };
};

/** Return hex with a new saturation (0-100) while keeping hue and lightness. */
export const withSaturation = (hex, saturation) => {
  const hsl = hexToHsl(hex);
  return hsl ? hslToHex({ ...hsl, s: saturation }) : hex;
};

/** Return hex with a new lightness (0-100) while keeping hue and saturation. */
export const withLightness = (hex, lightness) => {
  const hsl = hexToHsl(hex);
  return hsl ? hslToHex({ ...hsl, l: lightness }) : hex;
};

// The header ribbon palette grid is `repeat(10, 16px)` and the control band is
// 50px tall, so every ribbon palette holds exactly 30 swatches: the leading 28
// are colour slots and the trailing 2 are pager arrows that cycle the built-in
// presets in order (1 -> 2 -> 3 -> 4). The sidebar picker renders palette 2
// plus palette 1 plus the 56 extended swatches (palettes 3-4).
export const COLOR_PALETTE_1 = [
  // Row 1: blacks (4) / grays (3) / whites+purple accents (3)
  '#000000', '#151515', '#3f3f3f', '#838383',
  '#c3c3c3', '#e7e7e7', '#f3f4f6',
  '#ffffff', '#a855f7', '#e9d5ff',
  // Row 2: reds (4) / oranges (3) / yellows (3)
  '#7f1d1d', '#b91c1c', '#ef4444', '#f87171',
  '#c2410c', '#f97316', '#fdba74',
  '#eab308', '#facc15', '#fde047',
  // Row 3: greens (4) / blues (3) / purples (1) + 2 pager slots
  '#14532d', '#16a34a', '#4ade80', '#bbf7d0',
  '#1e3a8a', '#2563eb', '#93c5fd',
  '#5b21b6',
];

// The classic MS Paint-style palette, kept as an opt-in preset in the Colors
// settings and as the `paint:colors` migration source for untouched installs.
// Exactly 28 swatches so the ribbon keeps its 2 pager slots (28+2 = 30 cells).
export const COLOR_PALETTE_2 = Object.freeze([
  '#000000', '#7f7f7f', '#880015', '#ed1c24', '#ff7f27', '#fff200',
  '#22b14c', '#00a2e8', '#3f48cc', '#a349a4', '#ffffff', '#c3c3c3',
  '#b97a57', '#ffc90e',
  '#efe4b0', '#b5e61d', '#99d9ea', '#7092be', '#c8bfe7', '#ffaec9',
  '#ffd700', '#80ff80', '#80ffff', '#8080ff', '#ff80ff', '#d2691e',
  '#708090', '#deb887',
]);

// Two extended 28-swatch palettes that surface in the roomier sidebar picker
// and are paged together with palettes 1-2 by the ribbon arrows. Together the
// four pages give the extended grid 112 cells. Palettes 3-4 avoid every swatch
// already used by 1-2 so each adds 28 genuinely new colours; palettes 1 and 2
// intentionally still share black/white/light-grey because palette 2 is the
// verbatim classic MS Paint palette.
export const COLOR_PALETTE_3 = Object.freeze([
  '#0f172a', '#1e293b', '#334155', '#475569', '#64748b', '#94a3b8',
  '#cbd5e1', '#e2e8f0', '#f8fafc', '#78716c', '#57534e', '#44403c',
  '#292524', '#1c1917', '#78350f', '#92400e', '#b45309', '#d97706',
  '#f59e0b', '#fbbf24', '#fcd34d', '#fde68a', '#fef9c3', '#fefce8',
  '#166534', '#15803d', '#0891b2', '#155e75',
]);

export const COLOR_PALETTE_4 = Object.freeze([
  '#22c55e', '#059669', '#86efac', '#dcfce7', '#f0fdf4', '#134e4a',
  '#0f766e', '#0d9488', '#14b8a6', '#2dd4bf', '#5eead4', '#99f6e4',
  '#ccfbf1', '#f0fdfa', '#0e7490', '#0284c7', '#0ea5e9', '#38bdf8',
  '#7dd3fc', '#bae6fd', '#e0f2fe', '#f0f9ff', '#4c1d95', '#6b21a8',
  '#6d28d9', '#7c3aed', '#8b5cf6', '#a78bfa',
]);

export const COLOR_PALETTES = Object.freeze([
  COLOR_PALETTE_1,
  COLOR_PALETTE_2,
  COLOR_PALETTE_3,
  COLOR_PALETTE_4,
]);

// The short-lived 40-swatch refresh that predates the 3-row ribbon layout.
// Recognised only so persisted copies upgrade to COLOR_PALETTE_1 instead of
// overflowing the compact header grid.
const RETIRED_40_SWATCH_PALETTE = Object.freeze([
  '#000000', '#1f2937', '#374151', '#4b5563', '#6b7280',
  '#9ca3af', '#d1d5db', '#e5e7eb', '#f3f4f6', '#ffffff',
  '#7f1d1d', '#b91c1c', '#dc2626', '#ef4444', '#f87171',
  '#9a3412', '#ea580c', '#f97316', '#fb923c', '#fed7aa',
  '#713f12', '#a16207', '#eab308', '#facc15', '#fde047',
  '#14532d', '#15803d', '#16a34a', '#22c55e', '#86efac',
  '#0c4a6e', '#0284c7', '#0ea5e9', '#1e3a8a', '#2563eb',
  '#6366f1', '#7c3aed', '#a855f7', '#ec4899', '#f472b6',
]);

// Ribbon grids reserve the last row's final two slots for the pager arrows,
// so each built-in palette page contributes exactly 28 colour cells and the
// sidebar picker mirrors the same 28 swatches.
export const RIBBON_PALETTE_COLOR_COUNT = 28;
// The compact ribbon grid is exactly 3 rows x 10 columns (30 cells): 28
// colours plus the two pager arrows. Re-exported under the legacy name so
// older imports keep working.
export const COLOR_PALETTE_MAX = RIBBON_PALETTE_COLOR_COUNT + 2;

const isSamePalette = (colors, reference) => Array.isArray(colors)
  && colors.length === reference.length
  && colors.every((hex, index) => String(hex).toLowerCase() === reference[index].toLowerCase());

/**
 * Identify a palette array as a built-in preset ('p1' | 'p2' | 'p3' | 'p4') or
 * null when the user has edited it. Pure so the settings switcher and tests
 * share one rule.
 */
export const colorPalettePreset = (colors) => (
  isSamePalette(colors, COLOR_PALETTE_1) ? 'p1'
    : isSamePalette(colors, COLOR_PALETTE_2) ? 'p2'
    : isSamePalette(colors, COLOR_PALETTE_3) ? 'p3'
    : isSamePalette(colors, COLOR_PALETTE_4) ? 'p4' : null
);

export const PALETTE_PAGE_IDS = Object.freeze(['p1', 'p2', 'p3', 'p4']);

/**
 * Perceived luminance (0-255). Used to order the sidebar picker so similar
 * colours sit next to each other on one dark-to-light ramp.
 */
const perceivedLuminance = (hex) => {
  const rgb = hexToRgb(hex);
  if (!rgb) return Number.MAX_SAFE_INTEGER;
  // Rec. 709 weights: cheap, monotonic with perceived brightness, and it keeps
  // blue-heavy colours darker than yellow-heavy ones at equal HSL lightness.
  return 0.2126 * rgb.r + 0.7152 * rgb.g + 0.0722 * rgb.b;
};

/**
 * Order swatches for the extended picker: darkest to lightest, with hue as the
 * tie-breaker so equal-brightness colours stay in a stable, related order.
 * Pure and non-mutating, so the built-in page arrays keep their curated layout.
 */
export const sortColorsByLightness = (colors) => {
  if (!Array.isArray(colors)) return [];
  return colors
    .map((hex, index) => ({ hex, index, luminance: perceivedLuminance(hex), hsl: hexToHsl(hex) }))
    .sort((a, b) => (
      a.luminance - b.luminance
      || (a.hsl?.h ?? 0) - (b.hsl?.h ?? 0)
      || a.index - b.index
    ))
    .map((entry) => entry.hex);
};

/**
 * The sidebar picker's swatches: every built-in palette, de-duplicated, ordered
 * dark to light so nearby swatches are visually related.
 */
export const extendedPickerColors = () => sortColorsByLightness([...new Set(COLOR_PALETTES.flat())]);

/**
 * Normalize a persisted palette page id. Custom palettes (edited swatches)
 * always resolve to their built-in preset when they still match one, so a
 * hand-edited copy never strands the arrows on the wrong page.
 */
export const normalizePalettePage = (page, colors) => {
  if (PALETTE_PAGE_IDS.includes(page)) return page;
  return colorPalettePreset(colors) || 'p1';
};

/**
 * Upgrade a persisted palette to COLOR_PALETTE_1 when it still matches a
 * retired default (the user never customised it); otherwise keep the user's
 * colours untouched. Pure so the migration is unit-testable.
 */
export const migrateLegacyPalette = (colors) => (
  isSamePalette(colors, COLOR_PALETTE_2) || isSamePalette(colors, RETIRED_40_SWATCH_PALETTE)
    ? [...COLOR_PALETTE_1]
    : colors
);
