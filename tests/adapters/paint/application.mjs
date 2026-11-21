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

  const open = async ({
    width,
    height,
    mobile = false,
    deviceScaleFactor,
  } = {}) => {
    const origin = new URL(baseUrl).origin;
    await browser.clearOrigin(origin);
    await browser.setViewport({ width, height, mobile, deviceScaleFactor });
    const sessionResetScript = await browser.clearSessionStorageBeforeNextNavigation(origin);
    try {
      await browser.navigate(baseUrl);
      await browser.waitForApplication(
        'window.__paintLocalTestReady === true && document.querySelector("#paint-canvas")?.width > 0',
      );
    } finally {
      await browser.removeScriptOnNewDocument(sessionResetScript.identifier);
    }
    return browser.evaluate(`(() => {
      const canvas = document.querySelector('#paint-canvas');
      return {
        title: document.title,
        viewport: { width: window.innerWidth, height: window.innerHeight },
        deviceScaleFactor: window.devicePixelRatio,
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

  const controlBounds = (selector) => browser.waitForFunction(`(() => {
    const control = document.querySelector(${JSON.stringify(selector)});
    if (!control || control.hidden) return false;
    const style = getComputedStyle(control);
    if (style.display === 'none' || style.visibility === 'hidden') return false;
    control.scrollIntoView({ block: 'center', inline: 'center' });
    const rect = control.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return false;
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  })()`);

  const clickControl = async (selector) => {
    const bounds = await controlBounds(selector);
    await browser.mouseClick(bounds);
  };

  const selectTool = async (toolName) => {
    if (typeof toolName !== 'string' || !/^[a-z][a-z0-9-]*$/.test(toolName)) {
      throw new Error('A valid Paint tool name is required.');
    }
    await clickControl(`button[data-tool="${toolName}"]`);
  };

  const selectBrush = () => selectTool('brush');

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

  const selectCanvasRectangle = async ({
    left = 0.25,
    top = 0.25,
    right = 0.75,
    bottom = 0.75,
  } = {}) => {
    if (![left, top, right, bottom].every(Number.isFinite)
      || left < 0 || top < 0 || right > 1 || bottom > 1 || left >= right || top >= bottom) {
      throw new Error('A rectangular selection requires increasing canvas-relative bounds between 0 and 1.');
    }
    const rect = await canvasGeometry();
    if (!rect || rect.width <= 0 || rect.height <= 0) {
      throw new Error('The Paint canvas is not visible for selection input.');
    }
    await browser.mouseDrag({
      fromX: rect.left + rect.width * left,
      fromY: rect.top + rect.height * top,
      toX: rect.left + rect.width * right,
      toY: rect.top + rect.height * bottom,
    });
  };

  const selectionState = () => browser.evaluate(`(() => {
    const canvas = document.querySelector('#paint-canvas');
    const northwest = document.querySelector('[data-selection-handle="nw"]');
    const southeast = document.querySelector('[data-selection-handle="se"]');
    if (!canvas || !northwest || !southeast) return null;
    const canvasRect = canvas.getBoundingClientRect();
    const center = (element) => {
      const rect = element.getBoundingClientRect();
      return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    };
    const nw = center(northwest);
    const se = center(southeast);
    const visible = !northwest.hidden && !southeast.hidden;
    return {
      activeTool: document.querySelector('.tool-btn.active')?.dataset.tool || null,
      handlesVisible: visible,
      bounds: visible ? {
        x: Math.round(nw.x - canvasRect.left),
        y: Math.round(nw.y - canvasRect.top),
        width: Math.round(se.x - nw.x),
        height: Math.round(se.y - nw.y),
      } : null,
    };
  })()`);

  const deselectSelection = async () => {
    await clickControl('#btn-image-more');
    await clickControl('.image-more-menu-items .action-submenu-trigger[aria-label="Selection"]');
    await clickControl('#btn-deselect');
  };

  const openCanvasResizeDialog = async () => {
    await clickControl('#btn-resize-quick');
    await browser.waitForFunction('document.querySelector("#resize-dialog")?.open === true');
  };

  const chooseResizeScale = async (percent) => {
    if (!Number.isInteger(percent) || percent < 1 || percent > 1000) {
      throw new Error('A resize scale must be an integer between 1 and 1000.');
    }
    await clickControl(`[data-resize-scale="${percent}"]`);
  };

  const confirmCanvasResize = async () => {
    await clickControl('#resize-ok');
    await browser.waitForFunction('document.querySelector("#resize-dialog")?.open === false');
  };

  const canvasDimensions = () => browser.evaluate(`(() => {
    const canvas = document.querySelector('#paint-canvas');
    return canvas ? { width: canvas.width, height: canvas.height } : null;
  })()`);

  const canvasCenterPixel = () => browser.evaluate(`(() => {
    const canvas = document.querySelector('#paint-canvas');
    if (!canvas) return null;
    const { data } = canvas.getContext('2d').getImageData(
      Math.floor(canvas.width / 2),
      Math.floor(canvas.height / 2),
      1,
      1,
    );
    return [...data];
  })()`);

  const undo = () => clickControl('#btn-undo');
  const redo = () => clickControl('#btn-redo');

  return Object.freeze({
    open,
    canvasGeometry,
    selectTool,
    selectBrush,
    assertActiveTool,
    drawStroke,
    sampleHash,
    waitForHashChange,
    selectCanvasRectangle,
    selectionState,
    deselectSelection,
    openCanvasResizeDialog,
    chooseResizeScale,
    confirmCanvasResize,
    canvasDimensions,
    canvasCenterPixel,
    undo,
    redo,
  });
};
