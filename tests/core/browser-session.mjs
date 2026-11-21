import fs from 'node:fs/promises';
import path from 'node:path';
import { connectCdp } from './cdp-client.mjs';

const describeException = (details) => (
  details.exception?.description
  || details.text
  || details.exception?.value
  || 'Uncaught browser exception'
);

export const createBrowserSession = async ({ webSocketUrl, commandTimeoutMs = 5000 } = {}) => {
  const cdp = await connectCdp({ url: webSocketUrl, timeoutMs: commandTimeoutMs });
  const browserErrors = [];
  const externalRequests = [];
  try {
    await cdp.send('Page.enable');
    await cdp.send('Runtime.enable');
    await cdp.send('Log.enable');
    await cdp.send('Network.enable');
    await cdp.send('Network.setBypassServiceWorker', { bypass: true });

    cdp.on('Runtime.exceptionThrown', ({ exceptionDetails }) => {
      browserErrors.push(describeException(exceptionDetails));
    });
    cdp.on('Runtime.consoleAPICalled', ({ type, args = [] }) => {
      if (type !== 'error') return;
      browserErrors.push(args.map((argument) => argument.value ?? argument.description ?? '').join(' '));
    });
    cdp.on('Log.entryAdded', ({ entry }) => {
      if (entry.level === 'error') browserErrors.push(entry.text || 'Browser log error');
    });
    cdp.on('Network.requestWillBeSent', ({ request }) => {
      const url = request?.url;
      if (!url) return;
      if (!/^https?:/i.test(url)) return;
      try {
        const parsed = new URL(url);
        if (parsed.hostname !== '127.0.0.1' && parsed.hostname !== 'localhost') {
          externalRequests.push(url);
        }
      } catch {
        externalRequests.push(url);
      }
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
    const waitForFunction = async (expression, { timeoutMs = 12000, pollMs = 50 } = {}) => {
      const deadline = Date.now() + timeoutMs;
      let lastValue;
      while (Date.now() < deadline) {
        lastValue = await evaluate(expression);
        if (lastValue) return lastValue;
        await new Promise((resolve) => setTimeout(resolve, pollMs));
      }
      throw new Error(`Browser condition timed out after ${timeoutMs}ms: ${expression} (last value: ${String(lastValue)})`);
    };
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
      await send('Page.addScriptToEvaluateOnNewDocument', { source });
    };
    const clearOrigin = async (origin) => {
      const parsed = new URL(origin);
      await send('Storage.clearDataForOrigin', {
        origin: parsed.origin,
        storageTypes: 'all',
      });
    };
    const resetSessionStorage = async (origin) => {
      const parsed = new URL(origin);
      await waitForFunction(`location.origin === ${JSON.stringify(parsed.origin)}`);
      await evaluate(`(() => { sessionStorage.clear(); return true; })()`);
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
        ...browserErrors.filter(Boolean),
        ...externalRequests.map((url) => `Unexpected external network request: ${url}`),
      ];
      if (issues.length === 0) return;
      const uniqueIssues = [...new Set(issues)];
      throw new Error(`Browser reported test failures:\n${uniqueIssues.map((issue) => `- ${issue}`).join('\n')}`);
    };

    return Object.freeze({
      send,
      evaluate,
      waitForFunction,
      setViewport,
      navigate,
      installScriptOnNewDocument,
      clearOrigin,
      resetSessionStorage,
      mouseClick,
      mouseDrag,
      touchDrag,
      captureScreenshot,
      clearBrowserErrors: () => {
        browserErrors.length = 0;
        externalRequests.length = 0;
      },
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
  return createBrowserSession({ webSocketUrl });
};
