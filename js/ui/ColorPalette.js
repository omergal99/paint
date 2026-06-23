// js/ui/ColorPalette.js
import { DEFAULT_PALETTE } from '../utils/color.js';

export class ColorPalette {
  constructor({ gridEl, primarySwatchEl, secondarySwatchEl, colorPickerInput, onPrimaryChange, onSecondaryChange }) {
    this.gridEl = gridEl;
    this.primarySwatchEl = primarySwatchEl;
    this.secondarySwatchEl = secondarySwatchEl;
    this.colorPickerInput = colorPickerInput;
    this.onPrimaryChange = onPrimaryChange;
    this.onSecondaryChange = onSecondaryChange;
    this.primary = '#a349a4';
    this.secondary = '#ffffff';

    this._renderGrid();
    this._bindSwatches();
    this.setPrimary(this.primary);
    this.setSecondary(this.secondary);
  }

  _renderGrid() {
    DEFAULT_PALETTE.forEach((hex) => {
      const btn = document.createElement('button');
      btn.style.background = hex;
      btn.title = hex;
      btn.addEventListener('click', () => this.setPrimary(hex));
      btn.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        this.setSecondary(hex);
      });
      this.gridEl.appendChild(btn);
    });
  }

  _bindSwatches() {
    this.primarySwatchEl.addEventListener('click', () => this._openPicker('primary'));
    this.secondarySwatchEl.addEventListener('click', () => this._openPicker('secondary'));
    this.colorPickerInput.addEventListener('input', () => {
      const hex = this.colorPickerInput.value;
      if (this._editing === 'secondary') this.setSecondary(hex);
      else this.setPrimary(hex);
    });
  }

  _openPicker(which) {
    this._editing = which;
    this.colorPickerInput.value = which === 'secondary' ? this.secondary : this.primary;
    this.colorPickerInput.click();
  }

  setPrimary(hex) {
    this.primary = hex;
    this.primarySwatchEl.style.background = hex;
    this.onPrimaryChange?.(hex);
  }

  setSecondary(hex) {
    this.secondary = hex;
    this.secondarySwatchEl.style.background = hex;
    this.onSecondaryChange?.(hex);
  }
}
