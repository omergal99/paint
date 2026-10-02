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
  const panel = read('js/services/selection/selectionPropertiesPanel.js');

  // Preview is a sidebar toggle; there is no canvas button.
  assert.match(panel, /id="setting-selection-preview"/);
  assert.match(appearance, /if \(!context \|\| !region \|\| !region\.w \|\| !region\.h \|\| preview\) return false;/);
  assert.match(main, /preview: selectionPreviewActive/);
  // Handles, rotate and the frame all hide while previewing.
  assert.match(main, /const hidden = selectionPreviewActive \|\| !selectionToolActive/);
  // The preview control lives in the sidebar panel, not the overlay.
  assert.match(main, /document\.getElementById\('setting-selection-preview'\)\?\.checked === true/);
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
  // Delegated, not per-element: the Image mirror mounts lazily, so listeners
  // bound at start would never reach the slider.
  assert.match(settings, /documentRef\?\.addEventListener\('input', handleControlInput\)/);
  assert.match(settings, /target\?\.matches\?\.\('\[data-css-var\]'\)/);
  assert.match(settings, /SELECTION_APPEARANCE_DEFAULTS/);
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
  // The status slot always shows the real measurement. A transient hint could be
  // left on screen when a pointerup is missed, hiding the selection size.
  assert.match(main, /statusBar\.setSelection\(region\);/);
  assert.ok(!main.includes('statusBar.setMarqueeSelecting?.(true)'),
    'the marquee hint must not take over the selection slot');
});

test('preview is driven only from the sidebar, not the canvas overlay', () => {
  // The overlay keeps a single unambiguous affordance (rotate); preview lives in
  // Sidebar ▸ Image ▸ Selection Properties.
  const html = read('index.html');
  const overlay = html.slice(html.indexOf('class="selection-overlay-actions"'));
  assert.ok(overlay.includes('id="selection-rotate"'));
  assert.ok(!html.includes('id="selection-preview"'), 'no canvas preview button');
  const main = read('js/main.js');
  assert.doesNotMatch(main, /selectionPreviewButton/);
  assert.match(main, /const isSelectionPreviewEnabled = \(\) => document\.getElementById\('setting-selection-preview'\)\?\.checked === true;/);
  // Preview still hides the frame and every handle.
  assert.match(main, /const hidden = selectionPreviewActive \|\|/);
});

