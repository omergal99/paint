import assert from 'node:assert/strict';
import test from 'node:test';
import {
  getDebugLoadingDelay,
  releaseCanvasLoading,
  releaseRibbonLoading,
  isCanvasReleased,
  isRibbonReleased,
  __resetLoadingStateForTesting,
} from '../js/core/initAppLoadingService.js';

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
  const mask = { hidden: false };
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