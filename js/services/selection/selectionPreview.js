// Live preview of the selection frame, handle size and colours.
//
// The controls write CSS custom properties (see selectionSettings.js), and the
// canvas overlay reads those same variables - so this preview binds to the
// exact same source of truth rather than duplicating the values. That is what
// makes "what you see here" equal "what you get on the canvas".
const APPEARANCE_VARIABLES = Object.freeze([
  '--selection-handle-size',
  '--selection-outline-color',
  '--selection-outline-active-color',
]);

const PREVIEW_TEMPLATE = `
  <div class="selection-preview-sample" data-role="sample">
    <span class="selection-preview-sample-handle" data-role="handle"></span>
    <span class="selection-preview-sample-frame" data-role="frame"></span>
    <span class="selection-preview-sample-active" data-role="active"></span>
  </div>`;

/**
 * @param {object} deps
 * @param {HTMLElement} deps.host element that receives the preview
 * @param {string[]} [deps.inputs] ids of the controls to reflect
 */
export const createSelectionPreview = ({ host, inputs = [] } = {}) => {
  if (!host) return Object.freeze({ destroy() {} });
  host.innerHTML = PREVIEW_TEMPLATE;
  const root = globalThis.document?.documentElement;
  const handle = host.querySelector('[data-role="handle"]');
  const frame = host.querySelector('[data-role="frame"]');
  const active = host.querySelector('[data-role="active"]');
  const numericBadge = host.querySelector('[data-role="value"]');

  const readVariables = () => {
    const computed = globalThis.getComputedStyle?.(root);
    const read = (name) => computed?.getPropertyValue(name).trim() || '';
    return {
      handleSize: read('--selection-handle-size') || '9px',
      outline: read('--selection-outline-color') || '#0078d4',
      activeColor: read('--selection-outline-active-color') || '#0b3d91',
    };
  };

  // Both frame samples read the same custom properties the canvas overlay uses.
  const apply = () => {
    const { handleSize, outline, activeColor } = readVariables();
    if (handle) handle.style.width = handleSize;
    if (handle) handle.style.height = handleSize;
    if (frame) {
      frame.style.borderColor = outline;
      frame.style.borderWidth = '1px';
    }
    if (active) {
      active.style.borderColor = activeColor;
      // Active state is deliberately the thicker stroke, matching the overlay.
      active.style.borderWidth = '2px';
    }
    if (numericBadge) numericBadge.textContent = handleSize;
  };

  const controls = inputs
    .map((id) => globalThis.document?.getElementById(id))
    .filter(Boolean);
  const listener = () => apply();
  controls.forEach((control) => control.addEventListener('input', listener));
  controls.forEach((control) => control.addEventListener('change', listener));

  apply();

  const destroy = () => {
    controls.forEach((control) => control.removeEventListener('input', listener));
    controls.forEach((control) => control.removeEventListener('change', listener));
  };

  return Object.freeze({ apply, destroy, elements: { handle, frame, active, numericBadge } });
};