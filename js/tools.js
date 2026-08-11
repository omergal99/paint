export const MAX_HISTORY_STEPS = 20;

export function drawLine(context, start, end, { color = '#000000', width = 1, composite = 'source-over' } = {}) {
  context.save();
  context.globalCompositeOperation = composite;
  context.strokeStyle = color;
  context.lineWidth = width;
  context.lineCap = 'round';
  context.beginPath();
  context.moveTo(start.x, start.y);
  context.lineTo(end.x, end.y);
  context.stroke();
  context.restore();
}

export function drawShape(context, type, start, end, { color = '#000000', width = 1, fill = null } = {}) {
  const left = Math.min(start.x, end.x);
  const top = Math.min(start.y, end.y);
  const shapeWidth = Math.abs(end.x - start.x);
  const shapeHeight = Math.abs(end.y - start.y);
  context.save();
  context.strokeStyle = color;
  context.lineWidth = width;
  context.beginPath();
  if (type === 'ellipse') context.ellipse(left + shapeWidth / 2, top + shapeHeight / 2, shapeWidth / 2, shapeHeight / 2, 0, 0, Math.PI * 2);
  else if (type === 'line') context.moveTo(start.x, start.y), context.lineTo(end.x, end.y);
  else context.rect(left, top, shapeWidth, shapeHeight);
  if (fill) { context.fillStyle = fill; context.fill(); }
  context.stroke();
  context.restore();
}

export class HistoryStack {
  constructor(limit = MAX_HISTORY_STEPS) {
    this.limit = Math.max(1, limit);
    this.undo = [];
    this.redo = [];
  }
  push(snapshot) {
    this.undo.push(snapshot);
    if (this.undo.length > this.limit) this.undo.shift();
    this.redo.length = 0;
  }
  takeUndo(current) {
    const previous = this.undo.pop();
    if (previous) this.redo.push(current);
    return previous;
  }
  takeRedo(current) {
    const next = this.redo.pop();
    if (next) this.undo.push(current);
    return next;
  }
  clear() { this.undo.length = 0; this.redo.length = 0; }
}
