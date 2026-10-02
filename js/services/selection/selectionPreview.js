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
  const doc = host.ownerDocument || globalThis.document;
  host.innerHTML = PREVIEW_TEMPLATE;
  const root = doc?.documentElement;
  const handle = host.querySelector('[data-role="handle"]');
  const frame = host.querySelector('[data-role="frame"]');
  const active = host.querySelector('[data-role="active"]');

  const controlIds = Object.freeze([...inputs]);

  // Delegated on purpose. This panel is mounted detached and only sometimes, so
  // listeners bound to the controls here would miss both the initial build and
  // any later remount. One document-level listener covers every instance.
  const readVariables = () => {
    const computed = globalThis.getComputedStyle?.(root);
    const read = (name) => computed?.getPropertyValue(name).trim() || '';
    const valueOf = (id, fallback) => doc?.getElementById?.(id)?.value || read(fallback);
    // Read the control the user is dragging first: the settings module writes the
    // custom properties from its own delegated listener, and ordering between two
    // document-level listeners is not guaranteed, so the variable may still hold
    // the previous value while dragging.
    return {
      handleSize: doc?.getElementById?.(controlIds[0])
        ? `${doc.getElementById(controlIds[0]).value}px`
        : (read('--selection-handle-size') || '9px'),
      outline: valueOf(controlIds[1], '--selection-outline-color') || '#0078d4',
      activeColor: valueOf(controlIds[2], '--selection-outline-active-color') || '#0b3d91',
    };
  };

  // Both frame samples read the same custom properties the canvas overlay uses.
  const apply = () => {
    const { handleSize, outline, activeColor } = readVariables();
    if (handle) {
      handle.style.width = handleSize;
      handle.style.height = handleSize;
    }
    if (frame) {
      frame.style.borderColor = outline;
      frame.style.borderWidth = '1px';
    }
    if (active) {
      active.style.borderColor = activeColor;
      // Active state is deliberately the thicker stroke, matching the overlay.
      active.style.borderWidth = '2px';
    }
  };

  const isTrackedControl = (target) => Boolean(target?.id) && controlIds.includes(target.id);
  const listener = (event) => { if (isTrackedControl(event.target)) apply(); };
  doc?.addEventListener('input', listener);
  doc?.addEventListener('change', listener);

  apply();

  const destroy = () => {
    doc?.removeEventListener('input', listener);
    doc?.removeEventListener('change', listener);
  };

  return Object.freeze({ apply, destroy, elements: { handle, frame, active } });
};