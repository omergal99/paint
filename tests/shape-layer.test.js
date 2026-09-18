// Behavioural regression tests for "select after draw".
//
// When a shape is lifted as a floating selection it must:
//   1. carry ONLY the shape's ink — never a copy of the background or of the
//      artwork underneath it (that was the "selection selects the whole
//      background" bug); and
//   2. be selected by its real ink bounds, not by the raw drag box (emoji ink is
//      wider than its font size and stroke joins overhang, so the drag box used
//      to leave painted pixels outside their own selection).
//
// CanvasManager is a real class, so this drives the shipped measurement code
// against a tiny fake 2D context. No DOM is needed.
import assert from 'node:assert/strict';
import test from 'node:test';

import { CanvasManager } from '../js/canvas/CanvasManager.js';
import { ShapeTool } from '../js/tools/ShapeTool.js';

/** Alpha mask source: (w, h) => Uint8ClampedArray RGBA, or null for empty. */
let mask = () => null;
/** Counts every getImageData across all fake contexts (used to prove retries). */
let imageDataCalls = 0;
/** Origin of the scratch canvas, captured from its translate(-x0, -y0) call. */
let scratchOrigin = { x: 0, y: 0 };

class FakeCtx {
  constructor(canvas) {
    this.canvas = canvas;
    this.calls = { fillRect: 0, drawImage: [], getImageData: 0 };
    this.fillStyle = ''; this.strokeStyle = ''; this.lineWidth = 1;
    this.lineJoin = ''; this.lineCap = ''; this.font = '';
    this.textAlign = ''; this.textBaseline = '';
  }
  save() {} restore() {} beginPath() {} closePath() {} fill() {} stroke() {}
  rect() {} ellipse() {} moveTo() {} lineTo() {} arcTo() {} fillText() {}
  translate(x, y) { scratchOrigin = { x: -x, y: -y }; }
  fillRect() { this.calls.fillRect++; }
  clearRect() {}
  drawImage(...args) { this.calls.drawImage.push(args); }
  getImageData(x, y, w, h) {
    this.calls.getImageData++;
    imageDataCalls++;
    return { data: mask(w, h) || new Uint8ClampedArray(w * h * 4), width: w, height: h };
  }
}

class FakeCanvas {
  constructor() { this.width = 0; this.height = 0; this.ctx = null; }
  getContext() { return (this.ctx ??= new FakeCtx(this)); }
  toDataURL() { return 'data:image/png;base64,AAAA'; }
}

globalThis.document = globalThis.document || { createElement: () => new FakeCanvas() };

/**
 * Ink rectangle given in CANVAS coordinates. The scratch is translated by
 * (-x0, -y0) and this harness records that origin, so masks can be written in
 * the same coordinates the app draws in.
 */
function inkMask(rect) {
  return (sw, sh) => {
    const ox = scratchOrigin.x;
    const oy = scratchOrigin.y;
    const data = new Uint8ClampedArray(sw * sh * 4);
    for (let cy = rect.y; cy < rect.y + rect.h; cy++) {
      for (let cx = rect.x; cx < rect.x + rect.w; cx++) {
        const px = cx - ox;
        const py = cy - oy;
        if (px < 0 || py < 0 || px >= sw || py >= sh) continue;
        data[(py * sw + px) * 4 + 3] = 255;
      }
    }
    return data;
  };
}

/** Scratch-local coordinates of a canvas-coordinate rect. */
function toLocal(rect) {
  return [rect.x - scratchOrigin.x, rect.y - scratchOrigin.y, rect.w, rect.h];
}

function makeCanvasManager(width = 400, height = 300) {
  return new CanvasManager({
    canvas: new FakeCanvas(),
    overlay: new FakeCanvas(),
    width,
    height,
    backgroundColor: '#ffffff',
  });
}

function makeToolContext(canvasManager, historySink = []) {
  let selection = null;
  return {
    canvasManager,
    historyManager: { snapshot: (options) => { historySink.push(options || {}); return true; } },
    getShapeKind: () => 'emoji',
    getShapeFillMode: () => 'fill',
    getEmoji: () => '',
    setSelection: (region) => { selection = region; },
    getSelection: () => selection,
    setActiveTool: () => {},
  };
}

const drag = { start: { x: 100, y: 100 }, end: { x: 150, y: 150 } };

