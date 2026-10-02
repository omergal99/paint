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
  const controls = () => [...(documentRef?.querySelectorAll?.('[data-css-var]') || [])];
  const previewToggle = () => documentRef?.getElementById('setting-selection-preview');
  const valueBadge = () => documentRef?.getElementById('selection-handle-size-value');

  const updateBadge = () => {
    const badge = valueBadge();
    if (!badge) return;
    badge.textContent = readRootProperty(root, '--selection-handle-size') || '9px';
  };

  // Paint every control with the current value so the UI opens on live state,
  // not on the markup defaults.
  const syncFromRoot = () => {
    for (const [property, fallback] of Object.entries(SELECTION_APPEARANCE_DEFAULTS)) {
      if (!readRootProperty(root, property)) root?.style?.setProperty(property, fallback);
    }
    for (const input of controls()) {
      const property = input.dataset.cssVar;
      const current = readRootProperty(root, property) || SELECTION_APPEARANCE_DEFAULTS[property];
      input.value = property.includes('size') ? String(parseInt(current, 10) || 9) : current;
    }
    updateBadge();
  };

  // These panels are built lazily (the Image sidebar mirror mounts on first
  // open), so per-element listeners bound at start would miss every control
  // that does not exist yet. One delegated listener covers panels mounted at
  // any time, which is what makes the slider actually reach the canvas.
  const handleControlInput = (event) => {
    const target = event.target;
    if (!target?.matches?.('[data-css-var]')) return;
    applyCssVariable(root, target);
    updateBadge();
    onChange?.(target);
  };

  const handleReset = (event) => {
    const target = event.target;
    if (!target?.closest?.('#setting-selection-reset')) return;
    for (const [property, value] of Object.entries(SELECTION_APPEARANCE_DEFAULTS)) {
      root?.style?.removeProperty(property);
      root?.style?.setProperty(property, value);
    }
    syncFromRoot();
    onChange?.(null);
  };

  const handlePreviewToggle = (event) => {
    if (event.target?.id !== 'setting-selection-preview') return;
    onChange?.(event.target);
  };

  const start = () => {
    syncFromRoot();
    documentRef?.addEventListener('input', handleControlInput);
    documentRef?.addEventListener('change', handleControlInput);
    documentRef?.addEventListener('click', handleReset);
    documentRef?.addEventListener('change', handlePreviewToggle);
  };

  const destroy = () => {
    documentRef?.removeEventListener('input', handleControlInput);
    documentRef?.removeEventListener('change', handleControlInput);
    documentRef?.removeEventListener('click', handleReset);
    documentRef?.removeEventListener('change', handlePreviewToggle);
  };

  return Object.freeze({ start, destroy, syncFromRoot, controls, previewToggle, valueBadge });
};