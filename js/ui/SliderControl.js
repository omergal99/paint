// js/ui/SliderControl.js
// Reusable labeled range-slider control (no framework).
// Used for font/line size today; reuse anywhere via createSliderControl().
//
//   import { createSliderControl } from './SliderControl.js';
//   const slider = createSliderControl({
//     min: 1, max: 120, value: 12,
//     label: 'Size', unit: 'px', ariaLabel: 'Font size',
//   });
//   slider.onInput = (val) => applySize(val);
//   container.prepend(slider.element);

export const createSliderControl = ({
  min = 1,
  max = 120,
  value = 12,
  label = '',
  unit = 'px',
  ariaLabel = 'Value slider',
  id = '',
} = {}) => {
  const wrap = document.createElement('div');
  wrap.className = 'slider-control';

  const top = document.createElement('div');
  top.className = 'slider-control-top';

  const labelEl = document.createElement('span');
  labelEl.className = 'slider-control-label';
  labelEl.textContent = label;

  const valueEl = document.createElement('span');
  valueEl.className = 'slider-control-value';

  const input = document.createElement('input');
  input.type = 'range';
  input.className = 'slider-control-input';
  input.min = String(min);
  input.max = String(max);
  input.value = String(value);
  input.setAttribute('aria-label', ariaLabel);
  if (id) input.id = id;

  const render = () => { valueEl.textContent = `${input.value}${unit}`; };
  render();

  const api = {
    element: wrap,
    input,
    valueEl,
    onInput: null,
    getValue: () => Number(input.value),
    setValue: (v, emit = false) => {
      const n = Math.max(min, Math.min(max, Number(v) || min));
      input.value = String(n);
      render();
      if (emit) api.onInput?.(n);
    },
  };

  input.addEventListener('input', () => {
    render();
    api.onInput?.(Number(input.value));
  });

  if (label) top.append(labelEl, valueEl);
  else top.append(valueEl);
  wrap.append(top, input);
  return api;
}
