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

    // Lines with arrowheads render themselves (shaft stroked in the outline
    // color, solid head filled in the same color). They intentionally ignore
    // the fill-mode buttons, exactly like the plain line.
    if (kind === 'arrow' || kind === 'double-arrow') {
      if (kind === 'double-arrow') drawDoubleArrowPath(g, ctx, start, end, outlineColor);
      else drawArrowPath(g, ctx, start, end, outlineColor);
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
      case 'right-triangle':
        g.moveTo(x, y);
        g.lineTo(x + w, y);
        g.lineTo(x, y + h);
        g.closePath();
        break;
      case 'diamond':
        g.moveTo(x + w / 2, y);
        g.lineTo(x + w, y + h / 2);
        g.lineTo(x + w / 2, y + h);
        g.lineTo(x, y + h / 2);
        g.closePath();
        break;
      case 'pentagon':
        regularPolygonPath(g, x + w / 2, y + h / 2, w / 2, h / 2, 5);
        break;
      case 'hexagon':
        regularPolygonPath(g, x + w / 2, y + h / 2, w / 2, h / 2, 6);
        break;
      case 'star':
        starPath(g, x + w / 2, y + h / 2, w / 2, h / 2);
        break;
      case 'heart':
        heartPath(g, x + w / 2, y + h / 2, w / 2, h / 2);
        break;
      case 'plus':
        plusPath(g, x + w / 2, y + h / 2, w / 2, h / 2);
        break;
      case 'x':
        drawNormalizedX(g, x, y, w, h);
        break;
      case 'v':
        drawNormalizedV(g, x, y, w, h);
        break;
      default:
        g.moveTo(start.x, start.y);
        g.lineTo(end.x, end.y);
    }

    if (kind !== 'line' && kind !== 'x' && kind !== 'v') {
      if (fillMode === 'fill' || fillMode === 'outline-fill') g.fill();
      if (fillMode === 'outline' || fillMode === 'outline-fill') g.stroke();
    } else {
      g.stroke();
    }
    g.restore();
  }
}

function squareBounds(x, y, w, h, padding = 0.12) {
  const size = Math.max(1, Math.min(w, h));
  const left = x + (w - size) / 2;
  const top = y + (h - size) / 2;
  return { left: left + size * padding, top: top + size * padding, size: size * (1 - padding * 2) };
}

function drawNormalizedX(g, x, y, w, h) {
  const box = squareBounds(x, y, w, h);
  g.moveTo(box.left, box.top);
  g.lineTo(box.left + box.size, box.top + box.size);
  g.moveTo(box.left + box.size, box.top);
  g.lineTo(box.left, box.top + box.size);
}

function drawNormalizedV(g, x, y, w, h) {
  const box = squareBounds(x, y, w, h);
  g.moveTo(box.left, box.top + box.size * 0.45);
  g.lineTo(box.left + box.size * 0.34, box.top + box.size * 0.78);
  g.lineTo(box.left + box.size, box.top);
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

/** Draw a regular polygon centered at (cx, cy), tight inside the rx*ry box. */
function regularPolygonPath(g, cx, cy, rx, ry, sides) {
  const start = -Math.PI / 2; // point the first vertex "up"
  for (let i = 0; i < sides; i++) {
    const a = start + (i * Math.PI * 2) / sides;
    const x = cx + rx * Math.cos(a);
    const y = cy + ry * Math.sin(a);
    if (i === 0) g.moveTo(x, y);
    else g.lineTo(x, y);
  }
  g.closePath();
}

/** Draw a 5-pointed star centered at (cx, cy), tight inside the rx*ry box. */
function starPath(g, cx, cy, rx, ry) {
  const outer = Math.min(rx, ry);
  const inner = outer * 0.45;
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const x = cx + r * Math.cos(a);
    const y = cy + r * Math.sin(a);
    if (i === 0) g.moveTo(x, y);
    else g.lineTo(x, y);
  }
  g.closePath();
}

/** Draw a heart centered at (cx, cy), tight inside the rx*ry box. */
function heartPath(g, cx, cy, rx, ry) {
  const s = Math.min(rx, ry);
  g.moveTo(cx, cy - s * 0.22);
  g.bezierCurveTo(cx - s * 0.08, cy - s * 0.62, cx - s * 0.62, cy - s * 0.44, cx - s * 0.62, cy + s * 0.02);
  g.bezierCurveTo(cx - s * 0.62, cy + s * 0.5, cx - s * 0.18, cy + s * 0.74, cx, cy + s * 0.8);
  g.bezierCurveTo(cx + s * 0.18, cy + s * 0.74, cx + s * 0.62, cy + s * 0.5, cx + s * 0.62, cy + s * 0.02);
  g.bezierCurveTo(cx + s * 0.62, cy - s * 0.44, cx + s * 0.08, cy - s * 0.62, cx, cy - s * 0.22);
  g.closePath();
}

/** Draw a plus/cross sign centered at (cx, cy), tight inside the rx*ry box. */
function plusPath(g, cx, cy, rx, ry) {
  const arm = Math.min(rx, ry);
  const w = arm * 0.3;
  g.moveTo(cx - w, cy - arm);
  g.lineTo(cx + w, cy - arm);
  g.lineTo(cx + w, cy - w);
  g.lineTo(cx + arm, cy - w);
  g.lineTo(cx + arm, cy + w);
  g.lineTo(cx + w, cy + w);
  g.lineTo(cx + w, cy + arm);
  g.lineTo(cx - w, cy + arm);
  g.lineTo(cx - w, cy + w);
  g.lineTo(cx - arm, cy + w);
  g.lineTo(cx - arm, cy - w);
  g.lineTo(cx - w, cy - w);
  g.closePath();
}

/**
 * Draw a double arrow: a stroked shaft with solid arrowheads on BOTH ends
 * (each pointing in the direction of travel). Same conventions as the arrow.
 */
function drawDoubleArrowPath(g, ctx, start, end, color) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const len = Math.hypot(dx, dy);
  if (len < 1) return;

  const angle = Math.atan2(dy, dx);
  const spread = Math.PI / 7; // ~25.7° half-angle of each head
  const headLen = Math.min(Math.max(12, ctx.canvasManager.lineWidth * 3), len / 3);

  g.strokeStyle = color;
  g.fillStyle = color;

  // Shaft (stroked only)
  g.beginPath();
  g.moveTo(start.x, start.y);
  g.lineTo(end.x, end.y);
  g.stroke();

  // Head at the end point (opens backward, pointing along the line)
  g.beginPath();
  g.moveTo(end.x, end.y);
  g.lineTo(end.x - headLen * Math.cos(angle - spread), end.y - headLen * Math.sin(angle - spread));
  g.lineTo(end.x - headLen * Math.cos(angle + spread), end.y - headLen * Math.sin(angle + spread));
  g.closePath();
  g.fill();
  g.stroke();

  // Head at the start point (opens forward, also pointing along the line)
  g.beginPath();
  g.moveTo(start.x, start.y);
  g.lineTo(start.x + headLen * Math.cos(angle - spread), start.y + headLen * Math.sin(angle - spread));
  g.lineTo(start.x + headLen * Math.cos(angle + spread), start.y + headLen * Math.sin(angle + spread));
  g.closePath();
  g.fill();
  g.stroke();
}
