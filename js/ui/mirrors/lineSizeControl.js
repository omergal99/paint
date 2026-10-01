// js/ui/mirrors/lineSizeControl.js
// Phase 2 step-03 SSOT: the shared drawing/text size slider. The ribbon's
// #custom-line-size input is the single writer (Toolbar._bindLineSize feeds
// both line width and font size), so the mirror writes through its `input`
// event instead of keeping a second size value.
export const createLineSizeSlider = ({ tag, labelKey = 'ui.mirrorLineSize' } = {}) => Object.freeze({
  kind: 'slider',
  tag,
  labelKey,
  min: 1,
  max: 300,
  unit: 'px',
  get: () => {
    const value = Number(document.getElementById('custom-line-size')?.value);
    return Number.isFinite(value) && value >= 1 ? value : 3;
  },
  set: (value) => {
    const input = document.getElementById('custom-line-size');
    if (!input) return;
    input.value = String(value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  },
});