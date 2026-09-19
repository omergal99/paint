// js/tools/TextTool.js
// Functional text tool: the live editor is a DOM textarea and the committed
// result is drawn with the canvas context. Layout values are kept together so
// the editor and the committed text can be tuned without changing font-size
// dependent magic numbers in several different places.

import { hexToRgb } from '../utils/color.js';

export const TEXT_EDITOR_LAYOUT = Object.freeze({
  // Position of the editor top edge relative to the click/caret anchor.
  // Negative values place the editor above the pointer.
  topOffsetPercent: -70,
  // Position of the canvas ink relative to the same click/caret anchor.
  canvasTextOffsetPercent: -50,
  // One means 100% of the current font size. Keep this normalized value
  // stable so changing font-size does not change the editor's proportions.
  lineHeightPercent: 1.2,
});

const getStyleSet = (ctx) => {
  const value = ctx.getTextStyle?.() || [];
  if (Array.isArray(value)) return new Set(value);
  return value === 'plain' ? new Set() : new Set([value]);
}

const getFontDeclaration = (ctx, fontSize, styles) => {
  const fontStyle = styles.has('italic') ? 'italic' : 'normal';
  const fontWeight = styles.has('bold') ? '700' : '400';
  return `${fontStyle} ${fontWeight} ${fontSize}px ${ctx.getFontFamily()}`;
}

const getRenderSize = (ctx) => {
  // The stored font size is screen-facing. Canvas coordinates need the
  // inverse viewport scale, while the textarea lives inside the scaled stage.
  return Math.max(1, Math.round(ctx.getFontSize() * 100 / ctx.viewportManager.zoom));
}

const getLineHeight = (fontSize) => {
  return fontSize * TEXT_EDITOR_LAYOUT.lineHeightPercent;
}

const getCanvasTextOffset = (fontSize) => {
  return fontSize * TEXT_EDITOR_LAYOUT.canvasTextOffsetPercent / 100;
}

