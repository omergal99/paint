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
  id: 'selection-deselect',
  name: 'Deselect clears selection and restores the previous tool',
  category: 'e2e-feature',
  device: 'Desktop',
  viewport: { width: 1280, height: 800, deviceScaleFactor: 1 },
}, async ({ browser: session, step }) => {
  let baselineHash;
  await step('Open Paint and record the clean canvas state', async () => {
    const state = await paint.open({ width: 1280, height: 800, deviceScaleFactor: 1 });
    assert.deepEqual([state.canvas.width, state.canvas.height], [800, 600]);
    await paint.selectBrush();
    await paint.assertActiveTool('brush');
    baselineHash = await paint.sampleHash();
  });
  await step('Create a selection with Select as the active tool', async () => {
    await paint.selectTool('select');
    await paint.selectCanvasRectangle();
    await session.waitForFunction(
      'document.querySelector(\'[data-selection-handle="se"]\')?.hidden === false',
    );
    assert.equal((await paint.selectionState()).activeTool, 'select');
  });
  await step('Use the Selection menu to deselect and restore Brush', async () => {
    await paint.deselectSelection();
    await session.waitForFunction(`document.querySelector('[data-selection-handle="se"]')?.hidden === true
      && document.querySelector('.tool-btn[data-tool="brush"]')?.classList.contains('active') === true`);
  });
  await step('Verify selection handles are gone and canvas pixels are unchanged', async () => {
    const state = await paint.selectionState();
    assert.equal(state.handlesVisible, false);
    assert.equal(state.activeTool, 'brush');
    assert.equal(await paint.sampleHash(), baselineHash);
  });
});
