import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { createBrowserTest } from '../core/browser-test.mjs';
import { createBrowserSessionFromEnvironment } from '../core/browser-session.mjs';
import { createPaintAdapter } from '../adapters/paint/application.mjs';
import { createTestConfig } from '../core/test-config.mjs';

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
  id: 'brush-mobile',
  name: 'Mobile viewport receives touch input and paints canvas pixels',
  category: 'e2e-smoke',
  device: 'Mobile emulation',
  viewport: { width: 390, height: 844, deviceScaleFactor: 1 },
  environment: { colorScheme: 'dark', reducedMotion: 'no-preference' },
}, async ({ browser: session, step }) => {
  let before;
  await step('Open app with a clean mobile-emulated viewport', async () => {
    const state = await paint.open({
      width: 390,
      height: 844,
      mobile: true,
      deviceScaleFactor: 1,
    });
    assert.equal(state.viewport.width, 390);
    assert.equal(state.viewport.height, 844);
    assert.ok(state.touchPoints > 0, 'Mobile emulation must expose touch input.');
    assert.equal(state.deviceScaleFactor, 1);
    assert.equal(await session.evaluate('navigator.language'), 'en-US');
    assert.equal(await session.evaluate('Intl.DateTimeFormat().resolvedOptions().timeZone'), 'UTC');
    assert.equal(await session.evaluate('matchMedia("(prefers-color-scheme: dark)").matches'), true);
    assert.equal(await session.evaluate('matchMedia("(prefers-reduced-motion: no-preference)").matches'), true);
  });
  await step('Select Brush and verify active tool state', async () => {
    await paint.selectBrush();
    await paint.assertActiveTool('brush');
  });
  await step('Capture canvas baseline', async () => {
    before = await paint.sampleHash();
  });
  await step('Draw by touch and verify canvas pixels changed', async () => {
    await paint.drawStroke({ input: 'touch' });
    await paint.waitForHashChange(before);
  });
});
