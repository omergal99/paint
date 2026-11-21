import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import {
  getDebugLoadingDelay,
  isDevLoadingHold,
  releaseCanvasLoading,
  releaseRibbonLoading,
  isCanvasReleased,
  isRibbonReleased,
  __resetLoadingStateForTesting,
} from '../../../js/core/initAppLoadingService.js';

test.beforeEach(() => {
  __resetLoadingStateForTesting();
});

const withLocation = (search, fn) => {
  const saved = globalThis.location;
  globalThis.location = { search };
  try {
    return fn();
  } finally {
    globalThis.location = saved;
  }
};

const withDocument = (doc, fn) => {
  const saved = globalThis.document;
  globalThis.document = doc;
  try {
    return fn();
  } finally {
    globalThis.document = saved;
  }
};

test('DEV_LOADING_HOLD is disabled by default (CI guard)', () => {
  assert.equal(isDevLoadingHold(), false);
});

// Static guarantee behind the runtime behaviour: while the mask is up, the
// (empty) #overlay-canvas sits behind it. Browser verification (playwright +
// ?debugLoading=1) confirmed elementFromPoint over the canvas centre returns
// the mask until releaseCanvasLoading() fires; these assertions keep the
// markup/CSS invariants from regressing.
test('canvas loading mask covers #overlay-canvas until release', () => {
  const html = fs.readFileSync(new URL('../../../index.html', import.meta.url), 'utf8');
  const styles = fs.readFileSync(new URL('../../../css/styles.css', import.meta.url), 'utf8');
  const maskIdx = html.indexOf('class="canvas-loading-mask"');
  const stageIdx = html.indexOf('id="canvas-stage"');
  const overlayIdx = html.indexOf('id="overlay-canvas"');
  assert.ok(maskIdx > 0 && stageIdx > 0 && overlayIdx > 0, 'markup keeps mask, stage and overlay');
  assert.ok(maskIdx < stageIdx && stageIdx < overlayIdx,
    'the mask precedes the stage that holds #overlay-canvas');
  const ruleAfter = (anchor) => {
    const start = styles.indexOf(anchor);
    assert.ok(start >= 0, `${anchor.trim()} present in styles.css`);
    const open = styles.indexOf('{', start);
    const close = styles.indexOf('}', open);
    return styles.slice(open, close);
  };
  const maskRule = ruleAfter('\n.canvas-loading-mask {');
  assert.match(maskRule, /position:\s*absolute/, 'the mask overlays the viewport');
  assert.match(maskRule, /z-index:\s*\d+/, 'the mask stacks above the canvas stage');
  const stageRule = ruleAfter('\n.canvas-stage {');
  assert.doesNotMatch(stageRule, /z-index/, 'the stage stays below the mask (no own z-index)');
  const viewportRule = ruleAfter('\n.canvas-viewport {');
  assert.match(viewportRule, /position:\s*relative/,
    'the viewport is the positioned containing block for the absolute mask');
});

test('getDebugLoadingDelay() returns 0 when debugLoading is absent', () => {
  withLocation('', () => {
    assert.equal(getDebugLoadingDelay(), 0);
  });
});

test('getDebugLoadingDelay() returns 0 when debugLoading is not 1', () => {
  withLocation('?debugLoading=0', () => {
    assert.equal(getDebugLoadingDelay(), 0);
  });
});

test('getDebugLoadingDelay() returns the requested ms when debugLoading=1', () => {
  withLocation('?debugLoading=1&loadingMs=1500', () => {
    assert.equal(getDebugLoadingDelay(), 1500);
  });
});

test('getDebugLoadingDelay() caps at 10000 ms', () => {
  withLocation('?debugLoading=1&loadingMs=99999', () => {
    assert.equal(getDebugLoadingDelay(), 10000);
  });
});

test('getDebugLoadingDelay() clamps negative values to 0', () => {
  withLocation('?debugLoading=1&loadingMs=-500', () => {
    assert.equal(getDebugLoadingDelay(), 0);
  });
});

test('releaseCanvasLoading() hides the mask and is idempotent', () => {
  const mask = { hidden: false, style: {} };
  withDocument({ querySelector: () => mask }, () => {
    assert.equal(isCanvasReleased(), false);
    releaseCanvasLoading();
    assert.equal(mask.hidden, true);
    assert.equal(isCanvasReleased(), true);

    // Idempotent: second call does not throw and mask stays hidden
    assert.doesNotThrow(() => releaseCanvasLoading());
    assert.equal(mask.hidden, true);
  });
});

test('releaseCanvasLoading() does not throw when no mask exists', () => {
  withDocument({ querySelector: () => null }, () => {
    assert.doesNotThrow(() => releaseCanvasLoading());
    assert.equal(isCanvasReleased(), true);
  });
});

test('releaseRibbonLoading() removes ribbon-loading class once', () => {
  let removedClass = null;
  const ribbon = { classList: { remove: (cls) => { removedClass = cls; } } };

  releaseRibbonLoading(ribbon);
  assert.equal(removedClass, 'ribbon-loading');
  assert.equal(isRibbonReleased(), true);
});

test('releaseRibbonLoading() does not throw when ribbon is null', () => {
  assert.doesNotThrow(() => releaseRibbonLoading(null));
  assert.equal(isRibbonReleased(), true);
});

// The mask must cover the empty overlay-canvas until the restored zoom is
// applied: applyRestoredZoom() calls viewportManager.applyZoom() first and only
// then releases the canvas loading mask, so the resize is never visible.
test('applyRestoredZoom() applies zoom before releasing the canvas mask', () => {
  const source = fs.readFileSync(new URL('../../../js/main.js', import.meta.url), 'utf8');
  const fnStart = source.indexOf('const applyRestoredZoom = () => {');
  assert.ok(fnStart > 0, 'applyRestoredZoom exists in main.js');
  const body = source.slice(fnStart, source.indexOf('};', fnStart));
  const applyIdx = body.indexOf('viewportManager.applyZoom()');
  const releaseIdx = body.indexOf('releaseCanvasLoading()');
  assert.ok(applyIdx > 0, 'applyRestoredZoom applies the restored zoom');
  assert.ok(releaseIdx > 0, 'applyRestoredZoom releases the canvas mask');
  assert.ok(applyIdx < releaseIdx,
    'applyZoom() runs before the mask release so geometry is final under the mask');
});

// The spinner + label are wrapped in a pill div (flex column), mirroring
// .ribbon-loading-content, so the label stays readable over the skeleton bg.
test('canvas loading mask wraps spinner + label in a content pill', () => {
  const html = fs.readFileSync(new URL('../../../index.html', import.meta.url), 'utf8');
  const styles = fs.readFileSync(new URL('../../../css/styles.css', import.meta.url), 'utf8');
  const maskIdx = html.indexOf('class="canvas-loading-mask"');
  assert.ok(maskIdx > 0, 'canvas loading mask exists');
  const maskOpen = html.indexOf('>', maskIdx) + 1;
  const maskClose = html.indexOf('</div>', maskOpen);
  const maskInner = html.slice(maskOpen, maskClose);
  assert.match(maskInner, /<div class="canvas-loading-content">/,
    'spinner + label are wrapped in the content pill');
  const pillIdx = styles.indexOf('\n.canvas-loading-content {');
  assert.ok(pillIdx >= 0, '.canvas-loading-content rule exists');
  const open = styles.indexOf('{', pillIdx);
  const close = styles.indexOf('}', open);
  const pillRule = styles.slice(open, close);
  assert.match(pillRule, /flex-direction:\s*column/, 'the pill stacks spinner over label');
});