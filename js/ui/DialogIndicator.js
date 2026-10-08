// js/ui/DialogIndicator.js
// Appends the shared "opens a dialog" arrow to a control. The glyph itself is
// owned by js/ui/icons/dialogArrow.js; this module only owns placement and the
// "append exactly once" guard.
import { getIconHtml } from './icons/index.js';

const DIALOG_INDICATOR_TAGS = Object.freeze([
  'btn-canvas-size',
  'btn-manage-workspace',
  'btn-remove-bg',
  'btn-rotate-free',
  'btn-adjustments',
  'brush-open-studio',
  'history-clear-btn',
  'ai-connect-button',
  'history-settings-link',
  'settings-history-clear',
  'settings-reset',
  'settings-clear-data',
]);

const DIRECT_INDICATOR = ':scope > .dialog-arrow-icon';

export const appendDialogIndicator = (element) => {
  if (!element || typeof element.insertAdjacentHTML !== 'function') return null;
  if (element.querySelector(DIRECT_INDICATOR)) return null;
  // insertAdjacentHTML appends the markup without re-parsing (and therefore
  // without re-binding) the element's existing children and listeners.
  element.insertAdjacentHTML('beforeend', ` ${getIconHtml('dialogArrow')}`);
  return element.querySelector(DIRECT_INDICATOR) || null;
};

export const initializeDialogIndicators = ({ root = globalThis.document } = {}) => {
  const actions = DIALOG_INDICATOR_TAGS
    .map((tag) => root?.querySelector?.(`[data-tag="${tag}"]`))
    .filter(Boolean);
  actions.forEach((action) => appendDialogIndicator(action));
  return actions.length;
};
