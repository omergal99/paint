// js/tools/ShapeTool.js
// One tool, many shapes — `ctx.getShapeKind()` and `ctx.getShapeFillMode()` read
// the current ribbon selection. Drag previews live on the overlay; releasing
// the mouse commits the final shape onto the real canvas.

export const createShapeTool = () => {
  const state = { start: null, button: 0 };

  const onActivate = () => {
    // Never resume a drag from before this tool (re)gained focus.
    state.start = null;
  }

  const onDown = (pt) => {
    state.start = pt;
    state.button = pt.button;
  }

  const onMove = (pt, ctx) => {
    if (!state.start) return;
    ctx.canvasManager.clearOverlay();
    draw(ctx.canvasManager.octx, ctx, state.start, pt, state.button);
  }

  const onUp = (pt, ctx) => {
    if (!state.start) return;
    ctx.canvasManager.clearOverlay();
    const start = state.start;
    const button = state.button;
    state.start = null;

    // Optional "select after draw": lift the shape as a floating *layer* and
    // leave the main canvas untouched. The pixels behind it keep their original
    // values (no background patch, no erased artwork underneath) and the shape
    // is only composited when the selection is committed — a tool switch or a
    // click outside, via ctx.commitFloatingSelection(). After that one relocation
    // the shape is placed and the shape tool stays active so you can draw another
    // shape immediately; using Select afterward is up to the user.
    if (ctx.getSelectAfterDraw?.() === true && liftAsSelection(ctx, start, pt, button)) {
      ctx.setActiveTool?.('select');
      // Defer re-activation of the shape tool to release, not to the lift.
      // If the user clicks away from the lifted shape, we restore the shape tool
      // right after the shape is placed (release-to-place semantics).
      ctx._deferShapeToolReactivate = true;
      return;
    }

    ctx.historyManager.snapshot();
    draw(ctx.canvasManager.ctx, ctx, start, pt, button);
  }

  /**
   * Render the shape alone on a transparent layer and select its exact ink
   * bounds. Returns false (so the caller falls back to baking normally) when
   * nothing was painted.
   */
  const liftAsSelection = (ctx, start, end, button) => {
    const cm = ctx.canvasManager;
    const x = Math.min(start.x, end.x);
    const y = Math.min(start.y, end.y);
    const w = Math.abs(end.x - start.x);
    const h = Math.abs(end.y - start.y);
    if (w < 1 && h < 1) return false; // a click, not a drag
    const lifted = cm.renderShapeLayer(
      { x: Math.round(x), y: Math.round(y), w: Math.round(w), h: Math.round(h) },
      (g) => draw(g, ctx, start, end, button),
      cm.lineWidth * 2, // stroke can overhang by lineWidth/2 on each side
    );
    if (!lifted) return false;
    // The canvas itself has not changed yet, so the dedup in snapshot() would
    // treat this as a no-op. Force the entry: undo has to be able to drop the
    // floating shape rather than skipping back past an earlier stroke.
    ctx.historyManager.snapshot?.({ force: true });
    cm.floatingCanvas = lifted.layer;
    ctx.setSelection({ x: lifted.x, y: lifted.y, w: lifted.w, h: lifted.h });
    return true;
  }

  const draw = (g, ctx, start, end, button) => {
    const kind = ctx.getShapeKind();
    const fillMode = ctx.getShapeFillMode(); // 'outline' | 'fill' | 'outline-fill'
    const cm = ctx.canvasManager;

    const outlineColor = button === 2 ? cm.secondaryColor : cm.primaryColor;
    const fillColor = button === 2 ? cm.primaryColor : cm.secondaryColor;
    const outlineAlpha = button === 2 ? cm.secondaryAlpha : cm.primaryAlpha;
    const fillAlpha = button === 2 ? cm.primaryAlpha : cm.secondaryAlpha;

    g.save();
    g.lineWidth = cm.lineWidth;
    g.lineJoin = 'round';
    g.lineCap = 'round';
    g.strokeStyle = outlineColor;
    g.fillStyle = fillColor;
    g.globalAlpha = outlineAlpha;

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
      case 'emoji': {
        // System emoji: OS color-emoji font, sized to the drag box.
        // The shared size control scales line width, not the glyph.
        const size = Math.max(8, Math.min(w, h));
        g.font = `${size}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`;
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        g.fillText(ctx.getEmoji?.() || '😀', x + w / 2, y + h / 2);
        break;
      }
      case 'emoji-picker': {
        // Picker affordance drawn by the picker button itself; kept here only
        // so the shape-tool draw path never surprises the app with a hidden
        // render-to-body under any circumstance.
        break;
      }
      default:
        g.moveTo(start.x, start.y);
        g.lineTo(end.x, end.y);
    }

    if (kind !== 'line' && kind !== 'x' && kind !== 'v') {
      if (fillMode === 'fill' || fillMode === 'outline-fill') {
        g.globalAlpha = fillAlpha;
        g.fill();
      }
      if (fillMode === 'outline' || fillMode === 'outline-fill') {
        g.globalAlpha = outlineAlpha;
        g.stroke();
      }
    } else {
      g.stroke();
    }
    g.restore();
  }

  return {
    name: 'shape',
    cursor: 'crosshair',
    onActivate,
    onDown,
    onMove,
    onUp,
    _liftAsSelection: liftAsSelection,
    _draw: draw,
  };
}

