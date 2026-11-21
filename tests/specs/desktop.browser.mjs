import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { createBrowserTest } from '../core/browser-test.mjs';
import { createBrowserSessionFromEnvironment } from '../core/browser-session.mjs';
import { createPaintAdapter } from '../adapters/paint/application.mjs';

const browser = await createBrowserSessionFromEnvironment();
const paint = await createPaintAdapter({
  browser,
  baseUrl: process.env.LOCAL_BROWSER_BASE_URL,
});
const browserTest = createBrowserTest({
  test,
  browser,
  artifactsDirectory: process.env.LOCAL_BROWSER_FAILURE_DIR,
});

after(() => browser.close());

browserTest('desktop app loads and Brush changes canvas pixels', async () => {
  const state = await paint.open({ width: 1280, height: 800 });
  assert.equal(state.viewport.width, 1280);
  assert.equal(state.viewport.height, 800);
  assert.equal(state.canvas.width, 800);
  assert.equal(state.canvas.height, 600);

  const before = await paint.sampleHash();
  await paint.selectBrush();
  await paint.drawStroke();
  await paint.waitForHashChange(before);
});
