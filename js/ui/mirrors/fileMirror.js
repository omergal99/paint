// js/ui/mirrors/fileMirror.js
// Phase 2 step-02 SSOT: File ribbon group -> RibbonMirror descriptor.
// Actions click the ribbon control; no state lives here.
export const fileMirrorDescriptor = Object.freeze({
  key: 'file',
  titleKey: 'ribbon.groups.file',
  layout: 'sections',
  visibility: true,
  sections: Object.freeze([
    Object.freeze({
      id: 'document',
      title: 'Document',
      open: true,
      items: Object.freeze([
        Object.freeze({ kind: 'action', target: 'btn-new', tag: 'sidebar-mirror-btn-new' }),
        Object.freeze({ kind: 'action', target: 'btn-open', tag: 'sidebar-mirror-btn-open' }),
        Object.freeze({ kind: 'action', target: 'btn-import', tag: 'sidebar-mirror-btn-import' }),
      ]),
    }),
    Object.freeze({
      id: 'export',
      title: 'Export',
      open: false,
      items: Object.freeze([
        Object.freeze({ kind: 'action', target: 'btn-save', tag: 'sidebar-mirror-btn-save' }),
        Object.freeze({ kind: 'action', target: 'btn-manage-workspace', tag: 'sidebar-mirror-btn-manage-workspace' }),
      ]),
    }),
  ]),
});
