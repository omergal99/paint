// js/tools/ShapeTool.js
// One tool, many shapes — `ctx.getShapeKind()` and `ctx.getShapeFillMode()` read
// the current ribbon selection. Drag previews live on the overlay; releasing
// the mouse commits the final shape onto the real canvas.

export class ShapeTool {
  constructor() {
    this.name = 'shape';
    this.cursor = 'crosshair';
    this._start = null;
  }

  onDown(pt, ctx) {
    this._start = pt;
    this._button = pt.button;
  }

  onMove(pt, ctx) {
    if (!this._start) return;
    ctx.canvasManager.clearOverlay();
    this._draw(ctx.canvasManager.octx, ctx, this._start, pt, this._button);
  }

  onUp(pt, ctx) {
    if (!this._start) return;
    ctx.canvasManager.clearOverlay();
    ctx.historyManager.snapshot();
    this._draw(ctx.canvasManager.ctx, ctx, this._start, pt, this._button);
    this._start = null;
  }

  _draw(g, ctx, start, end, button) {
    const kind = ctx.getShapeKind();
    const fillMode = ctx.getShapeFillMode(); // 'outline' | 'fill' | 'outline-fill'
    const cm = ctx.canvasManager;

    const outlineColor = button === 2 ? cm.secondaryColor : cm.primaryColor;
    const fillColor = button === 2 ? cm.primaryColor : cm.secondaryColor;

    g.save();
    g.lineWidth = cm.lineWidth;
    g.lineJoin = 'round';
    g.lineCap = 'round';
    g.strokeStyle = outlineColor;
    g.fillStyle = fillColor;

    // Arrow is a line + arrowhead and renders itself (shaft stroked in the
    // outline color, solid head filled with the same color). It intentionally
    // ignores the fill-mode buttons, exactly like the plain line.
    if (kind === 'arrow') {
      drawArrowPath(g, ctx, start, end, outlineColor);
      g.restore();
      return;
    }

    const x = Math.min(start.x, end.x);
    const y = Math.min(start.y, end.y);
    const w = Math.abs(end.x - start.x);
    const h = Math.abs(end.y - start.y);

    g.beginPath();
    switch (kind) {
      case 'line':
        g.moveTo(start.x, start.y);
        g.lineTo(end.x, end.y);
        break;
      case 'rectangle':
        g.rect(x, y, w, h);
        break;
      case 'rounded-rectangle': {
        const r = Math.min(w, h) * 0.2;
        roundRectPath(g, x, y, w, h, r);
        break;
      }
      case 'ellipse':
        g.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
        break;
      case 'triangle':
        g.moveTo(x + w / 2, y);
        g.lineTo(x + w, y + h);
        g.lineTo(x, y + h);
        g.closePath();
        break;
      default:
        g.moveTo(start.x, start.y);
        g.lineTo(end.x, end.y);
    }

    if (kind !== 'line') {
      if (fillMode === 'fill' || fillMode === 'outline-fill') g.fill();
      if (fillMode === 'outline' || fillMode === 'outline-fill') g.stroke();
    } else {
      g.stroke();
    }
    g.restore();
  }
}

function roundRectPath(g, x, y, w, h, r) {
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

/**
 * Draw an arrow: a stroked shaft plus a solid arrowhead at the end point.
 * The head size grows with the line width so thick arrows stay readable,
 * but is capped so a short drag still produces a proportional arrow.
 */
function drawArrowPath(g, ctx, start, end, color) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const len = Math.hypot(dx, dy);
  if (len < 1) return;

  const angle = Math.atan2(dy, dx);
  const spread = Math.PI / 7; // ~25.7° half-angle of the head
  const headLen = Math.min(Math.max(12, ctx.canvasManager.lineWidth * 3), len / 2.5);

  g.strokeStyle = color;
  g.fillStyle = color;

  // Shaft (stroked only)
  g.beginPath();
  g.moveTo(start.x, start.y);
  g.lineTo(end.x, end.y);
  g.stroke();

  // Solid arrowhead (closed triangle, filled + stroked with the shaft color)
  g.beginPath();
  g.moveTo(end.x, end.y);
  g.lineTo(end.x - headLen * Math.cos(angle - spread), end.y - headLen * Math.sin(angle - spread));
  g.lineTo(end.x - headLen * Math.cos(angle + spread), end.y - headLen * Math.sin(angle + spread));
  g.closePath();
  g.fill();
  g.stroke();
}
