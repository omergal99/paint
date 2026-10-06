// js/ui/icons/index.js
// SSOT registry for SVG icons created by JavaScript. Static markup in
// index.html keeps using the shared <symbol> sprite; JS-built UI (dialog
// indicators, dynamic menus) loads its glyphs from here so each SVG lives in
// exactly one file under js/ui/icons/.
import { dialogArrowIcon } from './dialogArrow.js';
import { paletteEditIcon } from './paletteEdit.js';
import { palettePrimaryIcon } from './palettePrimary.js';
import { paletteSecondaryIcon } from './paletteSecondary.js';
import { paletteResetIcon } from './paletteReset.js';

export const ICONS = Object.freeze({
  dialogArrow: dialogArrowIcon,
  paletteEdit: paletteEditIcon,
  palettePrimary: palettePrimaryIcon,
  paletteSecondary: paletteSecondaryIcon,
  paletteReset: paletteResetIcon,
});

/**
 * Markup for a registered icon.
 * @param {keyof ICONS} name registry key
 * @param {string} [extraClass] class added next to the icon's own class
 * @returns {string} ready-to-insert `<svg>` markup, '' when unknown
 */
export const getIconHtml = (name, extraClass = '') => {
  const svg = ICONS[name];
  if (!svg) return '';
  if (!extraClass) return svg;
  return svg.replace('class="', `class="${extraClass} `);
};