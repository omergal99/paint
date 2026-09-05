// js/tools/TextTool.js
// Click on the canvas to drop a live <textarea> (a child of the zoomed `stage`,
// so it scales for free). Typing is real DOM text editing; on blur/Escape the
// text is rendered onto the canvas with ctx.fillText and the textarea is removed.
//
// Note on ordering: calling box.remove() while it's focused fires a *synchronous*
// blur, which would otherwise re-enter _commit/_cancel mid-execution (causing
// double-drawn text and double undo snapshots, or Escape's cancel being
// silently overwritten by a commit). Both methods null out `this._box` as their
// very first step so any reentrant call sees "nothing to do" and exits early.

export class TextTool {
  constructor() {
    this.name = 'text';
    this.cursor = 'text';
    this._box = null;
    this._ctxRef = null;
    this._origin = null;
  }

  onDown(pt, ctx) {
    if (this._box) {
      this._commit();
      this._open(pt, ctx);
      return;
    }
    this._open(pt, ctx);
  }

  onMove() {}
  onUp() {}

  onZoomChange(ctx) {
    if (!this._box || this._ctxRef !== ctx) return;
    this._applyEditorStyle(ctx);
  }

  onDeactivate() {
    this._commit();
  }

  _open(pt, ctx) {
    const box = document.createElement('textarea');
    box.className = 'op-text-box';
    box.style.left = `${pt.x}px`;
    box.style.top = `${pt.y}px`;
    box.style.color = ctx.canvasManager.primaryColor;
    // NOTE: assigning the `font` shorthand resets sub-properties, so the shared
    // line-height must be re-applied afterwards or the live preview drifts out
    // of alignment with the text committed to the canvas.
    this._box = box;
    this._ctxRef = ctx;
    this._applyEditorStyle(ctx);
    (ctx.scaleEl || ctx.stage).appendChild(box);
    box.focus();

    box.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Escape') {
        e.preventDefault();
        this._cancel();
      }
    });
    box.addEventListener('blur', () => this._commit());

    this._origin = pt;
  }

  _commit() {
    if (!this._box) return;
    const box = this._box;
    const ctx = this._ctxRef;
    const { x, y } = this._origin;
    this._box = null;
    this._ctxRef = null;
    box.remove();

    const text = box.value;
    if (text.trim().length > 0) {
      ctx.historyManager.snapshot();
      const c = ctx.canvasManager.ctx;
      const fontSize = this._renderSize(ctx);
      const style = ctx.getTextStyle?.() || 'plain';
      c.save();
      c.fillStyle = ctx.canvasManager.primaryColor;
      c.font = this._fontDeclaration(ctx, fontSize, style);
      c.textBaseline = 'top';
      if (style === 'shadow') { c.shadowColor = 'rgba(0,0,0,.45)'; c.shadowBlur = Math.max(2, fontSize * .12); c.shadowOffsetX = fontSize * .08; c.shadowOffsetY = fontSize * .08; }
      if (style === 'neon') { c.shadowColor = ctx.canvasManager.primaryColor; c.shadowBlur = Math.max(6, fontSize * .25); }
      // Compensate for the 1px dashed border of the live .op-text-box preview
      // so committed text lands exactly where the user saw it while typing.
      const borderOffset = 1;
      text.split('\n').forEach((line, i) => {
        const lineX = x + borderOffset;
        const lineY = y + borderOffset + i * fontSize * 1.2;
        if (style === 'outline') { c.strokeStyle = ctx.canvasManager.primaryColor; c.lineWidth = Math.max(1, fontSize * .06); c.strokeText(line, lineX, lineY); }
        else c.fillText(line, lineX, lineY);
        if (style === 'underline') {
          c.fillRect(lineX, lineY + fontSize * 1.08, c.measureText(line).width, Math.max(1, fontSize * .06));
        }
      });
      c.restore();
      ctx.canvasManager.persistToStorage();
    }
  }

  _cancel() {
    if (!this._box) return;
    const box = this._box;
    this._box = null;
    this._ctxRef = null;
    box.remove();
  }

  // Keep text visually legible at every zoom: the stored size is the user's
  // screen-facing preference, while the canvas needs inverse zoom scaling.
  _renderSize(ctx) {
    return Math.max(1, Math.round(ctx.getFontSize() * 100 / ctx.viewportManager.zoom));
  }

  _applyEditorStyle(ctx) {
    if (!this._box) return;
    const fontSize = this._renderSize(ctx);
    const style = ctx.getTextStyle?.() || 'plain';
    this._box.style.font = this._fontDeclaration(ctx, fontSize, style);
    this._box.style.lineHeight = '1.2';
    this._box.style.textDecoration = style === 'underline' ? 'underline' : 'none';
    this._box.style.textShadow = style === 'shadow'
      ? '2px 2px 3px rgba(0,0,0,.45)'
      : style === 'neon' ? `0 0 8px ${ctx.canvasManager.primaryColor}` : 'none';
    this._box.style.webkitTextStroke = style === 'outline' ? `${Math.max(1, fontSize * .06)}px ${ctx.canvasManager.primaryColor}` : 'unset';
    this._box.style.color = style === 'outline' ? 'transparent' : ctx.canvasManager.primaryColor;
  }

  _fontDeclaration(ctx, fontSize, style) {
    const fontStyle = style === 'italic' ? 'italic' : 'normal';
    const fontWeight = style === 'bold' ? '700' : '400';
    return `${fontStyle} ${fontWeight} ${fontSize}px ${ctx.getFontFamily()}`;
  }
}
