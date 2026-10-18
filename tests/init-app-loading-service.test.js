import assert from 'node:assert/strict';
import test from 'node:test';
import {
  getDebugLoadingDelay,
  releaseCanvasLoading,
  releaseRibbonLoading,
  isCanvasReleased,
  isRibbonReleased,
} from '../js/core/initAppLoadingService.js';

const resetServiceState = () => {
  // eslint-disable-next-line no-global-assign
  // Reset module-level flags by re-importing is not possible in a single test
  // run, so we test idempotency within one test and rely on the function's
  // internal guard for cross-test safety.
};

test('getDebugLoadingDelay() returns 0 when debugLoading is absent', () => {
  const savedSearch = globalThis.location?.search;
  Object.defineProperty(globalThis.location, 'search', {
    configurable: true,
    value: '',
  });
  try {
    assert.equal(getDebugLoadingDelay(), 0);
  } finally {
    Object.defineProperty(globalThis.location, 'search', {
      configurable: true,
      value: savedSearch ?? '',
    });
  }
});

test('getDebugLoadingDelay() returns 0 when debugLoading is not 1', () => {
  const savedSearch = globalThis.location?.search;
  Object.defineProperty(globalThis.location, 'search', {
    configurable: true,
    value: '?debugLoading=0',
  });
  try {
    assert.equal(getDebugLoadingDelay(), 0);
  } finally {
    Object.defineProperty(globalThis.location, 'search', {
      configurable: true,
      value: savedSearch ?? '',
    });
  }
});

test('getDebugLoadingDelay() returns the requested ms when debugLoading=1', () => {
  const savedSearch = globalThis.location?.search;
  Object.defineProperty(globalThis.location, 'search', {
    configurable: true,
    value: '?debugLoading=1&loadingMs=1500',
  });
  try {
    assert.equal(getDebugLoadingDelay(), 1500);
  } finally {
    Object.defineProperty(globalThis.location, 'search', {
      configurable: true,
      value: savedSearch ?? '',
    });
  }
});

test('getDebugLoadingDelay() caps at 10000 ms', () => {
  const savedSearch = globalThis.location?.search;
  Object.defineProperty(globalThis.location, 'search', {
    configurable: true,
    value: '?debugLoading=1&loadingMs=99999',
  });
  try {
    assert.equal(getDebugLoadingDelay(), 10000);
  } finally {
    Object.defineProperty(globalThis.location, 'search', {
      configurable: true,
      value: savedSearch ?? '',
    });
  }
});

test('getDebugLoadingDelay() clamps negative values to 0', () => {
  const savedSearch = globalThis.location?.search;
  Object.defineProperty(globalThis.location, 'search', {
    configurable: true,
    value: '?debugLoading=1&loadingMs=-500',
  });
  try {
    assert.equal(getDebugLoadingDelay(), 0);
  } finally {
    Object.defineProperty(globalThis.location, 'search', {
      configurable: true,
      value: savedSearch ?? '',
    });
  }
});

test('releaseCanvasLoading() hides the mask and is idempotent', () => {
  const mask = { hidden: false };
  const savedDocument = globalThis.document;
  globalThis.document = {
    ...savedDocument,
    querySelector: () => mask,
  };
  try {
    assert.equal(isCanvasReleased(), false);
    releaseCanvasLoading();
    assert.equal(mask.hidden, true);
    assert.equal(isCanvasReleased(), true);

    // Idempotent: second call does not throw and mask stays hidden
    assert.doesNotThrow(() => releaseCanvasLoading());
    assert.equal(mask.hidden, true);
  } finally {
    globalThis.document = savedDocument;
  }
});

test('releaseCanvasLoading() does not throw when no mask exists', () => {
  const savedDocument = globalThis.document;
  globalThis.document = {
    ...savedDocument,
    querySelector: () => null,
  };
  try {
    assert.doesNotThrow(() => releaseCanvasLoading());
    assert.equal(isCanvasReleased(), true);
  } finally {
    globalThis.document = savedDocument;
  }
});

test('releaseRibbonLoading() removes ribbon-loading class and is idempotent', () => {
  const ribbon = { classList: { remove: (cls) => {}, contains: (cls) => false } };
  let removedClass = null;
  ribbon.classList.remove = (cls) => { removedClass = cls; };

  assert.equal(isRibbonReleased(), false);
  releaseRibbonLoading(ribbon);
  assert.equal(removedClass, 'ribbon-loading');
  assert.equal(isRibbonReleased(), true);

  // Idempotent: second call does not throw and does not remove again
  let callCount = 0;
  const ribbon2 = { classList: { remove: () => { callCount++; } } };
  releaseRibbonLoading(ribbon2);
  releaseRibbonLoading(ribbon2);
  assert.equal(callCount, 1);
});

test('releaseRibbonLoading() does not throw when ribbon is null', () => {
  assert.doesNotThrow(() => releaseRibbonLoading(null));
  assert.equal(isRibbonReleased(), true);
});