const squareBounds = (x, y, w, h, padding = 0.12) => {
  const size = Math.max(1, Math.min(w, h));
  const left = x + (w - size) / 2;
  const top = y + (h - size) / 2;
  return { left: left + size * padding, top: top + size * padding, size: size * (1 - padding * 2) };
}

const drawNormalizedX = (g, x, y, w, h) => {
  const box = squareBounds(x, y, w, h);
  g.moveTo(box.left, box.top);
  g.lineTo(box.left + box.size, box.top + box.size);
  g.moveTo(box.left + box.size, box.top);
  g.lineTo(box.left, box.top + box.size);
}

// Gallery-tile geometry for the V mark, authored on the standard 20-grid so
// the icon and the canvas glyph can never disagree.
// Keep in sync with the tile <path> in index.html: M 3 10.5 L 8 15.5 L 17 4.5
// The bbox is centred in the 20x20 viewBox: x 3..17 and y 4.5..15.5 both
// centre on 10, so the tile sits dead-centre (the old 24-grid numbers did not,
// which is why the ribbon preview looked off-centre).
const V_MARK = {
  points: [[3, 10.5], [8, 15.5], [17, 4.5]],
  minX: 3,
  maxX: 17,
  minY: 4.5,
  maxY: 15.5,
};

const drawNormalizedV = (g, x, y, w, h) => {
  // Check-mark "V". Every point is scaled with a SINGLE factor, so both arms
  // keep a constant angle whatever the drag shape is — scaling the two axes
  // independently (the old per-axis width/height fractions) is what used to
  // make the arms skew while drawing. It lives in the same square box as the X,
  // so the start point never drifts (identical contract to X and rectangle).
  const box = squareBounds(x, y, w, h);
  const spanX = V_MARK.maxX - V_MARK.minX;
  const spanY = V_MARK.maxY - V_MARK.minY;
  const k = box.size / Math.max(spanX, spanY);
  const offX = box.left + (box.size - spanX * k) / 2;
  const offY = box.top + (box.size - spanY * k) / 2;
  const pts = V_MARK.points.map(([px, py]) => [offX + (px - V_MARK.minX) * k, offY + (py - V_MARK.minY) * k]);
  g.moveTo(pts[0][0], pts[0][1]);
  g.lineTo(pts[1][0], pts[1][1]);
  g.lineTo(pts[2][0], pts[2][1]);
}

const roundRectPath = (g, x, y, w, h, r) => {
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
const drawArrowPath = (g, ctx, start, end, color) => {
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
const regularPolygonPath = (g, cx, cy, rx, ry, sides) => {
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
const starPath = (g, cx, cy, rx, ry) => {
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
const heartPath = (g, cx, cy, rx, ry) => {
  const s = Math.min(rx, ry);
  g.moveTo(cx, cy - s * 0.22);
  g.bezierCurveTo(cx - s * 0.08, cy - s * 0.62, cx - s * 0.62, cy - s * 0.44, cx - s * 0.62, cy + s * 0.02);
  g.bezierCurveTo(cx - s * 0.62, cy + s * 0.5, cx - s * 0.18, cy + s * 0.74, cx, cy + s * 0.8);
  g.bezierCurveTo(cx + s * 0.18, cy + s * 0.74, cx + s * 0.62, cy + s * 0.5, cx + s * 0.62, cy + s * 0.02);
  g.bezierCurveTo(cx + s * 0.62, cy - s * 0.44, cx + s * 0.08, cy - s * 0.62, cx, cy - s * 0.22);
  g.closePath();
}

/** Draw a plus/cross sign centered at (cx, cy), tight inside the rx*ry box. */
const plusPath = (g, cx, cy, rx, ry) => {
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
const drawDoubleArrowPath = (g, ctx, start, end, color) => {
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
