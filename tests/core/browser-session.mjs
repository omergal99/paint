import fs from 'node:fs/promises';
import path from 'node:path';
import { connectCdp } from './cdp-client.mjs';
import { createTestConfig } from './test-config.mjs';

const describeException = (details) => (
  details.exception?.description
  || details.text
  || details.exception?.value
  || 'Uncaught browser exception'
);

export const sanitizeNetworkUrl = (value) => {
  try {
    const url = new URL(value);
    url.username = '';
    url.password = '';
    url.search = '';
    url.hash = '';
    return url.href;
  } catch {
    return '<invalid URL>';
  }
};

const isLoopbackRequest = (url) => {
  try {
    const parsed = new URL(url);
    return ['127.0.0.1', 'localhost', '[::1]'].includes(parsed.hostname);
  } catch {
    return false;
  }
};

export const createBrowserSession = async ({ webSocketUrl, config = createTestConfig() } = {}) => {
  const { browserCommandTimeoutMs: commandTimeoutMs } = config;
  const cdp = await connectCdp({
    url: webSocketUrl,
    timeoutMs: commandTimeoutMs,
    closeTimeoutMs: config.browserCloseTimeoutMs,
  });
  const consoleErrors = [];
  const uncaughtExceptions = [];
  const browserLogErrors = [];
  const externalRequests = [];
  const networkFailures = [];
  try {
    await cdp.send('Page.enable');
    await cdp.send('Runtime.enable');
    await cdp.send('Log.enable');
    await cdp.send('Network.enable');
    await cdp.send('Network.setBypassServiceWorker', { bypass: true });
    await cdp.send('Fetch.enable', {
      patterns: [{ urlPattern: 'http://*/*' }, { urlPattern: 'https://*/*' }],
    });

    cdp.on('Runtime.exceptionThrown', ({ exceptionDetails }) => {
      uncaughtExceptions.push(describeException(exceptionDetails));
    });
    cdp.on('Runtime.consoleAPICalled', ({ type, args = [] }) => {
      if (type !== 'error') return;
      consoleErrors.push(args.map((argument) => argument.value ?? argument.description ?? '').join(' '));
    });
    cdp.on('Log.entryAdded', ({ entry }) => {
      if (entry.level === 'error') browserLogErrors.push(entry.text || 'Browser log error');
    });
    cdp.on('Network.responseReceived', ({ response }) => {
      if (response?.status >= 400) {
        networkFailures.push(`${response.status} ${sanitizeNetworkUrl(response.url)}`);
      }
    });
    cdp.on('Network.loadingFailed', ({ errorText, requestId, blockedReason }) => {
      networkFailures.push(`${errorText || 'Request failed'}${blockedReason ? ` (${blockedReason})` : ''} [${requestId}]`);
    });
    cdp.on('Fetch.requestPaused', ({ requestId, request }) => {
      const url = request?.url || '';
      const action = isLoopbackRequest(url)
        ? send('Fetch.continueRequest', { requestId })
        : (externalRequests.push(sanitizeNetworkUrl(url)), send('Fetch.failRequest', { requestId, errorReason: 'BlockedByClient' }));
      action.catch((error) => browserLogErrors.push(`Network policy enforcement failed: ${error.message}`));
    });

    const send = (method, params) => cdp.send(method, params);
    const evaluate = async (expression) => {
      const response = await send('Runtime.evaluate', {
        expression,
        awaitPromise: true,
        returnByValue: true,
        userGesture: true,
      });
      if (response.exceptionDetails) {
        throw new Error(`Browser evaluation failed: ${describeException(response.exceptionDetails)}`);
      }
      return response.result?.value;
    };
    const waitForFunction = async (expression, {
      timeoutMs = config.uiConditionTimeoutMs,
      pollMs = config.pollIntervalMs,
    } = {}) => {
      const deadline = Date.now() + timeoutMs;
      let lastValue;
      while (Date.now() < deadline) {
        lastValue = await evaluate(expression);
        if (lastValue) return lastValue;
        await new Promise((resolve) => setTimeout(resolve, pollMs));
      }
      throw new Error(`Browser condition timed out after ${timeoutMs}ms: ${expression} (last value: ${String(lastValue)})`);
    };
    const waitForApplication = (expression) => waitForFunction(expression, {
      timeoutMs: config.appReadyTimeoutMs,
      pollMs: config.pollIntervalMs,
    });
    const setViewport = async ({ width, height, mobile = false } = {}) => {
      if (!Number.isInteger(width) || width < 1 || !Number.isInteger(height) || height < 1) {
        throw new Error('Viewport width and height must be positive integers.');
      }
      await send('Emulation.setDeviceMetricsOverride', {
        width,
        height,
        deviceScaleFactor: 1,
        mobile,
      });
      await send('Emulation.setTouchEmulationEnabled', mobile
        ? { enabled: true, maxTouchPoints: 1 }
        : { enabled: false });
    };
    const navigate = async (url) => {
      const result = await send('Page.navigate', { url });
      if (result.errorText) throw new Error(`Browser navigation failed: ${result.errorText}`);
    };
    const installScriptOnNewDocument = async (source) => {
      if (typeof source !== 'string' || !source.trim()) {
        throw new Error('A non-empty initialization script is required.');
      }
      return send('Page.addScriptToEvaluateOnNewDocument', { source });
    };
    const removeScriptOnNewDocument = (identifier) => {
      if (!identifier) return Promise.resolve();
      return send('Page.removeScriptToEvaluateOnNewDocument', { identifier });
    };
    const clearOrigin = async (origin) => {
      const parsed = new URL(origin);
      await send('Storage.clearDataForOrigin', {
        origin: parsed.origin,
        storageTypes: 'all',
      });
    };
    const clearSessionStorageBeforeNextNavigation = async (origin) => {
      const parsed = new URL(origin);
      return installScriptOnNewDocument(
        `if (location.origin === ${JSON.stringify(parsed.origin)}) {
          sessionStorage.clear();
          window.__browserHarnessSessionStorageClearedBeforePageScripts = sessionStorage.length === 0;
        }`,
      );
    };
    const mouseClick = async ({ x, y } = {}) => {
      await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y });
      await send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', buttons: 1, clickCount: 1 });
      await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', buttons: 0, clickCount: 1 });
    };
    const mouseDrag = async ({ fromX, fromY, toX, toY } = {}) => {
      await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: fromX, y: fromY });
      await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: fromX, y: fromY, button: 'left', buttons: 1, clickCount: 1 });
      await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: toX, y: toY, button: 'left', buttons: 1 });
      await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: toX, y: toY, button: 'left', buttons: 0, clickCount: 1 });
    };
    const touchDrag = async ({ fromX, fromY, toX, toY } = {}) => {
      const point = (x, y) => ({ id: 1, x, y, radiusX: 2, radiusY: 2, force: 1 });
      await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point(fromX, fromY)] });
      await send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [point(toX, toY)] });
      await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    };
    const captureScreenshot = async (filePath) => {
      const { data } = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      await fs.writeFile(filePath, Buffer.from(data, 'base64'));
      return filePath;
    };
    const assertNoBrowserErrors = () => {
      const issues = [
        ...consoleErrors.filter(Boolean),
        ...uncaughtExceptions.filter(Boolean),
        ...browserLogErrors.filter(Boolean),
        ...networkFailures.filter(Boolean),
        ...externalRequests.map((url) => `Unexpected external network request: ${url}`),
      ];
      if (issues.length === 0) return;
      const uniqueIssues = [...new Set(issues)];
      throw new Error(`Browser reported test failures:\n${uniqueIssues.map((issue) => `- ${issue}`).join('\n')}`);
    };
    const diagnostics = () => Object.freeze({
      consoleErrors: [...new Set(consoleErrors)],
      uncaughtExceptions: [...new Set(uncaughtExceptions)],
      browserLogErrors: [...new Set(browserLogErrors)],
      unexpectedNetworkRequests: [...new Set(externalRequests)],
      networkFailures: [...new Set(networkFailures)],
    });

    return Object.freeze({
      send,
      evaluate,
      waitForFunction,
      waitForApplication,
      setViewport,
      navigate,
      installScriptOnNewDocument,
      removeScriptOnNewDocument,
      clearOrigin,
      clearSessionStorageBeforeNextNavigation,
      mouseClick,
      mouseDrag,
      touchDrag,
      captureScreenshot,
      clearBrowserErrors: () => {
        consoleErrors.length = 0;
        uncaughtExceptions.length = 0;
        browserLogErrors.length = 0;
        externalRequests.length = 0;
        networkFailures.length = 0;
      },
      diagnostics,
      assertNoBrowserErrors,
      close: cdp.close,
    });
  } catch (error) {
    await cdp.close();
    throw error;
  }
};

export const createBrowserSessionFromEnvironment = async () => {
  const webSocketUrl = process.env.LOCAL_BROWSER_CDP_URL;
  if (!webSocketUrl) throw new Error('LOCAL_BROWSER_CDP_URL is missing; start the suite with npm run test:local.');
  return createBrowserSession({ webSocketUrl, config: createTestConfig() });
};
