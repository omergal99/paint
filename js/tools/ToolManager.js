// js/tools/ToolManager.js
// Each tool implements: { name, cursor, onDown(pt, ctx), onMove(pt, ctx), onUp(pt, ctx) }
// `pt` is {x, y, button} in true image-pixel coordinates (zoom already divided out).
// `ctx` is a small bag of shared collaborators (canvasManager, historyManager, etc).

export class ToolManager {
  constructor({ surface, viewportManager, toolContext, statusBar }) {
    this.surface = surface; // the element that receives pointer events (overlay canvas)
    this.viewportManager = viewportManager;
    this.toolContext = toolContext;
    this.statusBar = statusBar;
    this.tools = new Map();
    this.active = null;
    this._dragging = false;

    this.onToolChange = null; // callback(toolName)

    surface.addEventListener('contextmenu', (e) => e.preventDefault());
    surface.addEventListener('mousedown', (e) => this._handle('onDown', e));
    surface.addEventListener('mousemove', (e) => this._handle('onMove', e));
    window.addEventListener('mouseup', (e) => {
      if (this._dragging) this._handle('onUp', e);
      this._dragging = false;
    });
    surface.addEventListener('mousemove', (e) => this._reportPosition(e));
    surface.addEventListener('mouseleave', () => this.statusBar?.setPointer(null));
  }

  register(tool) {
    this.tools.set(tool.name, tool);
  }

  setActive(name) {
    if (this.active?.onDeactivate) this.active.onDeactivate(this.toolContext);
    this.active = this.tools.get(name) || null;
    if (this.active) {
      this.surface.style.cursor = this.active.cursor || 'default';
      if (this.active.onActivate) this.active.onActivate(this.toolContext);
    }
    if (this.onToolChange) this.onToolChange(name);
  }

  _point(e) {
    const { x, y } = this.viewportManager.clientToImage(e.clientX, e.clientY);
    return { x, y, button: e.button };
  }

  _handle(method, e) {
    if (!this.active || !this.active[method]) return;
    if (method === 'onDown') this._dragging = true;
    const pt = this._point(e);
    this.active[method](pt, this.toolContext, e);
  }

  _reportPosition(e) {
    const pt = this._point(e);
    this.statusBar?.setPointer(pt);
  }
}
