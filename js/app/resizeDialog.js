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
  const resizeForm = document.getElementById('resize-form');
  const resizePresets = [...document.querySelectorAll('[data-resize-preset]')];
  const resizeScalePresets = [...document.querySelectorAll('[data-resize-scale]')];
  let aspectRatio = 1;
  let resizeTarget = { kind: 'canvas', x: 0, y: 0, width: 800, height: 600 };

  const readDraft = (input) => {
    const value = input.value.trim();
    if (!value) return null;
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  };

  const normalizeInput = (input, fallback) => {
    const value = readDraft(input);
    const minimum = Number(input.min) || 1;
    const maximum = Number(input.max) || Number.MAX_SAFE_INTEGER;
    const normalized = Math.min(maximum, Math.max(minimum, Math.round(value ?? fallback)));
    input.value = String(normalized);
    return normalized;
  };

  const setResizeValues = (width, height) => {
    resizeWidthInput.value = String(width);
    resizeHeightInput.value = String(height);
    updateResizeSummary();
    updatePresetSelection();
  };

  const updatePresetSelection = () => {
    const width = readDraft(resizeWidthInput);
    const height = readDraft(resizeHeightInput);
    resizePresets.forEach((button) => {
      const [presetWidth, presetHeight] = button.dataset.resizePreset.split('x').map(Number);
      const selected = width === presetWidth && height === presetHeight;
      button.classList.toggle('selected', selected);
      button.setAttribute('aria-pressed', String(selected));
    });
    resizeScalePresets.forEach((button) => {
      const percent = Number(button.dataset.resizeScale);
      const presetWidth = Math.max(1, Math.round(resizeTarget.width * percent / 100));
      const presetHeight = Math.max(1, Math.round(resizeTarget.height * percent / 100));
      const selected = width === presetWidth && height === presetHeight;
      button.classList.toggle('selected', selected);
      button.setAttribute('aria-pressed', String(selected));
    });
  };

  const activeResizeTarget = () => {
    const selection = canvasManager.selection;
    const isFullCanvas = !selection
      || (canvasManager.isFullCanvasSelection?.(selection)
        ?? (selection.x === 0 && selection.y === 0
          && selection.w === canvasManager.width && selection.h === canvasManager.height));
    if (!isFullCanvas && selection?.w > 0 && selection?.h > 0) {
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
    const width = readDraft(resizeWidthInput);
    if (width === null || width <= 0) return;
    const maximum = Number(resizePercentInput.max) || Number.MAX_SAFE_INTEGER;
    resizePercentInput.value = String(Math.min(maximum, Math.max(1, Math.round((width / resizeTarget.width) * 100))));
  };

  const updateResizeSummary = () => {
    if (!resizeSummary) return;
    const newWidth = readDraft(resizeWidthInput);
    const newHeight = readDraft(resizeHeightInput);
    if (newWidth === null || newHeight === null || newWidth <= 0 || newHeight <= 0) {
      resizeSummary.textContent = '';
      return;
    }
    const unchanged = newWidth === resizeTarget.width && newHeight === resizeTarget.height;
    resizeSummary.textContent = unchanged
      ? t('ui.resizeNoChange', { width: resizeTarget.width, height: resizeTarget.height })
      : t('ui.resizeSummary', {
        currentWidth: resizeTarget.width,
        currentHeight: resizeTarget.height,
        newWidth,
        newHeight,
      });
  };

  const setResizeTargetFields = () => {
    resizeWidthInput.value = resizeTarget.width;
    resizeHeightInput.value = resizeTarget.height;
    aspectRatio = resizeTarget.width / Math.max(1, resizeTarget.height);
    keepAspectInput.checked = true;
    resizePercentInput.value = '100';
    if (resizeTargetStatus) {
      const targetKey = resizeTarget.kind === 'selection'
        ? 'ui.resizeTargetSelection'
        : 'ui.resizeTargetWholeCanvas';
      resizeTargetStatus.setAttribute('data-i18n-runtime', targetKey);
      resizeTargetStatus.textContent = t(targetKey);
    }
    updateResizeSummary();
    updatePresetSelection();
  };

  const openResizeDialog = () => {
    resizeTarget = activeResizeTarget();
    setResizeTargetFields();
    resizeDialog.showModal();
    setDialogUrl('resize');
  };

  resizePresets.forEach((button) => {
    button.addEventListener('click', () => {
      const [width, height] = button.dataset.resizePreset.split('x').map(Number);
      setResizeValues(width, height);
      syncResizePercent();
    });
  });

  const applyScalePercent = (percent) => {
    const maximumWidth = Number(resizeWidthInput.max) || Number.MAX_SAFE_INTEGER;
    const maximumHeight = Number(resizeHeightInput.max) || Number.MAX_SAFE_INTEGER;
    const width = Math.min(maximumWidth, Math.max(1, Math.round(resizeTarget.width * percent / 100)));
    const height = Math.min(maximumHeight, Math.max(1, Math.round(resizeTarget.height * percent / 100)));
    setResizeValues(width, height);
  };

  resizeScalePresets.forEach((button) => {
    button.addEventListener('click', () => {
      const percent = Number(button.dataset.resizeScale);
      resizePercentInput.value = String(percent);
      applyScalePercent(percent);
    });
  });

  resizeWidthInput.addEventListener('input', () => {
    const width = readDraft(resizeWidthInput);
    if (keepAspectInput.checked && width !== null && width > 0) {
      resizeHeightInput.value = String(Math.max(1, Math.round(width / aspectRatio)));
    }
    syncResizePercent();
    updateResizeSummary();
    updatePresetSelection();
  });
  resizeHeightInput.addEventListener('input', () => {
    const height = readDraft(resizeHeightInput);
    if (keepAspectInput.checked && height !== null && height > 0) {
      resizeWidthInput.value = String(Math.max(1, Math.round(height * aspectRatio)));
    }
    syncResizePercent();
    updateResizeSummary();
    updatePresetSelection();
  });
  const normalizeDimensionDraft = (input, fallback, deriveOther) => {
    const value = normalizeInput(input, fallback);
    if (keepAspectInput.checked) {
      const derived = Math.max(1, Math.round(deriveOther(value)));
      const otherInput = input === resizeWidthInput ? resizeHeightInput : resizeWidthInput;
      normalizeInput(otherInput, derived);
    }
    syncResizePercent();
    updateResizeSummary();
    updatePresetSelection();
  };
  resizeWidthInput.addEventListener('blur', () => {
    normalizeDimensionDraft(resizeWidthInput, resizeTarget.width, (width) => width / aspectRatio);
  });
  resizeHeightInput.addEventListener('blur', () => {
    normalizeDimensionDraft(resizeHeightInput, resizeTarget.height, (height) => height * aspectRatio);
  });
  resizePercentInput.addEventListener('input', () => {
    const percent = readDraft(resizePercentInput);
    if (percent !== null && percent > 0) applyScalePercent(percent);
  });
  resizePercentInput.addEventListener('blur', () => {
    const percent = normalizeInput(resizePercentInput, 100);
    applyScalePercent(percent);
  });

  document.getElementById('resize-cancel').addEventListener('click', () => resizeDialog.close());
  resizeDialog.addEventListener('close', () => {
    if (router.param('dialog') === 'resize') setDialogUrl(null);
  });
  resizeForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const w = normalizeInput(resizeWidthInput, resizeTarget.width);
    const h = normalizeInput(resizeHeightInput, resizeTarget.height);
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
    if (resizeTarget.kind === 'selection') {
      historyManager.snapshot({ force: true });
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
      historyManager.snapshot({ force: true });
      const source = canvasManager.createCompositeCanvas({ includeFloating: true });
      if (!canvasManager.resample({ width: w, height: h, source })) return;
    }
    persistSession();
    resizeDialog.close();
  });

  return Object.freeze({ openResizeDialog });
};