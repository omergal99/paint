// js/tools/FillTool.js
// Classic 4-directional flood fill using a typed-array stack (no recursion,
// so it won't blow the call stack on large canvases).

export class FillTool {
  constructor() {
    this.name = 'fill';
    this.cursor = 'crosshair';
  }

  onDown(pt, ctx) {
    const cm = ctx.canvasManager;
    const x0 = Math.floor(pt.x);
    const y0 = Math.floor(pt.y);
    if (x0 < 0 || y0 < 0 || x0 >= cm.width || y0 >= cm.height) return;

    ctx.historyManager.snapshot();

    const fillColorHex = pt.button === 2 ? cm.secondaryColor : cm.primaryColor;
    const fill = hexToRgba(fillColorHex);

    const imageData = cm.ctx.getImageData(0, 0, cm.width, cm.height);
    const data = imageData.data;
    const w = cm.width;
    const h = cm.height;

    const startIdx = (y0 * w + x0) * 4;
    const target = [data[startIdx], data[startIdx + 1], data[startIdx + 2], data[startIdx + 3]];
    if (colorsMatch(target, fill)) return; // already that color

    const stack = [[x0, y0]];
    const visited = new Uint8Array(w * h);

    while (stack.length) {
      const [x, y] = stack.pop();
      if (x < 0 || x >= w || y < 0 || y >= h) continue;
      const vIdx = y * w + x;
      if (visited[vIdx]) continue;
      const idx = vIdx * 4;
      if (!colorsMatch([data[idx], data[idx + 1], data[idx + 2], data[idx + 3]], target)) continue;

      visited[vIdx] = 1;
      data[idx] = fill[0];
      data[idx + 1] = fill[1];
      data[idx + 2] = fill[2];
      data[idx + 3] = fill[3];

      stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
    }

    cm.ctx.putImageData(imageData, 0, 0);
  }

  onMove() {}
  onUp() {}
}

function hexToRgba(hex) {
  const h = hex.replace('#', '');
  const num = parseInt(h, 16);
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255, 255];
}

function colorsMatch(a, b) {
  return a[0] === b[0] && a[1] === b[1] && a[2] === b[2] && a[3] === b[3];
}
