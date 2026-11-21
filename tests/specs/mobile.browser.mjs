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

browserTest('mobile viewport receives touch input and paints canvas pixels', async () => {
  const state = await paint.open({ width: 390, height: 844, mobile: true });
  assert.equal(state.viewport.width, 390);
  assert.equal(state.viewport.height, 844);
  assert.ok(state.touchPoints > 0, 'Mobile emulation must expose touch input.');

  const before = await paint.sampleHash();
  await paint.selectBrush();
  await paint.drawStroke({ input: 'touch' });
  await paint.waitForHashChange(before);
});
