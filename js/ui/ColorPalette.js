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
    
    // Load saved colors from localStorage or use defaults
    const savedColors = this._loadSavedColors();
    this.palette = this._normalizePalette(savedColors.palette || DEFAULT_PALETTE);
    this.defaultPrimary = savedColors.defaultPrimary || '#a349a4';
    this.primary = savedColors.primary || this.defaultPrimary;
    this.secondary = savedColors.secondary || '#ffffff';

    this._renderGrid();
    this._bindSwatches();
    this.setPrimary(this.primary);
    this.setSecondary(this.secondary);
  }

  _renderGrid() {
    this.gridEl.innerHTML = '';
    this.palette.forEach((hex) => {
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
    this._saveColors();
    this.onPrimaryChange?.(hex);
  }

  setSecondary(hex) {
    this.secondary = hex;
    this.secondarySwatchEl.style.background = hex;
    this._saveColors();
    this.onSecondaryChange?.(hex);
  }

  getPalette() {
    return [...this.palette];
  }

  setPalette(colors) {
    const next = this._normalizePalette(colors);
    if (!next.length) return;
    this.palette = next;
    this._renderGrid();
    this._saveColors();
  }

  setDefaultPrimary(hex) {
    if (!/^#[0-9a-f]{6}$/i.test(hex)) return;
    this.defaultPrimary = hex.toLowerCase();
    this._saveColors();
  }

  resetToDefaults() {
    this.palette = [...DEFAULT_PALETTE];
    this.defaultPrimary = '#a349a4';
    this.primary = this.defaultPrimary;
    this.secondary = '#ffffff';
    this._renderGrid();
    this.primarySwatchEl.style.background = this.primary;
    this.secondarySwatchEl.style.background = this.secondary;
    this._saveColors();
    this.onPrimaryChange?.(this.primary);
    this.onSecondaryChange?.(this.secondary);
  }

  _normalizePalette(colors) {
    if (!Array.isArray(colors)) return [...DEFAULT_PALETTE];
    const valid = colors.filter((hex) => typeof hex === 'string' && /^#[0-9a-f]{6}$/i.test(hex));
    return valid.length ? valid.map((hex) => hex.toLowerCase()) : [...DEFAULT_PALETTE];
  }

  _saveColors() {
    try {
      localStorage.setItem('paint:colors', JSON.stringify({
        primary: this.primary,
        secondary: this.secondary,
        defaultPrimary: this.defaultPrimary,
        palette: this.palette,
      }));
    } catch (err) {
      console.warn('Unable to save colors:', err);
    }
  }

  _loadSavedColors() {
    try {
      const saved = localStorage.getItem('paint:colors');
      return saved ? JSON.parse(saved) : {};
    } catch (err) {
      console.warn('Unable to load colors:', err);
      return {};
    }
  }
}
