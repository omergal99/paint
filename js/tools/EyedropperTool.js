// js/tools/EyedropperTool.js
// Left-click samples into the primary color, right-click into secondary.
// Either way, the sampled color is pushed to the ColorInspector bar so the
// user can copy the exact RGB / hex value out of the app.
// It also shows a magnified pixel-grid balloon above the cursor for precision.

import { rgbToHex } from '../utils/color.js';

export function createEyedropperTool() {
    const balloon = document.getElementById('magnifier-balloon');
    const magCanvas = document.getElementById('magnifier-canvas');
    const magCtx = magCanvas?.getContext('2d');
    if (magCtx) {
      magCtx.imageSmoothingEnabled = false; // keep it pixelated
    }

  function hideBalloon() {
    if (balloon) balloon.style.display = 'none';
  }

  function onDown(pt, ctx) {
    const { r, g, b } = ctx.canvasManager.getPixelColor(pt.x, pt.y);
    const hex = rgbToHex(r, g, b);
    if (pt.button === 2) ctx.setSecondaryColor(hex);
    else ctx.setPrimaryColor(hex);
    ctx.colorInspector.show({ r, g, b, hex });
    ctx.setActiveTool?.(ctx.getPreviousTool?.() || 'select');
  }

  function onMove(pt, ctx, e) {
    if (!balloon || !magCtx) return;
    
    // Position balloon
    balloon.style.display = 'block';
    balloon.style.left = (e.clientX + 15) + 'px';
    balloon.style.top = (e.clientY + 15) + 'px';
    
    // Draw 9x9 zoomed grid
    const sx = Math.floor(pt.x) - 4;
    const sy = Math.floor(pt.y) - 4;
    const size = 9;
    
    magCtx.clearRect(0, 0, 90, 90);
    magCtx.drawImage(
      ctx.canvasManager.canvas, 
      sx, sy, size, size, 
      0, 0, 90, 90
    );
  }

  return { name: 'eyedropper', cursor: 'crosshair', onActivate: hideBalloon, onDeactivate: hideBalloon, onDown, onMove, onUp() {} };
}
