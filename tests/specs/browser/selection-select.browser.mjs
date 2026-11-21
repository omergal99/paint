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
  id: 'selection-select',
  name: 'Rectangular selection displays the expected canvas region',
  category: 'e2e-feature',
  device: 'Desktop',
  viewport: { width: 1280, height: 800, deviceScaleFactor: 1 },
}, async ({ browser: session, step }) => {
  let baselineHash;
  await step('Open Paint with a clean desktop canvas', async () => {
    const state = await paint.open({ width: 1280, height: 800, deviceScaleFactor: 1 });
    assert.deepEqual([state.canvas.width, state.canvas.height], [800, 600]);
    baselineHash = await paint.sampleHash();
  });
  await step('Activate Select and draw a rectangular marquee', async () => {
    await paint.selectTool('select');
    await paint.assertActiveTool('select');
    await paint.selectCanvasRectangle();
    await session.waitForFunction(
      'document.querySelector(\'[data-selection-handle="se"]\')?.hidden === false',
    );
  });
  await step('Verify selection bounds and unchanged canvas pixels', async () => {
    const state = await paint.selectionState();
    assert.equal(state.activeTool, 'select');
    assert.equal(state.handlesVisible, true);
    assert.deepEqual(state.bounds, { x: 200, y: 150, width: 400, height: 300 });
    assert.equal(await paint.sampleHash(), baselineHash);
  });
});
