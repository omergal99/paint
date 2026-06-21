// js/tools/EyedropperTool.js
// Left-click samples into the primary color, right-click into secondary.
// Either way, the sampled color is pushed to the ColorInspector bar so the
// user can copy the exact RGB / hex value out of the app.

import { rgbToHex } from '../utils/color.js';

export class EyedropperTool {
  constructor() {
    this.name = 'eyedropper';
    this.cursor = 'crosshair';
  }

  onDown(pt, ctx) {
    const { r, g, b } = ctx.canvasManager.getPixelColor(pt.x, pt.y);
    const hex = rgbToHex(r, g, b);
    if (pt.button === 2) ctx.setSecondaryColor(hex);
    else ctx.setPrimaryColor(hex);
    ctx.colorInspector.show({ r, g, b, hex });
  }

  onMove() {}
  onUp() {}
}
