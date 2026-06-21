// js/tools/FreehandTools.js
// Pencil, Brush and Eraser share the same "drag to stroke a line" mechanics,
// so they're built on one small base class and just differ in style.

class FreehandTool {
  constructor(name, { sizeAware = true } = {}) {
    this.name = name;
    this.cursor = 'crosshair';
    this.sizeAware = sizeAware;
    this._drawing = false;
    this._last = null;
  }

  _strokeColorFor(button, ctx) {
    return button === 2 ? ctx.canvasManager.secondaryColor : ctx.canvasManager.primaryColor;
  }

  _applyStyle(pt, ctx) {
    const c = ctx.canvasManager.ctx;
    c.lineJoin = 'round';
    c.lineCap = 'round';
    c.strokeStyle = this.name === 'eraser' ? ctx.canvasManager.backgroundColor : this._strokeColorFor(pt.button, ctx);
    c.lineWidth = this.name === 'pencil' ? 1 : ctx.canvasManager.lineWidth;
  }

  onDown(pt, ctx) {
    ctx.historyManager.snapshot();
    this._drawing = true;
    this._last = pt;
    this._applyStyle(pt, ctx);
    const c = ctx.canvasManager.ctx;
    c.beginPath();
    c.moveTo(pt.x, pt.y);
    c.lineTo(pt.x + 0.01, pt.y + 0.01); // ensure a dot shows on a simple click
    c.stroke();
  }

  onMove(pt, ctx) {
    if (!this._drawing) return;
    const c = ctx.canvasManager.ctx;
    c.beginPath();
    c.moveTo(this._last.x, this._last.y);
    c.lineTo(pt.x, pt.y);
    c.stroke();
    this._last = pt;
  }

  onUp() {
    this._drawing = false;
    this._last = null;
  }
}

export function createPencilTool() {
  return new FreehandTool('pencil');
}

export function createBrushTool() {
  return new FreehandTool('brush');
}

export function createEraserTool() {
  const tool = new FreehandTool('eraser');
  tool.cursor = 'cell';
  return tool;
}
