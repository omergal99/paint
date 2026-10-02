// js/services/selection/selectionSettings.js
// Settings ▸ Image controls for the selection overlay.
//
// These write CSS custom properties on :root instead of pushing values through
// the canvas: the overlay reads them with getComputedStyle, so the stylesheet
// stays the single place that decides how a handle looks, and a colour change
// costs no redraw.

const APPEARANCE_DEFAULTS = Object.freeze({
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

export const createSelectionSettings = ({
  root = globalThis.document?.documentElement,
  onChange = null,
} = {}) => {
  const inputs = [...(globalThis.document?.querySelectorAll?.('[data-css-var]') || [])];
  const previewToggle = globalThis.document?.getElementById('setting-selection-preview');

  const syncFromRoot = () => {
    for (const [property, fallback] of Object.entries(APPEARANCE_DEFAULTS)) {
      const value = root?.style?.getPropertyValue(property)?.trim();
      if (!value) root?.style?.setProperty(property, fallback);
    }
  };

  const handleChange = (event) => {
    applyCssVariable(root, event.target);
    onChange?.(event.target);
  };

  const start = () => {
    syncFromRoot();
    inputs.forEach((input) => {
      const property = input.dataset.cssVar;
      const current = root?.style?.getPropertyValue(property)?.trim()
        || getComputedStyle(root).getPropertyValue(property).trim();
      if (current) input.value = property.includes('size') ? String(parseInt(current, 10) || 9) : current;
      input.addEventListener('input', handleChange);
      input.addEventListener('change', handleChange);
    });
    previewToggle?.addEventListener('change', onChange);
  };

  const destroy = () => {
    inputs.forEach((input) => {
      input.removeEventListener('input', handleChange);
      input.removeEventListener('change', handleChange);
    });
    previewToggle?.removeEventListener('change', onChange);
  };

  return Object.freeze({ start, destroy, previewToggle, inputs });
};