export const createTextTool = () => {
  let editor = null;
  let editorShell = null;
  let historySelect = null;
  let context = null;
  let origin = null;
  let historyUnsubscribe = null;
  let historyToolbarListener = null;

  const getEditorParent = (ctx) => ctx.scaleEl || ctx.stage;

  const applyEditorStyle = (ctx) => {
    if (!editor) return;

    const fontSize = getRenderSize(ctx);
    const styles = getStyleSet(ctx);
    editor.style.font = getFontDeclaration(ctx, fontSize, styles);
    editor.style.lineHeight = `${getLineHeight(fontSize)}px`;
    editor.style.padding = '0';
    editor.style.margin = '0';
    editor.style.textIndent = '0';
    editor.style.textDecoration = styles.has('underline') ? 'underline' : 'none';
    editor.style.textShadow = styles.has('shadow')
      ? '2px 2px 3px rgba(0,0,0,.45)'
      : styles.has('neon') ? `0 0 8px ${ctx.canvasManager.primaryColor}` : 'none';
    editor.style.webkitTextStroke = styles.has('black-outline')
      ? `${Math.max(1, fontSize * .06)}px #000`
      : styles.has('outline') ? `${Math.max(1, fontSize * .06)}px ${ctx.canvasManager.primaryColor}` : 'unset';
    editor.style.color = ctx.canvasManager.primaryColor;

    if (origin && editorShell) {
      editorShell.style.left = `${origin.x}px`;
      editorShell.style.top = `${origin.y + fontSize * TEXT_EDITOR_LAYOUT.topOffsetPercent / 100}px`;
    }
  };

  const renderHistoryOptions = () => {
    if (!historySelect || !context?.textHistoryStore) return;
    const currentValue = historySelect.value;
    historySelect.replaceChildren();
    const placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.textContent = 'Recent text…';
    historySelect.appendChild(placeholder);
    context.textHistoryStore.getAll().forEach((entry) => {
      const option = document.createElement('option');
      option.value = entry.id;
      option.textContent = entry.text.replace(/\s+/g, ' ').slice(0, 48) || 'Untitled text';
      historySelect.appendChild(option);
    });
    if ([...historySelect.options].some((option) => option.value === currentValue)) {
      historySelect.value = currentValue;
    }
  };

  const clearEditorReferences = () => {
    historyUnsubscribe?.();
    if (historyToolbarListener) window.removeEventListener('paint:text-history-toolbar-change', historyToolbarListener);
    historyUnsubscribe = null;
    historyToolbarListener = null;
    editor = null;
    editorShell = null;
    historySelect = null;
    context = null;
    origin = null;
  };

  const cancel = () => {
    if (!editor) return;
    const activeShell = editorShell;
    clearEditorReferences();
    activeShell?.remove();
  };

  const commit = () => {
    if (!editor) return;

    const activeEditor = editor;
    const activeShell = editorShell;
    const ctx = context;
    const anchor = origin;
    const text = activeEditor.value;
    const fontSize = getRenderSize(ctx);
    const styles = getStyleSet(ctx);
    // Clear references before remove(): remove() can synchronously emit blur.
    clearEditorReferences();
    activeShell?.remove();

    if (text.trim().length === 0) return;

    ctx.textHistoryStore?.record({
      text,
      styles: [...styles],
      fontSize: ctx.getFontSize(),
      fontFamily: ctx.getFontFamily(),
    });
    ctx.historyManager.snapshot();
    const canvasContext = ctx.canvasManager.ctx;
    const lineHeight = getLineHeight(fontSize);
    const canvasTextOffset = getCanvasTextOffset(fontSize);

    canvasContext.save();
    canvasContext.globalAlpha = Number(ctx.canvasManager.primaryAlpha ?? 1);
    canvasContext.fillStyle = ctx.canvasManager.primaryColor;
    canvasContext.font = getFontDeclaration(ctx, fontSize, styles);
    canvasContext.textBaseline = 'top';
    if (styles.has('shadow')) {
      canvasContext.shadowColor = 'rgba(0,0,0,.45)';
      canvasContext.shadowBlur = Math.max(2, fontSize * .12);
      canvasContext.shadowOffsetX = fontSize * .08;
      canvasContext.shadowOffsetY = fontSize * .08;
    }
    if (styles.has('neon')) {
      canvasContext.shadowColor = ctx.canvasManager.primaryColor;
      canvasContext.shadowBlur = Math.max(6, fontSize * .25);
    }

    text.split('\n').forEach((line, index) => {
      const lineX = anchor.x + 1;
      const lineY = anchor.y + canvasTextOffset + index * lineHeight;
      if (styles.has('outline') || styles.has('black-outline')) {
        canvasContext.strokeStyle = styles.has('black-outline') ? '#000' : ctx.canvasManager.primaryColor;
        canvasContext.lineWidth = Math.max(1, fontSize * .06);
        canvasContext.strokeText(line, lineX, lineY);
      }
      canvasContext.fillText(line, lineX, lineY);
      if (styles.has('underline')) {
        canvasContext.fillRect(
          lineX,
          lineY + fontSize * 1.08,
          canvasContext.measureText(line).width,
          Math.max(1, fontSize * .06),
        );
      }
    });
    canvasContext.restore();
    const lineWidths = text.split('\n').map((line) => canvasContext.measureText(line).width);
    const rgb = hexToRgb(ctx.canvasManager.primaryColor) || { r: 0, g: 0, b: 0 };
    const textObject = ctx.textDocumentStore?.add({
      text,
      x: anchor.x,
      y: anchor.y + canvasTextOffset,
      width: Math.max(0, ...lineWidths),
      height: Math.max(lineHeight, text.split('\n').length * lineHeight),
      fontSize,
      fontFamily: ctx.getFontFamily(),
      color: { ...rgb, a: Number(ctx.canvasManager.primaryAlpha ?? 1) },
      styles: [...styles],
      zIndex: Date.now(),
    });
    if (textObject && ctx.getTextSelectAfterDraw?.() === true) {
      ctx.selectTextObject?.(textObject.id);
    }
    ctx.canvasManager.persistToStorage();
  };

  const open = (point, ctx) => {
    const shell = document.createElement('div');
    shell.className = 'text-editor-shell';
    shell.style.left = `${point.x}px`;

    const toolbar = document.createElement('div');
    toolbar.className = 'text-editor-toolbar';
    toolbar.setAttribute('role', 'toolbar');
    toolbar.setAttribute('aria-label', 'Text editor controls');
    toolbar.tabIndex = 0;
    const setHistoryToolbarVisibility = (visible) => {
      toolbar.hidden = visible === false;
      toolbar.setAttribute('aria-hidden', String(visible === false));
    };
    setHistoryToolbarVisibility(ctx.getTextHistoryToolbarVisible?.() !== false);
    const historyLabel = document.createElement('span');
    historyLabel.className = 'text-editor-toolbar-label';
    historyLabel.textContent = 'Recent text';
    const nextHistorySelect = document.createElement('select');
    nextHistorySelect.className = 'text-history-select';
    nextHistorySelect.setAttribute('aria-label', 'Restore recent text');
    const clearHistoryButton = document.createElement('button');
    clearHistoryButton.type = 'button';
    clearHistoryButton.className = 'text-history-clear';
    clearHistoryButton.textContent = 'Clear';
    clearHistoryButton.setAttribute('aria-label', 'Clear recent text history');
    toolbar.append(historyLabel, nextHistorySelect, clearHistoryButton);

    const nextEditor = document.createElement('textarea');
    nextEditor.className = 'op-text-box';
    nextEditor.id = 'text-editor-input';
    nextEditor.name = 'text';
    nextEditor.setAttribute('aria-label', 'Text to draw');
    nextEditor.style.color = ctx.canvasManager.primaryColor;

    // Keep the textarea first so its top-left edge remains the exact text
    // anchor used before the history controls were added.
    shell.append(nextEditor, toolbar);
    editor = nextEditor;
    editorShell = shell;
    historySelect = nextHistorySelect;
    context = ctx;
    origin = point;
    applyEditorStyle(ctx);
    renderHistoryOptions();

    nextHistorySelect.addEventListener('change', () => {
      const entry = ctx.textHistoryStore?.getAll().find((item) => item.id === nextHistorySelect.value);
      if (!entry) return;
      nextEditor.value = entry.text;
      nextEditor.focus();
      nextEditor.setSelectionRange(nextEditor.value.length, nextEditor.value.length);
    });
    clearHistoryButton.addEventListener('click', () => {
      ctx.textHistoryStore?.clear();
      nextEditor.focus();
    });
    historyUnsubscribe = ctx.textHistoryStore?.subscribe(renderHistoryOptions) || null;
    historyToolbarListener = (event) => setHistoryToolbarVisibility(event.detail?.visible !== false);
    window.addEventListener('paint:text-history-toolbar-change', historyToolbarListener);

    let dragState = null;
    const moveShell = (clientX, clientY) => {
      if (!dragState || !origin) return;
      const zoom = Math.max(0.01, Number(ctx.viewportManager.zoom || 100) / 100);
      origin = {
        x: dragState.origin.x + (clientX - dragState.clientX) / zoom,
        y: dragState.origin.y + (clientY - dragState.clientY) / zoom,
      };
      applyEditorStyle(ctx);
    };
    const endDrag = () => {
      dragState = null;
      toolbar.removeAttribute('aria-grabbed');
    };
    toolbar.addEventListener('pointerdown', (event) => {
      if (event.button !== 0 || event.target.closest('select, button, input')) return;
      event.preventDefault();
      dragState = { clientX: event.clientX, clientY: event.clientY, origin: { ...origin } };
      toolbar.setAttribute('aria-grabbed', 'true');
      toolbar.setPointerCapture?.(event.pointerId);
    });
    toolbar.addEventListener('pointermove', (event) => moveShell(event.clientX, event.clientY));
    toolbar.addEventListener('pointerup', endDrag);
    toolbar.addEventListener('pointercancel', endDrag);
    toolbar.addEventListener('keydown', (event) => {
      const step = event.shiftKey ? 10 : 1;
      const deltas = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
      const delta = deltas[event.key];
      if (!delta || !origin) return;
      event.preventDefault();
      origin = { x: origin.x + delta[0], y: origin.y + delta[1] };
      applyEditorStyle(ctx);
    });

    getEditorParent(ctx).appendChild(shell);
    nextEditor.focus();
    nextEditor.addEventListener('keydown', (event) => {
      event.stopPropagation();
      if (event.key === 'Escape') {
        event.preventDefault();
        cancel();
      }
    });
    nextEditor.addEventListener('blur', () => {
      // Toolbar controls belong to this editing session. Defer the decision
      // until focus has moved so selecting/restoring text does not commit it.
      setTimeout(() => {
        if (!editor || editorShell?.contains(document.activeElement)) return;
        commit();
      }, 0);
    });
  };

  return {
    name: 'text',
    cursor: 'text',
    onDown(point, ctx) {
      if (editor) {
        // A canvas click is the explicit “apply and leave text mode” action.
        // Do not immediately open a second textarea at the click position;
        // that made the committed text appear missing and left the tool in
        // Text mode forever after the first blur.
        commit();
        ctx.setActiveTool?.('select');
        return;
      }
      open(point, ctx);
    },
    onMove() {},
    onUp() {},
    onZoomChange(ctx) {
      if (!editor || context !== ctx) return;
      applyEditorStyle(ctx);
    },
    onDeactivate: commit,
  };
}
