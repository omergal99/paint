// js/ui/mirrors/clipboardMirror.js
// Phase 2 step-02 SSOT: Clipboard ribbon group -> RibbonMirror descriptor.
export const clipboardMirrorDescriptor = Object.freeze({
  key: 'clipboard',
  titleKey: 'ribbon.groups.clipboard',
  layout: 'sections',
  visibility: true,
  sections: Object.freeze([
    Object.freeze({
      id: 'actions',
      title: 'Clipboard',
      open: true,
      items: Object.freeze([
        Object.freeze({ kind: 'action', target: 'btn-paste', tag: 'sidebar-mirror-btn-paste' }),
        Object.freeze({ kind: 'action', target: 'btn-cut', tag: 'sidebar-mirror-btn-cut' }),
        Object.freeze({ kind: 'action', target: 'btn-copy', tag: 'sidebar-mirror-btn-copy' }),
      ]),
    }),
  ]),
});
