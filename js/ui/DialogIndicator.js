const SVG_NAMESPACE = 'http://www.w3.org/2000/svg';
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

export const createDialogArrowIcon = ({ documentRef = globalThis.document } = {}) => {
  const icon = documentRef.createElementNS(SVG_NAMESPACE, 'svg');
  icon.setAttribute('viewBox', '0 0 24 24');
  icon.setAttribute('width', '16');
  icon.setAttribute('height', '16');
  icon.setAttribute('fill', 'none');
  icon.setAttribute('stroke', 'currentColor');
  icon.setAttribute('stroke-width', '2.5');
  icon.setAttribute('stroke-linecap', 'round');
  icon.setAttribute('stroke-linejoin', 'round');
  icon.setAttribute('class', 'dialog-arrow-icon');
  icon.setAttribute('aria-hidden', 'true');
  icon.setAttribute('focusable', 'false');

  const path = documentRef.createElementNS(SVG_NAMESPACE, 'path');
  path.setAttribute('d', 'M9 3h8a3 3 0 0 1 3 3v12a3 3 0 0 1-3 3H9a3 3 0 0 1-3-3v-0.5 M6 8V6a3 3 0 0 1 3-3 M6 16v2a3 3 0 0 0 3 3');
  path.setAttribute('opacity', '0.6');
  const line = documentRef.createElementNS(SVG_NAMESPACE, 'line');
  line.setAttribute('x1', '2');
  line.setAttribute('y1', '12');
  line.setAttribute('x2', '15');
  line.setAttribute('y2', '12');
  const polyline = documentRef.createElementNS(SVG_NAMESPACE, 'polyline');
  polyline.setAttribute('points', '11 8 15 12 11 16');
  icon.append(path, line, polyline);
  return icon;
};

export const appendDialogIndicator = (element, { documentRef = globalThis.document } = {}) => {
  if (!element || element.querySelector(':scope > .dialog-arrow-icon')) return null;
  const icon = createDialogArrowIcon({ documentRef });
  element.append(documentRef.createTextNode(' '), icon);
  return icon;
};

export const initializeDialogIndicators = ({ root = globalThis.document } = {}) => {
  const actions = DIALOG_INDICATOR_TAGS
    .map((tag) => root?.querySelector?.(`[data-tag="${tag}"]`))
    .filter(Boolean);
  actions.forEach((action) => appendDialogIndicator(action, { documentRef: root.ownerDocument || root }));
  return actions.length;
};
