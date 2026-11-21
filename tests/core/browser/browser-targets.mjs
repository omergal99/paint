import { connectCdp } from './cdp-client.mjs';
import { DEFAULT_TEST_CONFIG } from '../../config/test-config.mjs';

const delay = (durationMs) => new Promise((resolve) => setTimeout(resolve, durationMs));

const pageWebSocketUrl = async ({
  port,
  targetId,
  timeoutMs,
  pollIntervalMs,
}) => {
  const deadline = Date.now() + timeoutMs;
  let lastError = null;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/json/list`);
      if (!response.ok) throw new Error(`Chrome target list returned HTTP ${response.status}.`);
      const targets = await response.json();
      const target = targets.find((item) => item.id === targetId && item.webSocketDebuggerUrl);
      if (target) return target.webSocketDebuggerUrl;
    } catch (error) {
      lastError = error;
    }
    await delay(pollIntervalMs);
  }
  throw new Error(`Timed out waiting for isolated Chrome page ${targetId}${lastError ? `: ${lastError.message}` : '.'}`);
};

export const createBrowserTargetFactory = async ({
  browserWebSocketUrl,
  commandTimeoutMs = DEFAULT_TEST_CONFIG.browserCommandTimeoutMs,
  closeTimeoutMs = DEFAULT_TEST_CONFIG.browserCloseTimeoutMs,
  timeoutMs = DEFAULT_TEST_CONFIG.chromeStartupTimeoutMs,
  pollIntervalMs = DEFAULT_TEST_CONFIG.pollIntervalMs,
} = {}) => {
  const parsedUrl = new URL(browserWebSocketUrl);
  const browser = await connectCdp({
    url: browserWebSocketUrl,
    timeoutMs: commandTimeoutMs,
    closeTimeoutMs,
  });
  let closed = false;

  const openPage = async () => {
    if (closed) throw new Error('Cannot create a page after the browser target factory is closed.');
    const { browserContextId } = await browser.send('Target.createBrowserContext');
    let targetId;
    let websocket;
    try {
      ({ targetId } = await browser.send('Target.createTarget', {
        url: 'about:blank',
        browserContextId,
      }));
      websocket = await pageWebSocketUrl({
        port: Number(parsedUrl.port),
        targetId,
        timeoutMs,
        pollIntervalMs,
      });
    } catch (error) {
      await browser.send('Target.disposeBrowserContext', { browserContextId });
      throw error;
    }

    let pageClosed = false;
    return Object.freeze({
      webSocketUrl: websocket,
      close: async () => {
        if (pageClosed) return;
        pageClosed = true;
        await browser.send('Target.disposeBrowserContext', { browserContextId });
      },
    });
  };

  return Object.freeze({
    openPage,
    close: async () => {
      if (closed) return;
      closed = true;
      await browser.close();
    },
  });
};
