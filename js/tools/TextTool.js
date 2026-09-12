// js/tools/TextTool.js
// Functional text tool: the live editor is a DOM textarea and the committed
// result is drawn with the canvas context. Layout values are kept together so
// the editor and the committed text can be tuned without changing font-size
// dependent magic numbers in several different places.

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

function getStyleSet(ctx) {
  const value = ctx.getTextStyle?.() || [];
  if (Array.isArray(value)) return new Set(value);
  return value === 'plain' ? new Set() : new Set([value]);
}

function getFontDeclaration(ctx, fontSize, styles) {
  const fontStyle = styles.has('italic') ? 'italic' : 'normal';
  const fontWeight = styles.has('bold') ? '700' : '400';
  return `${fontStyle} ${fontWeight} ${fontSize}px ${ctx.getFontFamily()}`;
}

function getRenderSize(ctx) {
  // The stored font size is screen-facing. Canvas coordinates need the
  // inverse viewport scale, while the textarea lives inside the scaled stage.
  return Math.max(1, Math.round(ctx.getFontSize() * 100 / ctx.viewportManager.zoom));
}

function getLineHeight(fontSize) {
  return fontSize * TEXT_EDITOR_LAYOUT.lineHeightPercent;
}

function getCanvasTextOffset(fontSize) {
  return fontSize * TEXT_EDITOR_LAYOUT.canvasTextOffsetPercent / 100;
}

export function createTextTool() {
  let editor = null;
  let context = null;
  let origin = null;

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

    if (origin) {
      editor.style.top = `${origin.y + fontSize * TEXT_EDITOR_LAYOUT.topOffsetPercent / 100}px`;
    }
  };

  const cancel = () => {
    if (!editor) return;
    const activeEditor = editor;
    editor = null;
    context = null;
    origin = null;
    activeEditor.remove();
  };

  const commit = () => {
    if (!editor) return;

    const activeEditor = editor;
    const ctx = context;
    const anchor = origin;
    // Clear references before remove(): remove() can synchronously emit blur.
    editor = null;
    context = null;
    origin = null;
    activeEditor.remove();

    const text = activeEditor.value;
    if (text.trim().length === 0) return;

    ctx.historyManager.snapshot();
    const canvasContext = ctx.canvasManager.ctx;
    const fontSize = getRenderSize(ctx);
    const styles = getStyleSet(ctx);
    const lineHeight = getLineHeight(fontSize);
    const canvasTextOffset = getCanvasTextOffset(fontSize);

    canvasContext.save();
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
    ctx.canvasManager.persistToStorage();
  };

  const open = (point, ctx) => {
    const nextEditor = document.createElement('textarea');
    nextEditor.className = 'op-text-box';
    nextEditor.style.left = `${point.x}px`;
    nextEditor.style.color = ctx.canvasManager.primaryColor;

    editor = nextEditor;
    context = ctx;
    origin = point;
    applyEditorStyle(ctx);

    getEditorParent(ctx).appendChild(nextEditor);
    nextEditor.focus();
    nextEditor.addEventListener('keydown', (event) => {
      event.stopPropagation();
      if (event.key === 'Escape') {
        event.preventDefault();
        cancel();
      }
    });
    nextEditor.addEventListener('blur', commit);
  };

  return {
    name: 'text',
    cursor: 'text',
    onDown(point, ctx) {
      if (editor) commit();
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
