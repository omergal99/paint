// js/utils/color.js
// Small, dependency-free color helpers shared across the app.

/** Convert {r,g,b} (0-255 each) to "#rrggbb" */
export function rgbToHex(r, g, b) {
  const toHex = (n) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toLowerCase();
}

/** Convert "#rrggbb" or "#rgb" to {r,g,b}. Returns null if invalid. */
export function hexToRgb(hex) {
  if (!hex) return null;
  let h = hex.trim().replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  if (!/^[0-9a-fA-F]{6}$/.test(h)) return null;
  const num = parseInt(h, 16);
  return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 };
}

/** Format an {r,g,b} object as "rgb(r, g, b)" text for display/copy. */
export function rgbToString({ r, g, b }) {
  return `rgb(${r}, ${g}, ${b})`;
}

/** Pick black or white text color for best contrast against a given hex bg. */
export function contrastTextColor(hex) {
  const rgb = hexToRgb(hex);
  if (!rgb) return '#000000';
  const luminance = (0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b) / 255;
  return luminance > 0.6 ? '#000000' : '#ffffff';
}

/** Classic MS Paint-style default swatch palette (2 rows x 14), approximated. */
export const DEFAULT_PALETTE = [
  // Row 1
  '#000000', '#7f7f7f', '#880015', '#ed1c24', '#ff7f27', '#fff200',
  '#22b14c', '#00a2e8', '#3f48cc', '#a349a4', '#ffffff', '#c3c3c3',
  '#b97a57', '#ffc90e',
  // Row 2 (lighter tints)
  '#efe4b0', '#b5e61d', '#99d9ea', '#7092be', '#c8bfe7', '#ffaec9',
  '#ffd700', '#80ff80', '#80ffff', '#8080ff', '#ff80ff', '#d2691e',
  '#708090', '#deb887',
];
