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
  id: 'brush-desktop',
  name: 'Desktop app loads and Brush changes canvas pixels',
  category: 'e2e-smoke',
  device: 'Desktop',
  viewport: { width: 1280, height: 800, deviceScaleFactor: 1 },
}, async ({ browser: session, step }) => {
  let state;
  await step('Seed stale session state on the app origin', async () => {
    const fixtureUrl = new URL('tests/fixtures/session-state.html', process.env.LOCAL_BROWSER_BASE_URL);
    await session.navigate(fixtureUrl.href);
    await session.waitForFunction('document.readyState === "complete"');
    await session.evaluate('sessionStorage.setItem("harness-isolation-probe", "stale")');
  });
  await step('Open app in a clean browser state before app scripts run', async () => {
    state = await paint.open({ width: 1280, height: 800, deviceScaleFactor: 1 });
    assert.equal(state.viewport.width, 1280);
    assert.equal(state.viewport.height, 800);
    assert.equal(state.canvas.width, 800);
    assert.equal(state.canvas.height, 600);
    assert.equal(state.deviceScaleFactor, 1);
    assert.equal(await session.evaluate('navigator.language'), 'en-US');
    assert.equal(await session.evaluate('Intl.DateTimeFormat().resolvedOptions().timeZone'), 'UTC');
    assert.equal(await session.evaluate('matchMedia("(prefers-color-scheme: light)").matches'), true);
    assert.equal(await session.evaluate('matchMedia("(prefers-reduced-motion: reduce)").matches'), true);
  });
  await step('Verify session storage is cleared before app startup', async () => {
    assert.equal(
      await session.evaluate('window.__browserHarnessSessionStorageClearedBeforePageScripts'),
      true,
    );
    assert.equal(await session.evaluate('sessionStorage.getItem("harness-isolation-probe")'), null);
  });
  let before;
  await step('Capture canvas baseline', async () => {
    before = await paint.sampleHash();
  });
  await step('Select Brush and verify active tool state', async () => {
    await paint.selectBrush();
    await paint.assertActiveTool('brush');
  });
  await step('Draw and verify canvas pixels changed', async () => {
    await paint.drawStroke();
    await paint.waitForHashChange(before);
  });
});
