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

const pasteText = async (session) => {
  await session.send('Input.dispatchKeyEvent', {
    type: 'keyDown',
    key: 'Control',
    code: 'ControlLeft',
    windowsVirtualKeyCode: 17,
  });
  try {
    await session.send('Input.dispatchKeyEvent', {
      type: 'keyDown',
      key: 'v',
      code: 'KeyV',
      windowsVirtualKeyCode: 86,
      modifiers: 2,
    });
    await session.send('Input.dispatchKeyEvent', {
      type: 'keyUp',
      key: 'v',
      code: 'KeyV',
      windowsVirtualKeyCode: 86,
      modifiers: 2,
    });
  } finally {
    await session.send('Input.dispatchKeyEvent', {
      type: 'keyUp',
      key: 'Control',
      code: 'ControlLeft',
      windowsVirtualKeyCode: 17,
    });
  }
};

browserTest({
  id: 'clipboard-text-paste',
  name: 'Browser clipboard text paste opens Paint text editor',
  category: 'e2e-feature',
  device: 'Desktop',
  viewport: { width: 1280, height: 800, deviceScaleFactor: 1 },
}, async ({ browser: session, step }) => {
  const text = 'Paint browser clipboard check';

  await step('Open Paint with a clean desktop browser context', async () => {
    const state = await paint.open({ width: 1280, height: 800, deviceScaleFactor: 1 });
    assert.equal(state.viewport.width, 1280);
    assert.equal(state.viewport.height, 800);
  });
  await step('Seed the browser clipboard with deterministic text', async () => {
    const result = await session.evaluate(`(() => {
      if (!navigator.clipboard?.writeText) return Promise.resolve({ ok: false, reason: 'unavailable' });
      return navigator.clipboard.writeText(${JSON.stringify(text)})
        .then(() => ({ ok: true }), (error) => ({ ok: false, reason: error.name }));
    })()`);
    assert.equal(result.ok, true, `Could not seed browser clipboard: ${result.reason || 'unknown error'}`);
  });
  await step('Paste through the browser keyboard event', async () => {
    await pasteText(session);
    await session.waitForFunction(
      `document.querySelector("#text-editor-input")?.value === ${JSON.stringify(text)}`,
    );
    assert.equal(
      await session.evaluate('document.querySelector(".tool-btn[data-tool=\\"text\\"]")?.classList.contains("active") === true'),
      true,
    );
  });
});
