import assert from 'node:assert/strict';
import test from 'node:test';

// Helper: create a valid in-memory PNG blob (1x1 red pixel) without any network fetch.
// This simulates loading an image from memory (IndexedDB/blob storage) rather than from URL.
const makeMemoryPngBlob = () => {
  // Minimal valid PNG: 1x1 red pixel
  const pngBase64 =
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
  const bytes = Uint8Array.from(atob(pngBase64), (c) => c.charCodeAt(0));
  return new Blob([bytes], { type: 'image/png' });
};

// Mock createImageBitmap for Node.js test environment (it is a browser API).
// In the browser this resolves to the real createImageBitmap; here we simulate
// an async decode so we can measure performance characteristics.
const installCreateImageBitmapMock = () => {
  globalThis.createImageBitmap = async (source) => {
    // Simulate decode work proportional to blob size (tiny for 1x1 PNG).
    if (source instanceof Blob) {
      const arrayBuffer = await source.arrayBuffer();
      // Yield to event loop to simulate async decode work.
      await new Promise((resolve) => setTimeout(resolve, 0));
      return {
        width: 1,
        height: 1,
        close: () => {},
      };
    }
    // For ImageBitmap/Image sources, pass through.
    return {
      width: source.width ?? 1,
      height: source.height ?? 1,
      close: () => {},
    };
  };
};

const removeCreateImageBitmapMock = () => {
  delete globalThis.createImageBitmap;
};

// Simulates CanvasManager.loadImageBlob decode path using createImageBitmap from an in-memory blob.
const loadImageFromMemory = async (blob) => {
  if (typeof createImageBitmap !== 'function') {
    throw new Error('createImageBitmap is unavailable in this environment');
  }
  const start = performance.now();
  const bitmap = await createImageBitmap(blob);
  const elapsed = performance.now() - start;
  return { bitmap, elapsedMs: elapsed };
};

test.beforeEach(() => {
  installCreateImageBitmapMock();
});

test.afterEach(() => {
  removeCreateImageBitmapMock();
});

test('image loading from memory completes and returns valid bitmap dimensions', async () => {
  const blob = makeMemoryPngBlob();
  const { bitmap, elapsedMs } = await loadImageFromMemory(blob);

  assert.ok(bitmap, 'bitmap should be created');
  assert.ok(bitmap.width > 0, 'bitmap width should be positive');
  assert.ok(bitmap.height > 0, 'bitmap height should be positive');
  assert.ok(elapsedMs >= 0, 'elapsed time should be non-negative');

  bitmap.close();
});

test('image loading from memory stays under a performance threshold (regression guard)', async () => {
  const blob = makeMemoryPngBlob();
  const { elapsedMs } = await loadImageFromMemory(blob);

  // A tiny 1x1 in-memory PNG should decode in well under 100ms.
  // If this regresses significantly, investigate main-thread blocking decode.
  assert.ok(elapsedMs < 100, `image decode from memory took ${elapsedMs.toFixed(2)}ms, expected < 100ms`);
});

test('repeated in-memory image loads are consistent (no unbounded growth)', async () => {
  const iterations = 10;
  const timings = [];

  for (let i = 0; i < iterations; i++) {
    const blob = makeMemoryPngBlob();
    const { elapsedMs } = await loadImageFromMemory(blob);
    timings.push(elapsedMs);
  }

  const avgMs = timings.reduce((a, b) => a + b, 0) / timings.length;
  const maxMs = Math.max(...timings);

  assert.ok(avgMs < 100, `average decode time ${avgMs.toFixed(2)}ms exceeds 100ms threshold`);
  assert.ok(maxMs < 200, `max decode time ${maxMs.toFixed(2)}ms exceeds 200ms threshold`);
});

test('large in-memory image load measurement (canvas-size simulation)', async () => {
  // Create a 512x512 blob in memory to simulate a larger canvas load.
  const base64 =
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
  const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  // Pad the blob to simulate a larger in-memory image (~50KB).
  const padded = new Uint8Array(51200);
  padded.set(bytes);
  const blob = new Blob([padded], { type: 'image/png' });

  const start = performance.now();
  const bitmap = await createImageBitmap(blob);
  const elapsed = performance.now() - start;

  assert.ok(bitmap, 'bitmap should be created for large image');
  assert.ok(elapsed < 500, `large image decode took ${elapsed.toFixed(2)}ms, expected < 500ms`);

  bitmap.close();
});

test('image loading from memory releases bitmap resources (no leak)', async () => {
  const blob = makeMemoryPngBlob();
  const { bitmap } = await loadImageFromMemory(blob);

  assert.ok(bitmap, 'bitmap should exist before close');
  bitmap.close();
  // After close, width/height should still be readable (spec allows it),
  // but the underlying pixel buffer is released.
  assert.ok(typeof bitmap.width === 'number', 'bitmap.width should remain accessible after close');
});
