// Renders the Selection Properties block into the Image sidebar mirror.
// The markup lives here (single definition) and is mounted into the mirror's
// custom host; the settings module then binds behaviour to it by id, so there
// is exactly one set of controls and one owner for their behaviour.
import { createSelectionPreview } from './selectionPreview.js';

export const buildSelectionPropertiesPanel = () => {
  const wrap = document.createElement('div');
  wrap.className = 'selection-properties-panel';
  wrap.innerHTML = `
    <div class="selection-prop-preview" id="selection-prop-preview-host"></div>
    <div class="settings-field">
      <label for="setting-selection-handle-size" data-i18n="ui.selectionHandleSize">Selection handle size</label>
      <span class="selection-prop-row">
        <input type="range" id="setting-selection-handle-size" min="6" max="20" step="1" value="9"
          data-css-var="--selection-handle-size" data-css-unit="px">
        <output id="selection-handle-size-value" class="selection-prop-badge">9px</output>
      </span>
    </div>
    <div class="settings-field">
      <label for="setting-selection-outline-color" data-i18n="ui.selectionOutlineColor">Selection outline color</label>
      <input type="color" id="setting-selection-outline-color" value="#0078d4" data-css-var="--selection-outline-color">
    </div>
    <div class="settings-field">
      <label for="setting-selection-active-color" data-i18n="ui.selectionActiveColor">Active selection outline color</label>
      <input type="color" id="setting-selection-active-color" value="#0b3d91" data-css-var="--selection-outline-active-color">
    </div>
    <div class="menu-checkbox">
      <input type="checkbox" id="setting-selection-preview">
      <label for="setting-selection-preview" data-i18n="ui.selectionPreview">Preview selection without frame</label>
    </div>
    <button type="button" class="btn selection-prop-reset" id="setting-selection-reset"
      data-i18n="ui.selectionReset">Reset to Defaults</button>`;
  // Wire the live preview as soon as the block exists. The settings module is
  // started by main.js; this only keeps the preview bound to the DOM.
  const preview = createSelectionPreview({
    host: wrap.querySelector('#selection-prop-preview-host'),
    inputs: [
      'setting-selection-handle-size',
      'setting-selection-outline-color',
      'setting-selection-active-color',
    ],
  });
  return Object.freeze({ node: wrap, preview });
};