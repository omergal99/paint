// js/tools/EyedropperTool.js
// Left-click samples into the primary color, right-click into secondary.
// Either way, the sampled color is pushed to the ColorInspector bar so the
// user can copy the exact RGB / hex value out of the app.
// It also shows a magnified pixel-grid balloon above the cursor for precision.

import { rgbToHex } from '../utils/color.js';

export class EyedropperTool {
  constructor() {
    this.name = 'eyedropper';
    this.cursor = 'crosshair';
    this.balloon = document.getElementById('magnifier-balloon');
    this.magCanvas = document.getElementById('magnifier-canvas');
    if (this.magCanvas) {
      this.magCtx = this.magCanvas.getContext('2d');
      this.magCtx.imageSmoothingEnabled = false; // keep it pixelated
    }
  }

  onActivate() {
    if (this.balloon) this.balloon.style.display = 'none';
  }

  onDeactivate() {
    if (this.balloon) this.balloon.style.display = 'none';
  }

  onDown(pt, ctx, e) {
    const { r, g, b } = ctx.canvasManager.getPixelColor(pt.x, pt.y);
    const hex = rgbToHex(r, g, b);
    if (pt.button === 2) ctx.setSecondaryColor(hex);
    else ctx.setPrimaryColor(hex);
    ctx.colorInspector.show({ r, g, b, hex });
  }

  onMove(pt, ctx, e) {
    if (!this.balloon || !this.magCtx) return;
    
    // Position balloon
    this.balloon.style.display = 'block';
    this.balloon.style.left = (e.clientX + 15) + 'px';
    this.balloon.style.top = (e.clientY + 15) + 'px';
    
    // Draw 9x9 zoomed grid
    const sx = Math.floor(pt.x) - 4;
    const sy = Math.floor(pt.y) - 4;
    const size = 9;
    
    this.magCtx.clearRect(0, 0, 90, 90);
    this.magCtx.drawImage(
      ctx.canvasManager.canvas, 
      sx, sy, size, size, 
      0, 0, 90, 90
    );
  }

  onUp() {}
}
