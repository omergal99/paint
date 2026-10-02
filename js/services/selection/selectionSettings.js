// js/services/selection/selectionSettings.js
// Selection appearance controls (Sidebar ▸ Image ▸ Selection Properties, and
// Settings ▸ Image when present).
//
// Each control declares the CSS custom property it owns with `data-css-var`, so
// the list of properties, their defaults and the reset button all come from one
// table. The canvas overlay and the live preview both read the same variables,
// which is what keeps "what the preview shows" identical to "what the canvas
// shows".

export const SELECTION_APPEARANCE_DEFAULTS = Object.freeze({
  '--selection-handle-size': '9px',
  '--selection-outline-color': '#0078d4',
  '--selection-outline-active-color': '#0b3d91',
});

/** Apply one `<input data-css-var="...">` to the root element. */
export const applyCssVariable = (root, input) => {
  const property = input?.dataset?.cssVar;
  if (!root || !property) return false;
  const unit = input.dataset.cssUnit || '';
  root.style.setProperty(property, `${input.value}${unit}`);
  return true;
};

const readRootProperty = (root, property) =>
  root?.style?.getPropertyValue(property)?.trim()
  || (globalThis.getComputedStyle ? globalThis.getComputedStyle(root).getPropertyValue(property).trim() : '');

export const createSelectionSettings = ({
  root = globalThis.document?.documentElement,
  documentRef = globalThis.document,
  onChange = null,
} = {}) => {
  const inputs = [...(documentRef?.querySelectorAll?.('[data-css-var]') || [])];
  const previewToggle = documentRef?.getElementById('setting-selection-preview');
  const valueBadge = documentRef?.getElementById('selection-handle-size-value');
  const resetButton = documentRef?.getElementById('setting-selection-reset');

  // Paint every control with the current value so the UI opens on live state,
  // not on the markup defaults.
  const syncFromRoot = () => {
    for (const [property, fallback] of Object.entries(SELECTION_APPEARANCE_DEFAULTS)) {
      if (!readRootProperty(root, property)) root?.style?.setProperty(property, fallback);
    }
    inputs.forEach((input) => {
      const property = input.dataset.cssVar;
      const current = readRootProperty(root, property) || SELECTION_APPEARANCE_DEFAULTS[property];
      if (property.includes('size')) input.value = String(parseInt(current, 10) || 9);
      else input.value = current;
    });
    updateBadge();
  };

  const updateBadge = () => {
    if (!valueBadge) return;
    const size = readRootProperty(root, '--selection-handle-size') || '9px';
    valueBadge.textContent = size;
  };

  const handleChange = (event) => {
    applyCssVariable(root, event.target);
    updateBadge();
    onChange?.(event.target);
  };

  // Reset clears the per-session inline overrides and repaints the defaults, so
  // "Reset" and "what a fresh install looks like" are the same state.
  const resetToDefaults = () => {
    for (const [property, value] of Object.entries(SELECTION_APPEARANCE_DEFAULTS)) {
      root?.style?.removeProperty(property);
      root?.style?.setProperty(property, value);
    }
    syncFromRoot();
    onChange?.(null);
  };

  const start = () => {
    syncFromRoot();
    inputs.forEach((input) => {
      input.addEventListener('input', handleChange);
      input.addEventListener('change', handleChange);
    });
    previewToggle?.addEventListener('change', onChange);
    resetButton?.addEventListener('click', resetToDefaults);
  };

  const destroy = () => {
    inputs.forEach((input) => {
      input.removeEventListener('input', handleChange);
      input.removeEventListener('change', handleChange);
    });
    previewToggle?.removeEventListener('change', onChange);
    resetButton?.removeEventListener('click', resetToDefaults);
  };

  return Object.freeze({ start, destroy, resetToDefaults, previewToggle, inputs, valueBadge });
};