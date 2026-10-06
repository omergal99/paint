// js/app/canvasContextMenu.js
// Right-click menu for the paint area (.canvas-viewport).
//
// Split gesture contract (see RIGHT_DRAG_THRESHOLD_PX): a right press only
// opens this menu when the pointer stays within the drag threshold - a
// right-drag stays a tool gesture (secondary-colour painting) and never opens
// the menu. ToolManager defers its right-button onDown with the same shared
// threshold, so a plain right-click reaches the menu without the tool having
// fired first.
//
// The menu is a thin view: Cut/Copy/Paste/Select All run through the same
// commandRegistry actions as the ribbon and the keyboard, and the Save-as
// entries call the same saveImageAs flow (optionally scoped to the selection).
import { RIGHT_DRAG_THRESHOLD_PX, SHORTCUT_ACTIONS } from '../core/constants.js';

const COMMAND_BY_ACTION = Object.freeze({
  cut: SHORTCUT_ACTIONS.cut,
  copy: SHORTCUT_ACTIONS.copy,
  paste: SHORTCUT_ACTIONS.paste,
  selectAll: SHORTCUT_ACTIONS.selectAll,
});

/** @param {object} deps collaborators owned by main.js */
export const initCanvasContextMenu = ({
  viewport = null,
  menu = null,
  execute = null,
  saveAs = null,
  getSelection = null,
  documentRef = globalThis.document,
} = {}) => {
  if (!viewport || !menu) return Object.freeze({ destroy: () => {} });

  // Gesture bookkeeping: the menu opens on pointer-up of a clean right click.
  // `contextmenu` only suppresses the native browser menu, so the rule works
  // the same on platforms that fire it before or after pointer-up.
  let gesture = null;

  const hasSelection = () => {
    const region = typeof getSelection === 'function' ? getSelection() : null;
    return Boolean(region && region.w && region.h);
  };

  const openMenuAt = (x, y) => {
    documentRef.dispatchEvent(new CustomEvent('paint:action-menu-open-at', {
      detail: { menu, x, y },
    }));
    menu.querySelector('.action-menu-items button:not([disabled])')?.focus();
  };

  const onPointerDown = (event) => {
    gesture = event.button === 2
      ? { pointerId: event.pointerId, x: event.clientX, y: event.clientY, dragged: false }
      : null;
  };

  const onPointerMove = (event) => {
    if (!gesture || event.pointerId !== gesture.pointerId || gesture.dragged) return;
    const moved = Math.hypot(event.clientX - gesture.x, event.clientY - gesture.y);
    if (moved >= RIGHT_DRAG_THRESHOLD_PX) gesture.dragged = true;
  };

  const onPointerEnd = (event) => {
    if (!gesture || event.pointerId !== gesture.pointerId) return;
    const ended = gesture;
    gesture = null;
    // Right drag (or a cancelled pointer): the tool owns the gesture.
    if (event.type === 'pointercancel' || ended.dragged) return;
    openMenuAt(event.clientX, event.clientY);
  };

  const onContextMenu = (event) => event.preventDefault();

  const onClick = (event) => {
    const target = event.target instanceof Element ? event.target : null;
    if (!target || !menu.contains(target)) return;
    const formatOption = target.closest('[data-export-format]');
    if (formatOption) {
      const selectionScope = formatOption.dataset.exportScope === 'selection';
      if (selectionScope && !hasSelection()) return;
      void saveAs?.(formatOption.dataset.exportFormat, selectionScope ? { region: getSelection() } : {});
      return;
    }
    const actionButton = target.closest('[data-canvas-action]');
    if (!actionButton || actionButton.disabled) return;
    const command = COMMAND_BY_ACTION[actionButton.dataset.canvasAction];
    if (command) execute?.(command);
  };

  viewport.addEventListener('pointerdown', onPointerDown);
  viewport.addEventListener('pointermove', onPointerMove);
  viewport.addEventListener('pointerup', onPointerEnd);
  viewport.addEventListener('pointercancel', onPointerEnd);
  viewport.addEventListener('contextmenu', onContextMenu);
  menu.addEventListener('contextmenu', onContextMenu);
  menu.addEventListener('click', onClick);

  const destroy = () => {
    viewport.removeEventListener('pointerdown', onPointerDown);
    viewport.removeEventListener('pointermove', onPointerMove);
    viewport.removeEventListener('pointerup', onPointerEnd);
    viewport.removeEventListener('pointercancel', onPointerEnd);
    viewport.removeEventListener('contextmenu', onContextMenu);
    menu.removeEventListener('contextmenu', onContextMenu);
    menu.removeEventListener('click', onClick);
    gesture = null;
  };

  return Object.freeze({ destroy });
};