// js/main.js
import { CanvasManager } from './canvas/CanvasManager.js';
import { ViewportManager } from './canvas/ViewportManager.js';
import { CanvasResizer } from './canvas/CanvasResizer.js';
import { HistoryManager } from './history/HistoryManager.js';
import { ClipboardManager } from './clipboard/ClipboardManager.js';
import { ToolManager } from './tools/ToolManager.js';
import { SelectTool } from './tools/SelectTool.js';
import { createPencilTool, createBrushTool, createEraserTool } from './tools/FreehandTools.js';
import { FillTool } from './tools/FillTool.js';
import { ShapeTool } from './tools/ShapeTool.js';
import { TextTool } from './tools/TextTool.js';
import { EyedropperTool } from './tools/EyedropperTool.js';
import { ZoomTool } from './tools/ZoomTool.js';
import { ColorPalette } from './ui/ColorPalette.js';
import { ColorInspector } from './ui/ColorInspector.js';
import { StatusBar } from './ui/StatusBar.js';
import { Toolbar } from './ui/Toolbar.js';

// ---------- DOM refs ----------
const stage = document.getElementById('canvas-stage');
const canvasEl = document.getElementById('paint-canvas');
const overlayEl = document.getElementById('overlay-canvas');

// ---------- Core managers ----------
const canvasManager = new CanvasManager({ canvas: canvasEl, overlay: overlayEl, width: 800, height: 600 });
const historyManager = new HistoryManager(canvasManager);

const statusBar = new StatusBar({
  pointerEl: document.getElementById('status-pointer'),
  selectionEl: document.getElementById('status-selection'),
  canvasSizeEl: document.getElementById('status-canvas-size'),
  flashEl: document.getElementById('status-flash'),
});
statusBar.setCanvasSize(canvasManager.width, canvasManager.height);

const viewportManager = new ViewportManager({
  stage,
  canvasManager,
  zoomInBtn: document.getElementById('zoom-in'),
  zoomOutBtn: document.getElementById('zoom-out'),
  zoomInput: document.getElementById('zoom-input'),
  zoomSlider: document.getElementById('zoom-slider'),
});

const canvasResizer = new CanvasResizer({
  stage,
  canvasManager,
  viewportManager,
  historyManager,
  handleRight: document.getElementById('handle-right'),
  handleBottom: document.getElementById('handle-bottom'),
  handleCorner: document.getElementById('handle-corner'),
  ghost: document.getElementById('resize-ghost'),
});

canvasManager.onSizeChange = (w, h) => {
  statusBar.setCanvasSize(w, h);
  canvasResizer.reposition();
};

const colorInspector = new ColorInspector({
  swatchEl: document.getElementById('ci-swatch'),
  rgbEl: document.getElementById('ci-rgb'),
  hexEl: document.getElementById('ci-hex'),
  copyButtons: [...document.querySelectorAll('.ci-copy')],
});

const colorPalette = new ColorPalette({
  gridEl: document.getElementById('palette-grid'),
  primarySwatchEl: document.getElementById('primary-swatch'),
  secondarySwatchEl: document.getElementById('secondary-swatch'),
  colorPickerInput: document.getElementById('color-picker'),
  onPrimaryChange: (hex) => (canvasManager.primaryColor = hex),
  onSecondaryChange: (hex) => (canvasManager.secondaryColor = hex),
});

// ---------- Selection state + overlay drawing ----------
function drawSelectionOutline(region) {
  const g = canvasManager.octx;
  g.save();
  g.strokeStyle = '#0078d4';
  g.lineWidth = 1;
  g.setLineDash([4, 3]);
  g.strokeRect(region.x + 0.5, region.y + 0.5, region.w, region.h);
  g.restore();
}

function getSelection() {
  return canvasManager.selection;
}

function setSelection(region, opts = {}) {
  canvasManager.selection = region;
  statusBar.setSelection(region);
  if (!opts.preview) canvasManager.clearOverlay();
  if (region && region.w && region.h) drawSelectionOutline(region);
}

// ---------- Shared tool context ----------
const toolContext = {
  canvasManager,
  historyManager,
  viewportManager,
  stage,
  colorInspector,
  getSelection,
  setSelection,
  drawSelectionOutline,
  setPrimaryColor: (hex) => colorPalette.setPrimary(hex),
  setSecondaryColor: (hex) => colorPalette.setSecondary(hex),
  getShapeKind: () => toolbar.getShapeKind(),
  getShapeFillMode: () => toolbar.getFillMode(),
  getFontSize: () => 24,
  getFontFamily: () => 'Segoe UI, sans-serif',
};

// ---------- Tools ----------
const toolManager = new ToolManager({ surface: overlayEl, viewportManager, toolContext, statusBar });
[
  new SelectTool(),
  createPencilTool(),
  createBrushTool(),
  createEraserTool(),
  new FillTool(),
  new ShapeTool(),
  new TextTool(),
  new EyedropperTool(),
  new ZoomTool(),
].forEach((t) => toolManager.register(t));

const clipboardManager = new ClipboardManager({
  canvasManager,
  historyManager,
  getSelection,
  setSelection,
  statusBar,
});

// ---------- File operations ----------
let fileHandle = null;

function persistSession() {
  canvasManager.persistToStorage();
}

function selectAll() {
  setSelection({ x: 0, y: 0, w: canvasManager.width, h: canvasManager.height });
}

function deleteSelection() {
  const sel = getSelection();
  if (!sel || !sel.w || !sel.h) return false;
  historyManager.snapshot();
  canvasManager.fillRegion(sel, canvasManager.backgroundColor);
  setSelection(null);
  persistSession();
  statusBar.flash('Deleted selection');
  return true;
}

