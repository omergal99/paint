import quieterAssert from './helpers/quieter-assert.mjs';
const assert = quieterAssert;
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { APP_VERSION } from '../js/version.js';
import { RELEASE_NOTES } from '../js/releaseNotes.js';
import { EN_MESSAGES, getMessageTemplate } from '../js/i18n/messages.js';

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
  // The controls moved from Settings to the Image sidebar mirror, which builds
  // them from one template - so the markup is asserted on the module, not on
  // a copy that can drift inside index.html.
  const panel = read('js/services/selection/selectionPropertiesPanel.js');
  const messages = read('js/i18n/messages.js');
  const html = read('index.html');
  for (const key of ['ui.selectionHandleSize', 'ui.selectionOutlineColor', 'ui.selectionActiveColor', 'ui.selectionPreview', 'ui.selectionReset']) {
    assert.ok(panel.includes(`data-i18n="${key}"`), `selection panel must reference ${key}`);
    assert.ok(messages.includes(key.split('.')[1]), `messages.js must define ${key}`);
  }
  // Not duplicated in Settings ▸ General any more.
  assert.doesNotMatch(html, /setting-selection-handle-size/);

  const settings = read('js/services/selection/selectionSettings.js');
  assert.match(settings, /applyCssVariable/);
  assert.match(panel, /data-css-var="--selection-outline-color"/);
  assert.match(panel, /id="setting-selection-preview"/);
  // Numeric badge + reset are part of the same panel.
  assert.match(panel, /id="selection-handle-size-value"/);
  assert.match(panel, /id="setting-selection-reset"/);
  assert.match(settings, /resetToDefaults/);
});

test('the image mirror mounts the selection properties panel', () => {
  const mirror = read('js/ui/mirrors/imageMirror.js');
  assert.match(mirror, /id: 'selection-properties'/);
  assert.match(mirror, /host\.append\(buildSelectionPropertiesPanel\(\)\.node\)/);
  assert.match(mirror, /import \{ buildSelectionPropertiesPanel \}/);
});

test('the live preview reads the same variables the canvas overlay uses', () => {
  // If the preview kept its own copy of the colours it would drift from the
  // real selection frame; both must read the CSS custom properties.
  const preview = read('js/services/selection/selectionPreview.js');
  for (const variable of ['--selection-handle-size', '--selection-outline-color', '--selection-outline-active-color']) {
    assert.ok(preview.includes(variable), `preview must read ${variable}`);
  }
  const css = read('css/styles.css');
  assert.match(css, /\.selection-preview-sample-frame \{[\s\S]*?var\(--selection-outline-color/);
  assert.match(css, /\.selection-preview-sample-active \{[\s\S]*?var\(--selection-outline-active-color/);
});

test('the marquee reports that the user is still defining the area', () => {
  const select = read('js/tools/SelectTool.js');
  const main = read('js/main.js');
  const statusBar = read('js/ui/StatusBar.js');
  assert.match(select, /ctx\.setMarqueeStatus\?\.\(true\)/);
  assert.match(select, /ctx\.setMarqueeStatus\?\.\(false\)/);
  assert.match(main, /statusBar\.setMarqueeStatus\?\.\(next\)|statusBar\.setMarqueeSelecting\?\.\(next\)/);
  assert.match(statusBar, /setMarqueeSelecting/);
  assert.match(statusBar, /ui\.selectingArea/);
});

test('preview and rotate travel together as one selection toolbar', () => {
  const html = read('index.html');
  const scale = html.slice(html.indexOf('class="selection-overlay-actions"'));
  assert.ok(scale.includes('id="selection-rotate"'));
  assert.ok(scale.includes('id="selection-preview"'));
  // Both are inside the same wrapper, so they cannot be positioned apart again.
  const start = html.indexOf('class="selection-overlay-actions"');
  const end = html.indexOf('</div>', html.indexOf('id="selection-preview"'));
  assert.ok(start > -1 && end > start);
});

test('an unchanged transaction records nothing instead of a no-op undo step', () => {
  // A click that lifts and drops a selection in the same place produces
  // identical pixels. Recording that would add a history entry where Ctrl+Z
  // appears to do nothing - exactly the "flaky undo" symptom.
  const history = read('js/history/HistoryManager.js');
  const commit = history.slice(history.indexOf('  commitTransaction() {'));
  assert.match(commit.slice(0, 800), /sig && sig === transaction\.signature/);
  assert.match(commit.slice(0, 800), /this\._releaseEntry\(transaction\.entry\);/);
  assert.match(commit.slice(0, 800), /return false;/);
});

test('transactions do not nest and disposing one keeps the stack usable', () => {
  const history = read('js/history/HistoryManager.js');
  const begin = history.slice(history.indexOf('  beginTransaction() {'));
  // A second begin commits the first, so a lost pointerup cannot leak an entry.
  assert.match(begin.slice(0, 400), /if \(this\._transaction\) this\.commitTransaction\(\);/);
  const abort = history.slice(history.indexOf('  abortTransaction() {'));
  assert.match(abort.slice(0, 400), /_releaseEntry\(transaction\.entry\)/);
  assert.match(history, /get hasOpenTransaction\(\)/);
});

test('discarding a floating selection abandons its pending entry', () => {
  // Discard is what Escape and "click outside" do. The pixels of the lift must
  // not stay on the undo stack, or the next Ctrl+Z restores a state the user
  // never actually made.
  const main = read('js/main.js');
  const discard = main.slice(main.indexOf('const discardFloatingSelection ='));
  assert.match(discard.slice(0, 400), /historyManager\.abortTransaction\(\);/);
});

test('redo is reachable again after a discarded selection', () => {
  // Clearing the redo stack is part of taking a new action; the transaction API
  // must keep doing it or redo silently dies after every move.
  const history = read('js/history/HistoryManager.js');
  const commit = history.slice(history.indexOf('  commitTransaction() {'));
  assert.match(commit.slice(0, 900), /this\._clearRedoStack\(\);/);
  assert.match(commit.slice(0, 900), /this\._trimToLimits\(\);/);
});

test('the release gate fails when the shipped version has no release notes', () => {
  // The bug this prevents: bumping package.json and shipping yesterday's notes.
  const gate = read('scripts/release-notes-check.mjs');
  assert.match(gate, /newest\.version !== APP_VERSION/);
  assert.match(gate, /No release notes entry for shipping version/);
  assert.match(gate, /unreleased/i);
  assert.match(gate, /has no English text/);
  // ...and it must actually run as part of the release gate.
  const release = read('scripts/release-check.mjs');
  assert.match(release, /release-notes-check\.mjs/);
});

test('the newest release note describes the shipping version', () => {
  // Reads the real modules, not a regex over source: this is the same check the
  // release gate runs, so a mismatch here is a mismatch in CI too.
  assert.equal(RELEASE_NOTES[0].version, APP_VERSION);
  assert.ok(!/unreleased/i.test(RELEASE_NOTES[0].version));
  for (const key of RELEASE_NOTES[0].highlightKeys) {
    assert.ok(getMessageTemplate(EN_MESSAGES, key), `${key} must have English text`);
  }
  assert.match(read('js/releaseNotes.js'), /'releaseNotes\.v1_8_0\.h1'/);
});

test('disposing releases an open transaction instead of leaking its entry', () => {
  const history = read('js/history/HistoryManager.js');
  const dispose = history.slice(history.indexOf('  dispose() {'));
  assert.match(dispose.slice(0, 700), /_releaseEntry\(this\._transaction\?\.entry\)/);
  assert.match(dispose.slice(0, 700), /this\._transaction = null;/);
});