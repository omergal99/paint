import quieterAssert from './helpers/quieter-assert.mjs';
const assert = quieterAssert;
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const root = path.resolve(import.meta.dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

// Phase 8: selection and clipboard correctness.

test('selection handles stay a fixed size on screen at every zoom level', () => {
  // The handles live inside #canvas-scale, which carries the zoom transform, so
  // they used to grow and shrink with the canvas. ViewportManager already
  // publishes `--zoom-inverse` (1 / zoom) on that element; a canvas size of
  // base/zoom therefore renders as a constant screen size.
  const css = read('css/styles.css');
  const viewport = read('js/canvas/ViewportManager.js');
  assert.match(viewport, /setProperty\('--zoom-inverse', String\(1 \/ scale\)\)/);

  const handles = css.slice(css.indexOf('.selection-handle {'));
  assert.match(handles, /transform: scale\(var\(--zoom-inverse, 1\)\)/);
  assert.match(handles, /transform-origin: center/);
  assert.doesNotMatch(handles, /translateZ\(0\)/);

  // The rotate handle sits in the same transformed box and needs the same fix.
  const rotate = css.slice(css.indexOf('.selection-rotate {'));
  assert.match(rotate, /transform: scale\(var\(--zoom-inverse, 1\)\)/);
});

test('the handles really are inside the zoom-transformed box', () => {
  // Guards the premise of the fix: if the markup ever moves the handles out of
  // #canvas-scale the inverse zoom would shrink them instead of normalising.
  const html = read('index.html');
  const scaleOpen = html.indexOf('<div class="canvas-scale" id="canvas-scale"');
  const scaleClose = html.indexOf('/canvas-scale -->');
  const firstHandle = html.indexOf('data-selection-handle="nw"');
  const rotateHandle = html.indexOf('id="selection-rotate"');
  assert.ok(scaleOpen > -1 && scaleClose > scaleOpen);
  assert.ok(firstHandle > scaleOpen && firstHandle < scaleClose);
  assert.ok(rotateHandle > scaleOpen && rotateHandle < scaleClose);
});

test('a selection move records one atomic history entry, not a half-applied step', () => {
  const history = read('js/history/HistoryManager.js');
  const select = read('js/tools/SelectTool.js');
  const main = read('js/main.js');

  // Lifting the region opens a transaction instead of pushing a step that only
  // captures the hole, not the move.
  assert.match(history, /beginTransaction\(\) \{/);
  assert.match(history, /commitTransaction\(\) \{/);
  assert.match(history, /abortTransaction\(\) \{/);
  assert.match(select, /ctx\.historyManager\.beginTransaction\(\);/);
  assert.doesNotMatch(select, /ctx\.historyManager\.snapshot\(\);/);

  // The entry is recorded when the selection is committed, not at pointerdown.
  const commit = main.slice(main.indexOf('const commitFloatingSelection ='), main.indexOf('const commitFloatingSelection =') + 900);
  assert.match(commit, /historyManager\.commitTransaction\(\);/);
});

test('undo discards the floating selection before restoring pixels', () => {
  // The float is painted on the overlay canvas. Restoring the base canvas under
  // it changes nothing on screen, which is why one Ctrl+Z looked like a no-op
  // and users had to press it twice.
  const history = read('js/history/HistoryManager.js');
  const main = read('js/main.js');
  assert.match(history, /this\.onBeforeRestore\?\.\(\);/);
  assert.match(main, /historyManager\.onBeforeRestore = \(\) => discardFloatingSelection\(\);/);

  const discard = main.slice(main.indexOf('const discardFloatingSelection ='));
  assert.match(discard.slice(0, 400), /historyManager\.abortTransaction\(\);/);
});

test('undo settles an open transaction before the empty-stack guard', () => {
  // The transaction's "before" entry is held outside the undo stack, so it must
  // be committed first or an in-flight move would be silently dropped.
  const history = read('js/history/HistoryManager.js');
  const guard = history.slice(history.indexOf('async _undoNow()'), history.indexOf('async _undoNow()') + 500);
  const commitAt = guard.indexOf('this.commitTransaction();');
  const stackAt = guard.indexOf('this.undoStack.length === 0');
  assert.ok(commitAt > -1, '_undoNow must settle an open transaction');
  assert.ok(stackAt > -1);
  assert.ok(commitAt < stackAt, 'the transaction must commit before the empty-stack guard');
});

test('the selection frame paints differently while selecting and when active', () => {
  // The marquee being dragged has no area yet; once the region exists it becomes
  // a real, movable selection. Those are two different states and must not look
  // the same, otherwise an active selection reads as a rendering glitch.
  const main = read('js/main.js');
  const appearance = read('js/services/selection/selectionAppearance.js');
  const css = read('css/styles.css');

  assert.match(main, /const isActiveSelection = \(\) => Boolean\(canvasManager\.selection\?\.w && canvasManager\.selection\?\.h\);/);
  assert.match(main, /active: isActiveSelection\(\)/);

  // Two distinct colours, thicker stroke when active.
  assert.match(appearance, /activeOutlineColor/);
  assert.match(appearance, /strokeStyle = active \? appearance\.activeOutlineColor : appearance\.outlineColor/);
  assert.match(appearance, /activeOutlineWidth: 2/);

  // Both are overridable from Settings through CSS custom properties.
  assert.match(css, /--selection-outline-color:/);
  assert.match(css, /--selection-outline-active-color:/);
});

test('preview mode hides the frame and every handle but keeps the float', () => {
  const main = read('js/main.js');
  const appearance = read('js/services/selection/selectionAppearance.js');
  const html = read('index.html');

  assert.match(html, /id="selection-preview"/);
  // Painting is skipped entirely in preview, but the float stays composited.
  assert.match(appearance, /if \(!context \|\| !region \|\| !region\.w \|\| !region\.h \|\| preview\) return false;/);
  assert.match(main, /preview: selectionPreviewActive/);
  // Handles, rotate and the frame all hide while previewing.
  assert.match(main, /const hidden = selectionPreviewActive \|\| !selectionToolActive/);
  // The preview button stays reachable so the frame can always come back.
  assert.match(main, /selectionPreviewButton\.hidden = !selectionToolActive/);
});

test('the clipboard service owns copy, cut and paste for every trigger', () => {
  const service = read('js/services/clipboard/clipboardService.js');
  const main = read('js/main.js');

  // Native events, the only path that works without a permission prompt.
  assert.match(service, /addEventListener\('paste', handlePaste\)/);
  assert.match(service, /addEventListener\('copy', handleCopy\)/);
  assert.match(service, /addEventListener\('cut', handleCut\)/);
  // Focus decides ownership: a text field keeps its own clipboard behaviour.
  assert.match(service, /if \(isEditableTarget\(event\.target\)\) return;/);
  // One listener per event, and main.js only wires the service up.
  assert.match(main, /clipboardService\.attach\(\);/);
  assert.doesNotMatch(main, /addEventListener\('paste'/);
  assert.doesNotMatch(main, /addEventListener\('copy'/);
  // Ribbon buttons and custom bindings use the same service.
  assert.match(main, /paste: \(\) => clipboardService\.paste\(\)/);
  assert.match(main, /copy: \(\) => clipboardService\.copy\(\)/);
  assert.match(main, /cut: \(\) => clipboardService\.cut\(\)/);
  assert.match(main, /clipboardService\.destroy\(\);/);
});

test('clicking inside a selection does not flash the background fill', () => {
  // Lifting the region fills it with the background colour, but the overlay was
  // only repainted on the next pointermove - so the region showed white between
  // pointerdown and the first move. The lift now repaints immediately.
  const select = read('js/tools/SelectTool.js');
  const lift = select.slice(select.indexOf('if (!ctx.canvasManager.floatingCanvas)'));
  assert.match(lift.slice(0, 700), /fillRegion\(sel, ctx\.canvasManager\.backgroundColor\);/);
  assert.match(lift.slice(0, 700), /ctx\.setSelection\(\{ \.\.\.sel \}\);/);
});

test('selection appearance controls are translated, not hard-coded English', () => {
  const html = read('index.html');
  const messages = read('js/i18n/messages.js');
  for (const key of ['ui.selectionHandleSize', 'ui.selectionOutlineColor', 'ui.selectionActiveColor', 'ui.selectionPreview']) {
    assert.ok(html.includes(`data-i18n="${key}"`), `index.html must reference ${key}`);
    assert.ok(messages.includes(key.split('.')[1]), `messages.js must define ${key}`);
  }
  // Settings writes CSS custom properties rather than pushing values to the canvas.
  const settings = read('js/services/selection/selectionSettings.js');
  assert.match(settings, /applyCssVariable/);
  assert.match(html, /data-css-var="--selection-outline-color"/);
  assert.match(html, /id="setting-selection-preview"/);
});

test('disposing releases an open transaction instead of leaking its entry', () => {
  const history = read('js/history/HistoryManager.js');
  const dispose = history.slice(history.indexOf('  dispose() {'));
  assert.match(dispose.slice(0, 700), /_releaseEntry\(this\._transaction\?\.entry\)/);
  assert.match(dispose.slice(0, 700), /this\._transaction = null;/);
});