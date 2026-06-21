// js/ui/ColorInspector.js
import { rgbToString } from '../utils/color.js';

export class ColorInspector {
  constructor({ swatchEl, rgbEl, hexEl, copyButtons }) {
    this.swatchEl = swatchEl;
    this.rgbEl = rgbEl;
    this.hexEl = hexEl;

    copyButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        const targetId = btn.dataset.copyTarget;
        const text = document.getElementById(targetId).textContent;
        if (text && text !== '—') {
          navigator.clipboard.writeText(text).catch(() => {});
          btn.textContent = '✓';
          setTimeout(() => (btn.textContent = '⧉'), 900);
        }
      });
    });
  }

  show({ r, g, b, hex }) {
    this.swatchEl.style.background = hex;
    this.rgbEl.textContent = rgbToString({ r, g, b });
    this.hexEl.textContent = hex;
  }
}
