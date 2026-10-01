// js/ui/mirrors/historyMirror.js
// Phase 2 step-03 SSOT: History ribbon group -> RibbonMirror descriptor.
// Disabled state mirrors btn-undo/btn-redo through RibbonMirror.sync(),
// which Sidebar re-runs from the history manager's onChange callback.
export const historyMirrorDescriptor = Object.freeze({
  key: 'history',
  titleKey: 'ribbon.groups.history',
  layout: 'sections',
  visibility: true,
  sections: Object.freeze([
    Object.freeze({
      id: 'undo-redo',
      titleKey: 'history.title',
      open: true,
      items: Object.freeze([
        Object.freeze({ kind: 'action', target: 'btn-undo', tag: 'sidebar-mirror-btn-undo' }),
        Object.freeze({ kind: 'action', target: 'btn-redo', tag: 'sidebar-mirror-btn-redo' }),
        Object.freeze({ kind: 'action', target: 'btn-history-panel', tag: 'sidebar-mirror-btn-history-panel' }),
      ]),
    }),
  ]),
});