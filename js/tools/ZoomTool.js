// js/tools/ZoomTool.js
export class ZoomTool {
  constructor() {
    this.name = 'zoom';
    this.cursor = 'zoom-in';
  }

  onDown(pt, ctx) {
    const next = pt.button === 2 ? ctx.viewportManager.zoom - 50 : ctx.viewportManager.zoom + 50;
    ctx.viewportManager.setZoom(next);
  }

  onMove() {}
  onUp() {}
}
