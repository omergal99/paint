const canvasSampleHash = `(() => {
  const canvas = document.querySelector('#paint-canvas');
  if (!canvas) return null;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  const size = 48;
  const x = Math.max(0, Math.floor(canvas.width / 2) - Math.floor(size / 2));
  const y = Math.max(0, Math.floor(canvas.height / 2) - Math.floor(size / 2));
  const pixels = context.getImageData(x, y, Math.min(size, canvas.width), Math.min(size, canvas.height)).data;
  let hash = 2166136261;
  for (const pixel of pixels) hash = Math.imul(hash ^ pixel, 16777619);
  return hash >>> 0;
})()`;

export const createPaintAdapter = async ({ browser, baseUrl } = {}) => {
  if (!browser || !baseUrl) throw new Error('The Paint adapter requires a browser session and base URL.');
  await browser.installScriptOnNewDocument(`
    window.__paintLocalTestReady = false;
    window.addEventListener('paint:ready', () => {
      window.__paintLocalTestReady = true;
    }, { once: true });
  `);

  const open = async ({ width, height, mobile = false } = {}) => {
    await browser.clearOrigin(new URL(baseUrl).origin);
    await browser.setViewport({ width, height, mobile });
    await browser.navigate(baseUrl);
    await browser.resetSessionStorage(baseUrl);
    await browser.waitForFunction(
      'window.__paintLocalTestReady === true && document.querySelector("#paint-canvas")?.width > 0',
    );
    return browser.evaluate(`(() => {
      const canvas = document.querySelector('#paint-canvas');
      return {
        title: document.title,
        viewport: { width: window.innerWidth, height: window.innerHeight },
        touchPoints: navigator.maxTouchPoints,
        canvas: { width: canvas.width, height: canvas.height },
      };
    })()`);
  };

  const canvasGeometry = () => browser.evaluate(`(() => {
    const canvas = document.querySelector('#paint-canvas');
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    return {
      left: rect.left,
      top: rect.top,
      width: rect.width,
      height: rect.height,
      pixelWidth: canvas.width,
      pixelHeight: canvas.height,
    };
  })()`);

  const selectBrush = async () => {
    const bounds = await browser.evaluate(`(() => {
      const button = document.querySelector('button[data-tool="brush"]');
      if (!button) return null;
      button.scrollIntoView({ block: 'center', inline: 'center' });
      const rect = button.getBoundingClientRect();
      const visible = getComputedStyle(button).display !== 'none'
        && getComputedStyle(button).visibility !== 'hidden'
        && rect.width > 0
        && rect.height > 0;
      return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2, visible };
    })()`);
    if (!bounds?.visible) throw new Error('The Paint adapter could not find a visible Brush tool button.');
    await browser.mouseClick(bounds);
  };

  const assertActiveTool = async (toolName) => {
    if (typeof toolName !== 'string' || !toolName.trim()) {
      throw new Error('An active tool name is required.');
    }
    await browser.waitForFunction(`document.querySelector(${JSON.stringify(`.tool-btn[data-tool="${toolName}"]`)})?.classList.contains('active') === true`);
  };

  const strokeCoordinates = async () => {
    const rect = await canvasGeometry();
    if (!rect || rect.width <= 0 || rect.height <= 0) {
      throw new Error('The Paint canvas is not visible for pointer input.');
    }
    const midpointX = rect.left + rect.width / 2;
    const midpointY = rect.top + rect.height / 2;
    const halfLength = Math.min(40, rect.width / 8);
    return {
      fromX: midpointX - halfLength,
      fromY: midpointY,
      toX: midpointX + halfLength,
      toY: midpointY,
    };
  };

  const drawStroke = async ({ input = 'mouse' } = {}) => {
    const coordinates = await strokeCoordinates();
    if (input === 'touch') {
      await browser.touchDrag(coordinates);
    } else if (input === 'mouse') {
      await browser.mouseDrag(coordinates);
    } else {
      throw new Error(`Unsupported Paint test input: ${input}`);
    }
  };

  const sampleHash = () => browser.evaluate(canvasSampleHash);
  const waitForHashChange = (previousHash) => browser.waitForFunction(
    `(${canvasSampleHash}) !== ${previousHash}`,
  );

  return Object.freeze({ open, canvasGeometry, selectBrush, assertActiveTool, drawStroke, sampleHash, waitForHashChange });
};
