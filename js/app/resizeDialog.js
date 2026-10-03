// js/app/resizeDialog.js
// Resize-canvas dialog: presets, aspect lock, percent, and the selection-vs-
// canvas target rule. Extracted from main.js (Phase 3 modularisation) with the
// collaborators injected, so this module owns only its dialog and never reaches
// for a global.
import { assessImageAdmission } from '../storage/ImageAdmission.js';
import { scaleCanvas } from '../utils/transform.js';
import { router } from './router.js';
import { t } from '../i18n/messages.js';

export const initResizeDialog = ({
  canvasManager,
  historyManager,
  statusBar,
  setSelection,
  commitFloatingSelection,
  persistSession,
  setDialogUrl,
}) => {
  const resizeDialog = document.getElementById('resize-dialog');
  const resizeWidthInput = document.getElementById('resize-width');
  const resizeHeightInput = document.getElementById('resize-height');
  const resizePercentInput = document.getElementById('resize-percent');
  const resizeTargetStatus = document.getElementById('resize-target-status');
  const resizeSummary = document.getElementById('resize-summary');
  const keepAspectInput = document.getElementById('resize-keep-aspect');
  let aspectRatio = 1;
  let resizeTarget = { kind: 'canvas', x: 0, y: 0, width: 800, height: 600 };

  const activeResizeTarget = () => {
    const selection = canvasManager.selection;
    if (selection?.w > 0 && selection?.h > 0) {
      return {
        kind: 'selection',
        x: selection.x,
        y: selection.y,
        width: selection.w,
        height: selection.h,
      };
    }
    return { kind: 'canvas', x: 0, y: 0, width: canvasManager.width, height: canvasManager.height };
  };

  const syncResizePercent = () => {
    if (!resizePercentInput || !resizeTarget.width) return;
    const width = Number(resizeWidthInput.value);
    resizePercentInput.value = String(Math.max(1, Math.round((width / resizeTarget.width) * 100)));
  };

  const updateResizeSummary = () => {
    if (!resizeSummary) return;
    resizeSummary.textContent = t('ui.resizeSummary', {
      currentWidth: resizeTarget.width,
      currentHeight: resizeTarget.height,
      newWidth: Number(resizeWidthInput.value) || 0,
      newHeight: Number(resizeHeightInput.value) || 0,
    });
  };

  const setResizeTargetFields = () => {
    resizeWidthInput.value = resizeTarget.width;
    resizeHeightInput.value = resizeTarget.height;
    aspectRatio = resizeTarget.width / Math.max(1, resizeTarget.height);
    keepAspectInput.checked = true;
    resizePercentInput.value = '100';
    if (resizeTargetStatus) {
      resizeTargetStatus.textContent = resizeTarget.kind === 'selection'
        ? `Selection ${resizeTarget.width} × ${resizeTarget.height}px`
        : 'Whole canvas';
    }
    updateResizeSummary();
  };

  const openResizeDialog = () => {
    resizeTarget = activeResizeTarget();
    setResizeTargetFields();
    resizeDialog.showModal();
    setDialogUrl('resize');
  };

  document.querySelectorAll('[data-resize-preset]').forEach((button) => {
    button.addEventListener('click', () => {
      const [width, height] = button.dataset.resizePreset.split('x').map(Number);
      resizeWidthInput.value = width;
      resizeHeightInput.value = height;
      syncResizePercent();
      updateResizeSummary();
      document.querySelectorAll('[data-resize-preset]').forEach((item) => item.classList.toggle('selected', item === button));
    });
  });

  resizeWidthInput.addEventListener('input', () => {
    if (keepAspectInput.checked) resizeHeightInput.value = Math.round(resizeWidthInput.value / aspectRatio);
    syncResizePercent();
    updateResizeSummary();
  });
  resizeHeightInput.addEventListener('input', () => {
    if (keepAspectInput.checked) resizeWidthInput.value = Math.round(resizeHeightInput.value * aspectRatio);
    syncResizePercent();
    updateResizeSummary();
  });
  resizePercentInput.addEventListener('input', () => {
    const percent = Math.max(1, Math.min(1000, Number(resizePercentInput.value) || 100));
    resizePercentInput.value = String(percent);
    resizeWidthInput.value = Math.max(1, Math.round(resizeTarget.width * percent / 100));
    resizeHeightInput.value = Math.max(1, Math.round(resizeTarget.height * percent / 100));
    updateResizeSummary();
  });

  document.getElementById('resize-cancel').addEventListener('click', () => resizeDialog.close());
  resizeDialog.addEventListener('close', () => {
    if (router.param('dialog') === 'resize') setDialogUrl(null);
  });
  document.getElementById('resize-form').addEventListener('submit', () => {
    const w = parseInt(resizeWidthInput.value, 10);
    const h = parseInt(resizeHeightInput.value, 10);
    if (w > 0 && h > 0) {
      const requiredWidth = resizeTarget.kind === 'selection'
        ? Math.max(canvasManager.width, resizeTarget.x + w)
        : w;
      const requiredHeight = resizeTarget.kind === 'selection'
        ? Math.max(canvasManager.height, resizeTarget.y + h)
        : h;
      const admission = assessImageAdmission({
        width: w,
        height: h,
        targetWidth: requiredWidth,
        targetHeight: requiredHeight,
      });
      if (!admission.ok) {
        statusBar.flash(admission.message);
        return;
      }
      historyManager.snapshot();
      if (resizeTarget.kind === 'selection') {
        const source = canvasManager.floatingCanvas || canvasManager.extractRegion({
          x: resizeTarget.x,
          y: resizeTarget.y,
          w: resizeTarget.width,
          h: resizeTarget.height,
        });
        if (!canvasManager.floatingCanvas) {
          canvasManager.fillRegion({
            x: resizeTarget.x,
            y: resizeTarget.y,
            w: resizeTarget.width,
            h: resizeTarget.height,
          }, canvasManager.backgroundColor);
          canvasManager.floatingCanvas = source;
        }
        if (requiredWidth !== canvasManager.width || requiredHeight !== canvasManager.height) {
          if (!canvasManager.resize(requiredWidth, requiredHeight)) return;
        }
        canvasManager.floatingCanvas = scaleCanvas(source, w, h);
        setSelection({ x: resizeTarget.x, y: resizeTarget.y, w, h });
      } else {
        commitFloatingSelection();
        if (!canvasManager.resize(w, h)) return;
      }
      persistSession();
    }
  });

  return Object.freeze({ openResizeDialog });
};