// js/ui/mirrors/imageMirror.js
// Phase 2 step-02 SSOT: Image ribbon group -> RibbonMirror descriptor.
// Adjustments section is a placeholder deep-link to Phase 4 (no engine here).
import { t } from '../../i18n/messages.js';
export const imageMirrorDescriptor = Object.freeze({
  key: 'image',
  titleKey: 'ribbon.groups.image',
  layout: 'sections',
  visibility: true,
  sections: Object.freeze([
    Object.freeze({
      id: 'select-resize',
      title: 'Select & size',
      open: true,
      items: Object.freeze([
        Object.freeze({ kind: 'action', target: 'btn-canvas-size', tag: 'sidebar-mirror-btn-canvas-size' }),
        Object.freeze({ kind: 'action', target: 'btn-crop', tag: 'sidebar-mirror-btn-crop' }),
        Object.freeze({ kind: 'action', target: 'btn-image-more', tag: 'sidebar-mirror-btn-image-more' }),
      ]),
    }),
    Object.freeze({
      id: 'adjustments',
      title: 'Adjustments',
      open: false,
      items: Object.freeze([
        Object.freeze({ kind: 'custom', mount: (host) => { host.dataset.tag = 'sidebar-mirror-adjustments-placeholder'; host.textContent = t('ui.mirrorAdjustmentsNote'); host.setAttribute('data-i18n-runtime', 'ui.mirrorAdjustmentsNote'); } }),
      ]),
    }),
  ]),
});