function newFile() {
  if (!window.confirm('Start a new image? Unsaved changes will be lost.')) return;
  historyManager.clear();
  fileHandle = null;
  canvasManager.loadFromSource(makeBlankSource(800, 600));
  setSelection(null);
  persistSession();
}

function makeBlankSource(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, w, h);
  return c;
}

function openFile() {
  document.getElementById('file-input').click();
}

document.getElementById('file-input').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  e.target.value = '';
  if (!file) return;
  const bitmap = await createImageBitmap(file);
  historyManager.snapshot();
  canvasManager.loadFromSource(bitmap);
  fileHandle = null;
  setSelection(null);
  persistSession();
  statusBar.flash(`Opened ${file.name}`);
});

async function save() {
  if (window.showSaveFilePicker) {
    try {
      if (!fileHandle) {
        fileHandle = await window.showSaveFilePicker({
          suggestedName: 'untitled.png',
          types: [{ description: 'PNG image', accept: { 'image/png': ['.png'] } }],
        });
      }
      const writable = await fileHandle.createWritable();
      const blob = await canvasManager.toBlob('image/png');
      await writable.write(blob);
      await writable.close();
      persistSession();
      statusBar.flash('Saved');
      return;
    } catch (err) {
      if (err.name === 'AbortError') return;
      console.warn('File System Access save failed, falling back to download:', err);
    }
  }
  downloadPNG();
}

function downloadPNG() {
  const a = document.createElement('a');
  a.href = canvasManager.canvas.toDataURL('image/png');
  a.download = 'untitled.png';
  a.click();
  statusBar.flash('Downloaded as PNG');
}

function crop() {
  const sel = getSelection();
  if (!sel || !sel.w || !sel.h) {
    statusBar.flash('Select an area first');
    return;
  }
  historyManager.snapshot();
  const region = canvasManager.extractRegion(sel);
  canvasManager.loadFromSource(region);
  setSelection(null);
  persistSession();
}

// ---------- Resize-canvas dialog ----------
const resizeDialog = document.getElementById('resize-dialog');
const resizeWidthInput = document.getElementById('resize-width');
const resizeHeightInput = document.getElementById('resize-height');
const keepAspectInput = document.getElementById('resize-keep-aspect');
let aspectRatio = 1;

function openResizeDialog() {
  resizeWidthInput.value = canvasManager.width;
  resizeHeightInput.value = canvasManager.height;
  aspectRatio = canvasManager.width / canvasManager.height;
  resizeDialog.showModal();
}

resizeWidthInput.addEventListener('input', () => {
  if (keepAspectInput.checked) resizeHeightInput.value = Math.round(resizeWidthInput.value / aspectRatio);
});
resizeHeightInput.addEventListener('input', () => {
  if (keepAspectInput.checked) resizeWidthInput.value = Math.round(resizeHeightInput.value * aspectRatio);
});

document.getElementById('resize-cancel').addEventListener('click', () => resizeDialog.close());
document.getElementById('resize-form').addEventListener('submit', () => {
  const w = parseInt(resizeWidthInput.value, 10);
  const h = parseInt(resizeHeightInput.value, 10);
  if (w > 0 && h > 0) {
    historyManager.snapshot();
    canvasManager.resize(w, h);
    persistSession();
  }
});

// ---------- Toolbar ----------
const toolbar = new Toolbar({
  root: document.getElementById('ribbon'),
  toolManager,
  setLineWidth: (w) => (canvasManager.lineWidth = w),
  handlers: {
    newFile,
    openFile,
    save,
    paste: () => clipboardManager.paste(),
    cut: () => clipboardManager.cut(),
    copy: () => clipboardManager.copy(),
    crop,
    openResizeDialog,
    undo: () => historyManager.undo(),
    redo: () => historyManager.redo(),
  },
});

historyManager.onChange = (canUndo, canRedo) => toolbar.setUndoRedoEnabled(canUndo, canRedo);

(async () => {
  const restored = await canvasManager.restoreFromStorage();
  if (restored) {
    setSelection(null);
    statusBar.flash('Restored your last canvas');
  }
})();
window.addEventListener('beforeunload', () => persistSession());

// Default tool, per the brief: Select (not Pencil, unlike real Windows Paint).
toolManager.setActive('select');

// ---------- Keyboard shortcuts ----------
const TOOL_KEYS = {
  s: 'select', p: 'pencil', b: 'brush', f: 'fill', e: 'eraser', t: 'text', k: 'eyedropper', z: 'zoom',
};

window.addEventListener('keydown', (e) => {
  const tag = document.activeElement?.tagName;
  const typing = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';

  if (e.ctrlKey || e.metaKey) {
    switch (e.key.toLowerCase()) {
      case 'a':
        if (typing) return;
        e.preventDefault();
        selectAll();
        return;
      case 'z':
        e.preventDefault();
        e.shiftKey ? historyManager.redo() : historyManager.undo();
        return;
      case 'y':
        e.preventDefault();
        historyManager.redo();
        return;
      case 'c':
        if (typing) return;
        e.preventDefault();
        clipboardManager.copy();
        return;
      case 'x':
        if (typing) return;
        e.preventDefault();
        clipboardManager.cut();
        return;
      case 'v':
        if (typing) return;
        e.preventDefault();
        clipboardManager.paste();
        return;
      case 's':
        e.preventDefault();
        save();
        return;
      case 'o':
        e.preventDefault();
        openFile();
        return;
      case 'n':
        e.preventDefault();
        newFile();
        return;
    }
    return;
  }

  if (typing) return;
  if (e.key === 'Delete' || e.key === 'Backspace') {
    if (deleteSelection()) e.preventDefault();
    return;
  }

  const tool = TOOL_KEYS[e.key.toLowerCase()];
  if (tool) toolManager.setActive(tool);
});
