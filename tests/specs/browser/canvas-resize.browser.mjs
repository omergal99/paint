import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { createBrowserTest } from '../../core/browser/browser-test.mjs';
import { createBrowserSessionFromEnvironment } from '../../core/browser/browser-session.mjs';
import { createPaintAdapter } from '../../adapters/paint/application.mjs';
import { createTestConfig } from '../../config/test-config.mjs';

const browser = await createBrowserSessionFromEnvironment();
const config = createTestConfig();
const paint = await createPaintAdapter({
  browser,
  baseUrl: process.env.LOCAL_BROWSER_BASE_URL,
});
const browserTest = createBrowserTest({
  test,
  browser,
  runDirectory: process.env.LOCAL_BROWSER_RUN_DIR,
  config,
});

after(() => browser.close());

browserTest({
  id: 'canvas-resize',
  name: 'Canvas resize updates dimensions and supports undo and redo',
  category: 'e2e-feature',
  device: 'Desktop',
  viewport: { width: 1280, height: 800, deviceScaleFactor: 1 },
}, async ({ browser: session, step }) => {
  let beforeResizeHash;
  let beforeResizeCenter;
  let afterResizeHash;
  await step('Open Paint and draw a deterministic reference stroke', async () => {
    const state = await paint.open({ width: 1280, height: 800, deviceScaleFactor: 1 });
    assert.deepEqual([state.canvas.width, state.canvas.height], [800, 600]);
    beforeResizeHash = await paint.sampleHash();
    await paint.selectBrush();
    await paint.assertActiveTool('brush');
    await paint.drawStroke();
    await paint.waitForHashChange(beforeResizeHash);
    beforeResizeHash = await paint.sampleHash();
    beforeResizeCenter = await paint.canvasCenterPixel();
    assert.notDeepEqual(beforeResizeCenter, [255, 255, 255, 255]);
  });
  await step('Choose a 50% whole-canvas resize', async () => {
    await paint.openCanvasResizeDialog();
    assert.equal(
      await session.evaluate('document.querySelector("#resize-target-status")?.dataset.i18nRuntime'),
      'ui.resizeTargetWholeCanvas',
    );
    await paint.chooseResizeScale(50);
    assert.deepEqual(
      await session.evaluate(`[
        document.querySelector("#resize-width")?.value,
        document.querySelector("#resize-height")?.value,
      ]`),
      ['400', '300'],
    );
  });
  await step('Apply resize and verify dimensions and painted pixels', async () => {
    await paint.confirmCanvasResize();
    await session.waitForFunction(
      'document.querySelector("#paint-canvas")?.width === 400 && document.querySelector("#paint-canvas")?.height === 300',
    );
    assert.deepEqual(await paint.canvasDimensions(), { width: 400, height: 300 });
    afterResizeHash = await paint.sampleHash();
    assert.notEqual(afterResizeHash, beforeResizeHash);
    assert.notDeepEqual(await paint.canvasCenterPixel(), [255, 255, 255, 255]);
  });
  await step('Undo resize and verify the original pixels and dimensions return', async () => {
    await paint.undo();
    await session.waitForFunction(
      'document.querySelector("#paint-canvas")?.width === 800 && document.querySelector("#paint-canvas")?.height === 600',
    );
    assert.deepEqual(await paint.canvasDimensions(), { width: 800, height: 600 });
    assert.equal(await paint.sampleHash(), beforeResizeHash);
    assert.deepEqual(await paint.canvasCenterPixel(), beforeResizeCenter);
  });
  await step('Redo resize and verify the resized canvas is restored', async () => {
    await paint.redo();
    await session.waitForFunction(
      'document.querySelector("#paint-canvas")?.width === 400 && document.querySelector("#paint-canvas")?.height === 300',
    );
    assert.deepEqual(await paint.canvasDimensions(), { width: 400, height: 300 });
    assert.equal(await paint.sampleHash(), afterResizeHash);
  });
});
