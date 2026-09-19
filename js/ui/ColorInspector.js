// js/ui/ColorInspector.js
import { rgbToString } from '../utils/color.js';

export const createColorInspector = ({ swatchEl, rgbEl, hexEl, copyButtons }) => {
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

  const show = ({ r, g, b, hex }) => {
    swatchEl.style.background = hex;
    rgbEl.textContent = rgbToString({ r, g, b });
    hexEl.textContent = hex;
  }

  return Object.freeze({ show });
}
