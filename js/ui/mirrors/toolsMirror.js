// js/ui/mirrors/toolsMirror.js
// Phase 2 step-03 SSOT: Tools ribbon group -> RibbonMirror descriptor (tabs).
// Drawing mirrors the quick tools, the shared line size, and the fill modes;
// Advanced hosts the state-backed Brush controls and settings entry point.
import { createLineSizeSlider } from './lineSizeControl.js';
import { createBrushStudioPanel } from '../BrushStudioPanel.js';

const QUICK_TOOL_TAGS = Object.freeze([
  'tool-pencil', 'tool-brush', 'tool-fill', 'tool-eraser',
  'tool-text', 'tool-eyedropper', 'tool-zoom',
]);
const FILLMODE_TAGS = Object.freeze(['fillmode-outline', 'fillmode-outline-fill', 'fillmode-fill']);

export const toolsMirrorDescriptor = ({ brushState, getPrimaryColor, setPrimaryColor } = {}) => Object.freeze({
  key: 'tools',
  titleKey: 'ribbon.groups.tools',
  layout: 'tabs',
  visibility: true,
  sections: [
    {
      id: 'drawing',
      titleKey: 'ui.mirrorDrawing',
      open: true,
      items: [
        ...QUICK_TOOL_TAGS.map((targetTag) => Object.freeze({ kind: 'action', targetTag, tag: `sidebar-mirror-${targetTag}` })),
        createLineSizeSlider({ tag: 'sidebar-mirror-line-size' }),
        ...FILLMODE_TAGS.map((targetTag) => Object.freeze({ kind: 'action', targetTag, tag: `sidebar-mirror-${targetTag}` })),
      ],
    },
    {
      id: 'advanced',
      titleKey: 'ui.mirrorAdvanced',
      open: false,
      items: [
        {
          kind: 'custom',
          mount: (host) => {
            host.dataset.tag = 'sidebar-mirror-brush-heading';
            host.classList.add('brush-studio-heading');
            const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            icon.setAttribute('viewBox', '0 0 20 20');
            icon.setAttribute('class', 'icon size4');
            icon.setAttribute('aria-hidden', 'true');
            const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            path.setAttribute('d', 'M5.5 2h9v9a3 3 0 0 1-3 3H9v2a2 2 0 0 1-4 0V2Z');
            path.setAttribute('fill', 'none');
            path.setAttribute('stroke', 'currentColor');
            icon.append(path);
            const title = document.createElement('strong');
            title.textContent = 'Brush';
            title.setAttribute('data-i18n-runtime', 'ui.brushStudio');
            host.append(icon, title);
          },
        },
        createBrushStudioPanel({ brushState, getPrimaryColor, setPrimaryColor }),
        Object.freeze({ kind: 'action', target: 'btn-settings', tag: 'sidebar-mirror-brush-settings' }),
      ],
    },
  ],
});