test('select after draw: layer carries the shape ink only, never the background', () => {
  const cm = makeCanvasManager(400, 300);
  // Drag box is canvas 100..150 (50x50). A wide emoji glyph spills past it on
  // every side: ink runs 92..158 x 96..158. The selection must follow the ink.
  const ink = { x: 92, y: 96, w: 66, h: 62 };
  mask = inkMask(ink);

  const history = [];
  const ctx = makeToolContext(cm, history);
  // The constructor paints/reads the main canvas; measure only what the lift does.
  const base = { fillRect: cm.ctx.calls.fillRect, drawImage: cm.ctx.calls.drawImage.length, imageData: imageDataCalls };
  const lifted = new ShapeTool()._liftAsSelection(ctx, drag.start, drag.end, 0);

  assert.equal(lifted, true, 'the shape should lift as a floating layer');
  const sel = ctx.getSelection();
  assert.deepEqual(sel, ink, 'the selection IS the measured ink bounds');
  // Every inked pixel falls inside the selection — the reported bug was that
  // painted pixels sat outside it ("some sides it draws but not selected"),
  // and the drag box alone is too small for emoji ink.
  const box = { x: drag.start.x, y: drag.start.y, w: 50, h: 50 };
  assert.ok(sel.x < box.x && sel.y < box.y, 'ink spills past the drag box on the top-left');
  assert.ok(sel.x + sel.w > box.x + box.w && sel.y + sel.h > box.y + box.h,
    'ink spills past the drag box on the bottom-right');
  // The layer holds the ink only, so no background pixels travel with it.
  assert.equal(cm.floatingCanvas.width, ink.w);
  assert.equal(cm.floatingCanvas.height, ink.h);
  const [src, sx, sy, sw, sh] = cm.floatingCanvas.ctx.calls.drawImage[0];
  assert.ok(src, 'the layer is cropped from the scratch canvas');
  assert.deepEqual([sx, sy, sw, sh], toLocal(ink), 'cropped at the ink box inside the scratch');
  // The main canvas must never be painted or erased by the lift.
  assert.equal(cm.ctx.calls.fillRect, base.fillRect, 'no background patch is painted on the main canvas');
  assert.equal(cm.ctx.calls.drawImage.length, base.drawImage, 'nothing is copied from the main canvas');
  // The canvas is unchanged until commit, so the snapshot must be forced.
  assert.deepEqual(history, [{ force: true }]);
});

test('select after draw: clipped ink triggers a wider re-measure', () => {
  const cm = makeCanvasManager(2000, 2000);
  const ink = { x: 520, y: 520, w: 40, h: 40 };
  // While the scratch is too small the ink appears to touch its edge, which is
  // the signal that the real shape was cut off. Only a wider scratch shows the
  // ink's true extent.
  mask = (sw, sh) => (sw < 200
    ? inkMask({ x: 475, y: 495, w: 4, h: 4 })(sw, sh) // touches local x = 0
    : inkMask(ink)(sw, sh));
  imageDataCalls = 0;

  const cmContext = makeToolContext(cm);
  const lifted = new ShapeTool()._liftAsSelection(cmContext, { x: 500, y: 500 }, { x: 600, y: 600 }, 0);

  assert.equal(lifted, true);
  const sel = cmContext.getSelection();
  assert.deepEqual(sel, ink, 'the region comes from the widened measurement');
  assert.ok(imageDataCalls >= 2, 'the measurement ran again after detecting clipping');
});

test('select after draw: ink touching the canvas border is not treated as clipped', () => {
  const cm = makeCanvasManager(200, 200);
  // Bounds sit at the canvas corner, so the scratch cannot inflate further.
  const ink = { x: 0, y: 0, w: 5, h: 5 };
  mask = inkMask(ink);
  imageDataCalls = 0;
  const lifted = cm.renderShapeLayer({ x: 0, y: 0, w: 20, h: 20 }, () => {});

  assert.ok(lifted, 'a layer is produced');
  assert.deepEqual({ x: lifted.x, y: lifted.y, w: lifted.w, h: lifted.h }, ink);
  assert.equal(imageDataCalls, 1, 'no pointless retry at the canvas edge');
});

test('select after draw: the measurement is bounded so a huge shape cannot OOM', () => {
  // Big canvas + big shape: growing the scratch again would mean reading more
  // than the 16M px / ~64 MB budget, so the loop must stop after one pass even
  // though the ink still looks clipped.
  const cm = makeCanvasManager(6000, 6000);
  mask = (w, h) => { // top-left pixel: always reads as "ink touching the edge"
    const d = new Uint8ClampedArray(w * h * 4);
    d[3] = 255;
    return d;
  };
  imageDataCalls = 0;
  // 3000px shape => inflate 750 => scratch 4500² = 20.25M px > 16M budget.
  const lifted = cm.renderShapeLayer({ x: 1500, y: 1500, w: 3000, h: 3000 }, () => {});

  assert.ok(lifted, 'a layer is still produced');
  assert.equal(imageDataCalls, 1, 'only one measurement pass: no unbounded growth');
});

test('select after draw: a click (no drag) or empty render falls back to baking', () => {
  const cm = makeCanvasManager();
  mask = () => null; // nothing painted
  assert.equal(cm.renderShapeLayer({ x: 100, y: 100, w: 50, h: 50 }, () => {}), null);

  const ctx = makeToolContext(cm);
  assert.equal(new ShapeTool()._liftAsSelection(ctx, drag.start, drag.end, 0), false);
  assert.equal(new ShapeTool()._liftAsSelection(ctx, { x: 10, y: 10 }, { x: 10, y: 10 }, 0), false,
    'a click with no drag is not a shape');
});

test('select after draw: the stroke overhang allowance widens the scratch', () => {
  const cm = makeCanvasManager(1000, 1000);
  let scratch = null;
  mask = (w, h) => { scratch = { w, h }; return null; };
  cm.renderShapeLayer({ x: 400, y: 400, w: 100, h: 100 }, () => {}, 80); // pad = lineWidth * 2
  assert.deepEqual(scratch, { w: 260, h: 260 }, '25% or the stroke pad, whichever is larger');
});