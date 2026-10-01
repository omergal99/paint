// js/ui/mirrors/colorsMirror.js
// Phase 2 step-03 SSOT: Colors ribbon group -> RibbonMirror descriptor.
// Alpha sliders write the ribbon's own #primary-alpha / #secondary-alpha
// inputs (`input` event), so palette state, canvasManager, the inspector
// event, and the mirror always share one source; no color state lives here.
import { t } from '../../i18n/messages.js';
const createAlphaSlider = ({ id, tag, labelKey }) => Object.freeze({
  kind: 'slider',
  tag,
  labelKey,
  min: 0,
  max: 100,
  unit: '%',
  get: () => {
    const value = Number(document.getElementById(id)?.value);
    return Number.isFinite(value) ? value : 100;
  },
  set: (value) => {
    const input = document.getElementById(id);
    if (!input) return;
    input.value = String(value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  },
});

export const colorsMirrorDescriptor = Object.freeze({
  key: 'colors',
  titleKey: 'ribbon.groups.colors',
  layout: 'sections',
  visibility: true,
  sections: Object.freeze([
    Object.freeze({
      id: 'opacity',
      titleKey: 'ui.mirrorOpacity',
      open: true,
      items: Object.freeze([
        createAlphaSlider({ id: 'primary-alpha', tag: 'sidebar-mirror-primary-alpha', labelKey: 'ui.foreground' }),
        Object.freeze({ kind: 'action', target: 'primary-alpha-transparent', tag: 'sidebar-mirror-primary-transparent' }),
        createAlphaSlider({ id: 'secondary-alpha', tag: 'sidebar-mirror-secondary-alpha', labelKey: 'ui.background' }),
        Object.freeze({ kind: 'action', target: 'secondary-alpha-transparent', tag: 'sidebar-mirror-secondary-transparent' }),
        Object.freeze({
          kind: 'custom',
          mount: (host) => {
            host.dataset.tag = 'sidebar-mirror-colors-adjustments';
            host.classList.add('mirror-note');
            host.textContent = t('ui.mirrorAdjustmentsNote');
            host.setAttribute('data-i18n-runtime', 'ui.mirrorAdjustmentsNote');
          },
        }),
      ]),
    }),
  ]),
});