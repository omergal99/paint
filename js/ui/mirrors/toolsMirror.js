// js/ui/mirrors/toolsMirror.js
// Phase 2 step-03 SSOT: Tools ribbon group -> RibbonMirror descriptor (tabs).
// Drawing mirrors the quick tools, the shared line size, and the fill modes;
// Advanced is the reserved mount point for Phase 5 brush options (note only).
import { t } from '../../i18n/messages.js';
import { createLineSizeSlider } from './lineSizeControl.js';

const QUICK_TOOL_TAGS = Object.freeze([
  'tool-pencil', 'tool-brush', 'tool-fill', 'tool-eraser',
  'tool-text', 'tool-eyedropper', 'tool-zoom',
]);
const FILLMODE_TAGS = Object.freeze(['fillmode-outline', 'fillmode-outline-fill', 'fillmode-fill']);

export const toolsMirrorDescriptor = Object.freeze({
  key: 'tools',
  titleKey: 'ribbon.groups.tools',
  layout: 'tabs',
  visibility: true,
  sections: Object.freeze([
    Object.freeze({
      id: 'drawing',
      titleKey: 'ui.mirrorDrawing',
      open: true,
      items: Object.freeze([
        ...QUICK_TOOL_TAGS.map((targetTag) => Object.freeze({ kind: 'action', targetTag, tag: `sidebar-mirror-${targetTag}` })),
        createLineSizeSlider({ tag: 'sidebar-mirror-line-size' }),
        ...FILLMODE_TAGS.map((targetTag) => Object.freeze({ kind: 'action', targetTag, tag: `sidebar-mirror-${targetTag}` })),
      ]),
    }),
    Object.freeze({
      id: 'advanced',
      titleKey: 'ui.mirrorAdvanced',
      open: false,
      items: Object.freeze([
        Object.freeze({
          kind: 'custom',
          mount: (host) => {
            host.dataset.tag = 'sidebar-mirror-advanced-note';
            host.classList.add('mirror-note');
            host.textContent = t('ui.mirrorAdvancedNote');
            host.setAttribute('data-i18n-runtime', 'ui.mirrorAdvancedNote');
          },
        }),
      ]),
    }),
  ]),
});