test('the selection overlay carries the rotate handle', () => {
  const html = read('index.html');
  const start = html.indexOf('class="selection-overlay-actions"');
  assert.ok(start > -1, 'the overlay actions wrapper must exist');
  const wrapper = html.slice(start, html.indexOf('</div>', start));
  assert.ok(wrapper.includes('id="selection-rotate"'));
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

test('the status slot always reports the selection size', () => {
  // Two regressions came from the same "Selecting..." hint: releasing the pointer
  // blanked the slot, and a missed pointerup left it stuck, so an existing
  // selection showed no size at all. The label is now owned by setSelection.
  const main = read('js/main.js');
  const marker = 'const setSelection =';
  const block = main.slice(main.indexOf(marker), main.indexOf(marker) + 1400);
  assert.match(block, /statusBar\.setSelection\(region\);/);
  assert.ok(!/setMarqueeSelecting/.test(block), 'the slot must not be taken over by the marquee hint');
});

test('release notes history is preserved, newest first', () => {
  // Regression: the 1.7.0 entry was `version: APP_VERSION`, so bumping to 1.8.0
  // relabelled it and 1.7.0's notes vanished from About.
  const versions = RELEASE_NOTES.map((entry) => entry.version);
  assert.ok(versions.includes('1.7.0'), '1.7.0 must remain in the history');
  assert.ok(versions.includes('1.6.1'));
  assert.equal(new Set(versions).size, versions.length, 'no version may appear twice');
  // Strictly descending, comparing patch numbers too (1.6.1 > 1.6.0).
  const toParts = (v) => v.split('.').map(Number);
  const compare = (a, b) => {
    const left = toParts(a);
    const right = toParts(b);
    for (let i = 0; i < 3; i += 1) {
      const diff = (left[i] || 0) - (right[i] || 0);
      if (diff !== 0) return diff;
    }
    return 0;
  };
  for (let i = 1; i < versions.length; i += 1) {
    assert.ok(compare(versions[i - 1], versions[i]) > 0,
      `history must be newest first: ${versions[i - 1]} then ${versions[i]}`);
  }
  // Every entry's text still resolves, so no release renders blank.
  for (const entry of RELEASE_NOTES) {
    for (const key of entry.highlightKeys || []) {
      assert.ok(getMessageTemplate(EN_MESSAGES, key), `${entry.version}: ${key} must have English text`);
    }
  }
});

test('the release gate refuses a rewritten history', () => {
  const gate = read('scripts/release-notes-check.mjs');
  assert.match(gate, /Duplicate release note entry/);
  assert.match(gate, /are not newest-first/);
  assert.match(gate, /highlight has no English text/);
});

test('the text editor shell previews at true canvas scale, chrome stays fixed', () => {
  // Regression: a zoom-inverse transform on `.text-editor-shell` made the editor
  // render text at screen size `fontSize` while the canvas renders it at
  // `fontSize * zoom`, so the preview and the result stopped lining up at any
  // zoom other than 100%. The shell must scale WITH the canvas; only chrome is
  // normalised.
  const css = read('css/styles.css');
  const shell = css.slice(css.indexOf('.text-editor-shell {'), css.indexOf('.text-editor-toolbar,'));
  assert.ok(!/transform:\s*scale\(var\(--zoom-inverse/.test(shell),
    'the editor shell must not be zoom-inverted: it is a preview of canvas output');
  // The chrome is UI and does get normalised.
  assert.match(css, /\.text-editor-toolbar,\s*\n\.text-editor-shell > \.text-editor-resize \{[\s\S]{0,200}?transform: scale\(var\(--zoom-inverse, 1\)\)/);
  // ViewportManager must actually publish the variable it consumes.
  assert.match(read('js/canvas/ViewportManager.js'), /setProperty\('--zoom-inverse', String\(1 \/ scale\)\)/);
});

test('text commit anchors to the canvas-space origin, not the scaled DOM rect', () => {
  // The commit path must use `origin` (image pixels). Reading a
  // getBoundingClientRect would mix the viewport zoom and the shell's own
  // transform into the placement maths.
  const textTool = read('js/tools/TextTool.js');
  const commit = textTool.slice(textTool.indexOf('const commit = ()'), textTool.indexOf('const open = ('));
  assert.match(commit, /const anchor = origin;/);
  assert.match(commit, /x: anchor\.x,/);
  assert.match(commit, /y: anchor\.y \+ canvasTextOffset,/);
  assert.doesNotMatch(commit, /getBoundingClientRect/);
});

test('open dropdown toggles are visibly pressed', () => {
  // ActionMenuController already publishes aria-expanded, so one rule covers the
  // whole app; without it an open menu looked identical to a hovered button.
  const css = read('css/styles.css');
  assert.match(css, /\.rbtn\[aria-expanded="true"\][\s\S]{0,400}?box-shadow: inset 0 -2px 0 var\(--w10-accent\)/);
  assert.match(css, /\.rbtn\[aria-expanded="true"\]:hover/);
  assert.match(css, /\.rbtn\[aria-expanded="true"\] \.menu-arrow[\s\S]{0,120}?rotate\(180deg\)/);
  assert.match(read('js/ui/ActionMenuController.js'), /setAttribute\('aria-expanded', String\(shouldOpen\)\)/);
});

test('the selection preview sample fits a collapsed sidebar', () => {
  const css = read('css/styles.css');
  const sample = css.slice(css.indexOf('.selection-preview-sample {'));
  assert.match(sample.slice(0, 200), /width: 100px/);
  assert.match(sample.slice(0, 200), /max-width: 100%/);
});

test('idle and active outline colours are independent settings', () => {
  // Regression report: changing "Selection outline color" appeared to do nothing
  // because the active colour was bound to the same control.
  const panel = read('js/services/selection/selectionPropertiesPanel.js');
  assert.match(panel, /data-css-var="--selection-outline-color"/);
  assert.match(panel, /data-css-var="--selection-outline-active-color"/);
  // Distinct ids, so one control cannot overwrite the other.
  assert.match(panel, /id="setting-selection-outline-color"/);
  assert.match(panel, /id="setting-selection-active-color"/);
  const settings = read('js/services/selection/selectionSettings.js');
  assert.match(settings, /'--selection-outline-color': '#0078d4'/);
  assert.match(settings, /'--selection-outline-active-color': '#0b3d91'/);
});

test('interactive drag-rotation uses the injected tool accessor', () => {
  // Regression: `onPointerDown` read a bare `activeToolName`, which does not exist
  // in canvasTransforms, so every pointerdown on the rotate handle threw
  // ReferenceError and drag-rotation was dead. The click path never read it,
  // which is why clicking still looked like it worked.
  const transforms = read('js/app/canvasTransforms.js');
  const onPointerDown = transforms.slice(
    transforms.indexOf('const onPointerDown ='),
    transforms.indexOf('const onPointerDown =') + 600,
  );
  assert.match(onPointerDown, /getActiveToolName\(\) !== 'select'/);
  // Strip comments first: the explanation above names the very identifier the
  // negative check looks for.
  const onPointerDownCode = onPointerDown.split('\n').filter((line) => !line.trim().startsWith('//')).join('\n');
  assert.doesNotMatch(onPointerDownCode, /\bactiveToolName\b/);

  // The accessor must actually be declared as a dependency and supplied.
  assert.match(transforms, /getActiveToolName,/);
  assert.match(read('js/main.js'), /getActiveToolName: \(\) => activeToolName,/);

  // The drag must listen on window for move/up, or a cursor drag cannot rotate.
  assert.match(transforms, /window\.addEventListener\('pointermove', onMove\)/);
  assert.match(transforms, /window\.addEventListener\('pointerup', onUp, \{ once: true \}\)/);
  assert.match(transforms, /clientToImage\(moveEvent\.clientX, moveEvent\.clientY\)/);
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