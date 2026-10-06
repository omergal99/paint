// js/ui/icons/dialogArrow.js
// Shared "opens a dialog" indicator: an arrow entering a rounded frame.
// One file owns the SVG so every caller (DialogIndicator, mirrors, menus)
// renders the exact same glyph; sized down to the 14px menu-icon standard.
export const dialogArrowIcon = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="dialog-arrow-icon" aria-hidden="true" focusable="false"><path d="M9 3h8a3 3 0 0 1 3 3v12a3 3 0 0 1-3 3H9a3 3 0 0 1-3-3v-0.5 M6 8V6a3 3 0 0 1 3-3 M6 16v2a3 3 0 0 0 3 3" opacity="0.6" /><line x1="2" y1="12" x2="15" y2="12" /><polyline points="11 8 15 12 11 16" /></svg>';