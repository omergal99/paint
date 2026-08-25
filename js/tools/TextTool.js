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
    box.style.font = `${ctx.getFontSize()}px ${ctx.getFontFamily()}`;
    box.style.lineHeight = '1.2';
    ctx.stage.appendChild(box);
    box.focus();

    box.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Escape') {
        e.preventDefault();
        this._cancel();
      }
    });
    box.addEventListener('blur', () => this._commit());

    this._box = box;
    this._origin = pt;
    this._ctxRef = ctx;
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
      const fontSize = ctx.getFontSize();
      c.save();
      c.fillStyle = ctx.canvasManager.primaryColor;
      c.font = `${fontSize}px ${ctx.getFontFamily()}`;
      c.textBaseline = 'top';
      // Compensate for the 1px dashed border of the live .op-text-box preview
      // so committed text lands exactly where the user saw it while typing.
      const borderOffset = 1;
      text.split('\n').forEach((line, i) => {
        c.fillText(line, x + borderOffset, y + borderOffset + i * fontSize * 1.2);
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
}
