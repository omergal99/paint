// js/services/clipboard/clipboardService.js
// One entry point for copy / cut / paste, shared by the ribbon buttons, the
// custom keyboard bindings, and the browser's native clipboard events.
//
// Before this module the app had two independent paste paths - the native
// `paste` event (permission-free, works on macOS Safari) and
// `clipboardManager.paste()` (explicit `navigator.clipboard.read`, used by the
// toolbar button and custom bindings) - and copy/cut had no native listener at
// all. Behaviour then depended on which element held focus, so Ctrl+C/Ctrl+V
// "worked unreliably" compared with clicking the ribbon.
//
// The image work itself stays in `ClipboardManager`; this service only decides
// *whether* a clipboard event belongs to Paint or to a text field, and routes
// it to exactly one implementation.

const EDITABLE_TAGS = new Set(['INPUT', 'TEXTAREA', 'SELECT']);

/**
 * True when the event target is a field that should keep its own clipboard
 * behaviour (text boxes, selects, editable regions). Focus is the whole point:
 * the same Ctrl+C means "copy the words" in a field and "copy the pixels" here.
 */
export const isEditableTarget = (target) => {
  if (!target || typeof target !== 'object') return false;
  if (target.isContentEditable) return true;
  const tag = typeof target.tagName === 'string' ? target.tagName.toUpperCase() : '';
  return EDITABLE_TAGS.has(tag);
};

/**
 * @param {object} deps
 * @param {import('../../clipboard/ClipboardManager.js').ClipboardManager} deps.clipboardManager
 * @param {(text: string) => unknown} deps.routeText text-only paste target
 * @param {{flash: (message: string) => void}} deps.statusBar
 * @param {Document} [deps.documentRef]
 */
export const createClipboardService = ({
  clipboardManager,
  routeText = null,
  statusBar = null,
  documentRef = globalThis.document,
} = {}) => {
  if (!clipboardManager) throw new Error('clipboardService requires a ClipboardManager');

  const flash = (message) => statusBar?.flash?.(message);
  let attached = false;

  /** Paste an image carried directly on a native `paste` event. */
  const pasteEventImage = async (event) => {
    const items = event.clipboardData?.items;
    if (!items) return false;
    for (const item of items) {
      if (!item.type.startsWith('image/')) continue;
      const file = item.getAsFile();
      if (!file) continue;
      event.preventDefault();
      try {
        await clipboardManager.insertImageBlob(file, { sourceLabel: 'Pasted' });
      } catch (error) {
        console.error('Paste failed:', error);
        flash('Paste failed - unsupported image data');
      }
      return true;
    }
    return false;
  };

  /**
   * Native `paste` handler. Runs before any permission prompt and works on
   * every OS, which is why Ctrl/Cmd+V stays on this path instead of
   * `navigator.clipboard.read()`.
   */
  const handlePaste = async (event) => {
    if (isEditableTarget(event.target)) return; // let the field paste normally
    if (clipboardManager.pendingInternalPaste && clipboardManager.lastCopiedBlob) {
      event.preventDefault();
      await clipboardManager.pasteLastCopied();
      return;
    }
    if (await pasteEventImage(event)) return;
    // Image-less paste: route text/plain into the text tool instead of doing
    // nothing. Still clipboardData only - Cmd+V never calls clipboard.read().
    const text = event.clipboardData?.getData('text/plain');
    if (text && text.trim()) {
      event.preventDefault();
      await routeText?.(text);
      return;
    }
    if (clipboardManager.pendingInternalPaste && clipboardManager.lastCopiedBlob && clipboardManager.pasteLastCopied) {
      event.preventDefault();
      await clipboardManager.pasteLastCopied();
      return;
    }
    flash('Clipboard has no image to paste');
  };

  /**
   * Native `copy` / `cut`. Without these listeners the browser copies DOM text
   * (or nothing) and Paint's own image copy only ran from the ribbon or a
   * custom binding - the source of the "works unreliably" report.
   */
  const handleCopy = (event) => {
    if (isEditableTarget(event.target)) return;
    event.preventDefault();
    void clipboardManager.copy();
  };

  const handleCut = (event) => {
    if (isEditableTarget(event.target)) return;
    event.preventDefault();
    void clipboardManager.cut();
  };

  const copy = () => clipboardManager.copy();
  const cut = () => clipboardManager.cut();
  // Toolbar buttons and custom bindings use the explicit clipboard-read path;
  // the native event above stays the default for Ctrl/Cmd+V.
  const paste = () => clipboardManager.paste();

  const attach = () => {
    if (attached) return;
    attached = true;
    documentRef?.addEventListener('paste', handlePaste);
    documentRef?.addEventListener('copy', handleCopy);
    documentRef?.addEventListener('cut', handleCut);
  };

  const destroy = () => {
    if (!attached) return;
    attached = false;
    documentRef?.removeEventListener('paste', handlePaste);
    documentRef?.removeEventListener('copy', handleCopy);
    documentRef?.removeEventListener('cut', handleCut);
  };

  return Object.freeze({ attach, destroy, copy, cut, paste, handlePaste, handleCopy, handleCut, isEditableTarget });
};