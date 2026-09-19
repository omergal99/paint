// js/tools/ZoomTool.js
export function createZoomTool() {
  function onDown(pt, ctx) {
    const next = pt.button === 2 ? ctx.viewportManager.zoom - 50 : ctx.viewportManager.zoom + 50;
    ctx.viewportManager.setZoom(next);
  }

  return { name: 'zoom', cursor: 'zoom-in', onDown, onMove() {}, onUp() {} };
}
