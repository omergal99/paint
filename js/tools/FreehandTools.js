// js/tools/FreehandTools.js
// Pencil, Brush and Eraser share the same "drag to stroke a line" mechanics,
// so they're built on one small closure factory and just differ in style.

function createFreehandTool(name, { sizeAware = true } = {}) {
  let drawing = false;
  let last = null;

  function strokeColorFor(button, ctx) {
    return button === 2 ? ctx.canvasManager.secondaryColor : ctx.canvasManager.primaryColor;
  }

  function applyStyle(pt, ctx) {
    const c = ctx.canvasManager.ctx;
    c.lineJoin = 'round';
    c.lineCap = 'round';
    c.strokeStyle = name === 'eraser' ? ctx.canvasManager.backgroundColor : strokeColorFor(pt.button, ctx);
    c.lineWidth = name === 'pencil' ? 1 : ctx.canvasManager.lineWidth;
  }

  function onDown(pt, ctx) {
    ctx.historyManager.snapshot();
    drawing = true;
    last = pt;
    applyStyle(pt, ctx);
    const c = ctx.canvasManager.ctx;
    c.beginPath();
    c.moveTo(pt.x, pt.y);
    c.lineTo(pt.x + 0.01, pt.y + 0.01); // ensure a dot shows on a simple click
    c.stroke();
  }

  function onMove(pt, ctx) {
    if (!drawing) return;
    const c = ctx.canvasManager.ctx;
    c.beginPath();
    c.moveTo(last.x, last.y);
    c.lineTo(pt.x, pt.y);
    c.stroke();
    last = pt;
  }

  function onUp() {
    drawing = false;
    last = null;
  }

  return { name, cursor: 'crosshair', sizeAware, onDown, onMove, onUp };
}

export function createPencilTool() {
  return createFreehandTool('pencil');
}

export function createBrushTool() {
  return createFreehandTool('brush');
}

export function createEraserTool() {
  const tool = createFreehandTool('eraser');
  tool.cursor = 'cell';
  return tool;
}
