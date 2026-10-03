// js/ui/mirrors/imageMirror.js
// Phase 2 step-02 SSOT: Image ribbon group -> RibbonMirror descriptor.
// Adjustment entries route to the shared adjustments dialog.
import { buildSelectionPropertiesPanel } from '../../services/selection/selectionPropertiesPanel.js';
import { mountAdjustmentEntries } from '../AdjustmentEntries.js';
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
      id: 'selection-properties',
      title: 'Selection Properties',
      open: false,
      items: Object.freeze([
        // `mount` runs before the host is attached, so the panel must be appended into
        // the host - replacing it would be a no-op on a parentless node.
        Object.freeze({ kind: 'custom', mount: (host) => { host.dataset.tag = 'sidebar-mirror-selection-properties'; host.append(buildSelectionPropertiesPanel().node); } }),
      ]),
    }),
    Object.freeze({
      id: 'adjustments',
      titleKey: 'ui.adjustments',
      open: false,
      items: Object.freeze([
        Object.freeze({ kind: 'custom', mount: (host) => { host.dataset.tag = 'sidebar-mirror-adjustments'; mountAdjustmentEntries(host); } }),
      ]),
    }),
  ]),
});
