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
import { createTextTool } from './tools/TextTool.js';
import { EyedropperTool } from './tools/EyedropperTool.js';
import { ZoomTool } from './tools/ZoomTool.js';
import { ColorPalette } from './ui/ColorPalette.js';
import { ColorInspector } from './ui/ColorInspector.js';
import { StatusBar } from './ui/StatusBar.js';
import { Toolbar } from './ui/Toolbar.js';
import { Sidebar } from './ui/Sidebar.js';
import { PanelLayoutManager } from './ui/PanelLayoutManager.js';
import { SegmentedChoice } from './ui/SegmentedChoice.js';
import { createDialogService } from './ui/DialogService.js';
import { createSettingsRegistry } from './settings/SettingsRegistry.js';
import { createDeterministicCommandService } from './ai/DeterministicCommandService.js';
import { createAiConnectionStore } from './ai/AiConnectionStore.js';
import { getReleaseNotes } from './releaseNotes.js';
import { hexToRgb } from './utils/color.js';
import { rotateCanvas, rotateCanvasByAngle, flipCanvas, scaleCanvas, removeBackground } from './utils/transform.js';
import { APP_VERSION } from './version.js';

// ---------- DOM refs ----------
const stage = document.getElementById('canvas-stage');
const canvasEl = document.getElementById('paint-canvas');
const overlayEl = document.getElementById('overlay-canvas');
const scaleEl = document.getElementById('canvas-scale');
const dialogService = createDialogService({
  dialog: document.getElementById('app-dialog'),
  title: document.getElementById('app-dialog-title'),
  message: document.getElementById('app-dialog-message'),
  input: document.getElementById('app-dialog-input'),
  confirmButton: document.getElementById('app-dialog-confirm'),
  cancelButton: document.getElementById('app-dialog-cancel'),
  form: document.getElementById('app-dialog-form'),
});

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
  scaleEl,
  canvasManager,
  zoomInBtn: document.getElementById('zoom-in'),
  zoomOutBtn: document.getElementById('zoom-out'),
  zoomInput: document.getElementById('zoom-input'),
  zoomSlider: document.getElementById('zoom-slider'),
});

const canvasResizer = new CanvasResizer({
  stage,
  scaleEl: document.getElementById('canvas-scale'),
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
  // Redraw any selection that CanvasManager.resize() preserved (clamped to the
  // new bounds) so resizing the canvas no longer drops an active marquee.
  setSelection(canvasManager.selection);
};

const colorInspector = new ColorInspector({
  swatchEl: document.getElementById('ci-swatch'),
  rgbEl: document.getElementById('ci-rgb'),
  hexEl: document.getElementById('ci-hex'),
  copyButtons: [...document.querySelectorAll('.ci-copy')],
});
const colorInspectorEl = document.getElementById('color-inspector');
const colorInspectorToggle = document.getElementById('ci-toggle');
function setColorInspectorCollapsed(collapsed) {
  if (!colorInspectorEl || !colorInspectorToggle) return;
  colorInspectorEl.classList.toggle('collapsed', collapsed);
  const button = colorInspectorToggle;
  button.innerHTML = `<svg viewBox="0 0 20 20" aria-hidden="true"><path d="${collapsed ? 'M14 4l-8 6 8 6' : 'M6 4l8 6-8 6'}" /></svg>`;
  button.setAttribute('aria-expanded', String(!collapsed));
  button.title = collapsed ? 'Expand color inspector' : 'Collapse color inspector';
  try { localStorage.setItem('paint:color-inspector-collapsed', String(collapsed)); } catch {}
}
let colorInspectorCollapsed = false;
try { colorInspectorCollapsed = localStorage.getItem('paint:color-inspector-collapsed') === 'true'; } catch {}
setColorInspectorCollapsed(colorInspectorCollapsed);
colorInspectorToggle?.addEventListener('click', () => {
  setColorInspectorCollapsed(!colorInspectorEl.classList.contains('collapsed'));
});

const colorPalette = new ColorPalette({
  gridEl: document.getElementById('palette-grid'),
  primarySwatchEl: document.getElementById('primary-swatch'),
  secondarySwatchEl: document.getElementById('secondary-swatch'),
  colorPickerInput: document.getElementById('color-picker'),
  onPrimaryChange: (hex) => {
    canvasManager.primaryColor = hex;
    window.dispatchEvent(new CustomEvent('paint:primary-color-change', { detail: hex }));
  },
  onSecondaryChange: (hex) => (canvasManager.secondaryColor = hex),
});
const primaryRgb = hexToRgb(colorPalette.primary);
if (primaryRgb) {
  colorInspector.show({ ...primaryRgb, hex: colorPalette.primary });
}

const aiConnectionStore = createAiConnectionStore();
const sidebar = new Sidebar({ canvasManager, historyManager, statusBar, palette: colorPalette, dialogService, aiConnectionStore });

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

let selectionRotation = null;
function sameRegion(a, b) {
  return a && b && ['x', 'y', 'w', 'h'].every((key) => a[key] === b[key]);
}
function sameRotationCenter(a, b) {
  if (!a || !b) return false;
  return Math.abs((a.x + a.w / 2) - (b.x + b.w / 2)) < 0.5
    && Math.abs((a.y + a.h / 2) - (b.y + b.h / 2)) < 0.5;
}

function setSelection(region, opts = {}) {
  // Quarter-turn rotations legitimately swap the selection dimensions. Keep
  // the original pixel snapshot while the center remains anchored, otherwise
  // the next rotation would use an already fitted/shrunk result as its base.
  if (selectionRotation && !sameRegion(selectionRotation.selection, region)
    && !sameRotationCenter(selectionRotation.selection, region)) selectionRotation = null;
  canvasManager.selection = region;
  statusBar.setSelection(region);
  canvasManager.clearOverlay();
  if (region && region.w && region.h) {
    if (canvasManager.floatingCanvas) {
      canvasManager.octx.drawImage(canvasManager.floatingCanvas, region.x, region.y);
    }
    drawSelectionOutline(region);
  }
  updateSelectionHandles(region);
}

const selectionHandles = [...document.querySelectorAll('[data-selection-handle]')];
const rotateSelectionHandle = document.getElementById('selection-rotate');
let activeToolName = 'select';

function updateSelectionHandles(region) {
  const selectionToolActive = activeToolName === 'select';
  selectionHandles.forEach((handle) => {
    handle.hidden = !selectionToolActive || !region || !region.w || !region.h;
  });
  if (rotateSelectionHandle) {
    const enabled = document.getElementById('rotate-selection-toggle')?.checked === true;
    rotateSelectionHandle.hidden = !selectionToolActive || !enabled || !region || !region.w || !region.h;
    if (region?.w && region?.h) {
      rotateSelectionHandle.style.left = `${region.x + region.w / 2 - 12}px`;
      rotateSelectionHandle.style.top = `${Math.max(0, region.y - 28)}px`;
    }
  }
  if (!region || !region.w || !region.h) return;
  const points = {
    nw: [region.x, region.y], n: [region.x + region.w / 2, region.y], ne: [region.x + region.w, region.y],
    e: [region.x + region.w, region.y + region.h / 2], se: [region.x + region.w, region.y + region.h],
    s: [region.x + region.w / 2, region.y + region.h], sw: [region.x, region.y + region.h], w: [region.x, region.y + region.h / 2],
  };
  selectionHandles.forEach((handle) => {
    const [x, y] = points[handle.dataset.selectionHandle];
    handle.style.left = `${x - 4}px`;
    handle.style.top = `${y - 4}px`;
  });
}

function bindSelectionHandles() {
  selectionHandles.forEach((handle) => {
    handle.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      event.stopPropagation();
      historyManager.snapshot();
      const original = { ...canvasManager.selection };
      const direction = handle.dataset.selectionHandle;
      const start = viewportManager.clientToImage(event.clientX, event.clientY);
      const fixed = {
        x: direction.includes('w') ? original.x + original.w : original.x,
        y: direction.includes('n') ? original.y + original.h : original.y,
      };
      const onMove = (moveEvent) => {
        const point = viewportManager.clientToImage(moveEvent.clientX, moveEvent.clientY);
        let x = original.x;
        let y = original.y;
        let w = original.w;
        let h = original.h;
        if (direction.includes('e')) w = Math.max(1, Math.round(point.x - original.x));
        if (direction.includes('w')) { w = Math.max(1, Math.round(fixed.x - point.x)); x = fixed.x - w; }
        if (direction.includes('s')) h = Math.max(1, Math.round(point.y - original.y));
        if (direction.includes('n')) { h = Math.max(1, Math.round(fixed.y - point.y)); y = fixed.y - h; }
        // Word-style: hold Shift to keep the aspect ratio while resizing.
        if (moveEvent.shiftKey && w > 0 && h > 0) {
          const ratio = original.w / Math.max(1, original.h);
          if (direction.length === 1) {
            // Edge handle: derive the other dimension from the ratio.
            if (direction === 'e' || direction === 'w') h = Math.max(1, Math.round(w / ratio));
            else w = Math.max(1, Math.round(h * ratio));
          } else {
            // Corner handle: fit the dragged box into the ratio.
            if (w / h > ratio) w = Math.max(1, Math.round(h * ratio));
            else h = Math.max(1, Math.round(w / ratio));
          }
          if (direction.includes('w')) x = fixed.x - w;
          if (direction.includes('n')) y = fixed.y - h;
        }
        if (canvasManager.floatingCanvas) canvasManager.floatingCanvas = scaleCanvas(canvasManager.floatingCanvas, w, h);
        setSelection({ x, y, w, h }, { preview: true });
      };
      const onUp = () => {
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
        canvasManager.persistToStorage();
      };
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp, { once: true });
      void start;
    });
  });
}

function commitFloatingSelection() {
  if (canvasManager.floatingCanvas && canvasManager.selection) {
    canvasManager.ctx.drawImage(canvasManager.floatingCanvas, canvasManager.selection.x, canvasManager.selection.y);
    canvasManager.floatingCanvas = null;
    selectionRotation = null;
    setSelection(null);
    canvasManager.persistToStorage();
  }
}

function discardFloatingSelection() {
  if (canvasManager.floatingCanvas) {
    canvasManager.floatingCanvas = null;
    selectionRotation = null;
    setSelection(null);
  }
}

// ---------- Shared tool context ----------
function saveToolSelection(toolName) {
  try {
    localStorage.setItem('paint:selected-tool', toolName);
  } catch (err) {
    console.warn('Unable to save tool selection:', err);
  }
}

function restoreToolSelection() {
  try {
    const saved = localStorage.getItem('paint:selected-tool');
    return saved || 'select';
  } catch (err) {
    console.warn('Unable to restore tool selection:', err);
    return 'select';
  }
}

// Text keeps its own remembered size even though it shares the visible size
// control with drawing tools. Never fall back to the legacy line-width key:
// that would make a 3px brush unexpectedly become the text default.
let currentFontSize = (() => {
  try {
    const saved = localStorage.getItem('paint:font-size');
    const parsed = saved ? parseInt(saved, 10) : 40;
    return Number.isFinite(parsed) ? Math.max(1, Math.min(300, parsed)) : 40;
  } catch {
    return 40;
  }
})();

const TEXT_STYLES_KEY = 'paint:text-styles';
const TEXT_STYLE_NAMES = ['outline', 'black-outline', 'shadow', 'neon', 'bold', 'italic', 'underline'];
let selectedTextStyles = (() => {
  try {
    const saved = JSON.parse(localStorage.getItem(TEXT_STYLES_KEY) || 'null');
    if (Array.isArray(saved)) return saved.filter((style) => TEXT_STYLE_NAMES.includes(style));
    const legacy = localStorage.getItem('paint:text-style');
    return legacy && legacy !== 'plain' && TEXT_STYLE_NAMES.includes(legacy) ? [legacy] : [];
  } catch {
    return [];
  }
})();

function getTextStyles() {
  return [...selectedTextStyles];
}

function renderTextStyleControls() {
  const color = colorPalette.primary;
  document.querySelectorAll('.text-style-option').forEach((button) => {
    const active = selectedTextStyles.includes(button.dataset.textStyle);
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', String(active));
    const sample = button.querySelector('.style-sample');
    if (sample) sample.style.color = color;
  });
  const preview = document.getElementById('text-style-preview');
  if (preview) {
    preview.dataset.style = selectedTextStyles.join(' ') || 'plain';
    preview.style.color = color;
  }
}

function saveTextStyles() {
  try { localStorage.setItem(TEXT_STYLES_KEY, JSON.stringify(selectedTextStyles)); } catch {}
  renderTextStyleControls();
}

const toolContext = {
  canvasManager,
  historyManager,
  viewportManager,
  stage,
  scaleEl,
  colorInspector,
  getSelection,
  setSelection,
  commitFloatingSelection,
  discardFloatingSelection,
  drawSelectionOutline,
  setPrimaryColor: (hex) => colorPalette.setPrimary(hex),
  setSecondaryColor: (hex) => colorPalette.setSecondary(hex),
  setActiveTool: (name) => toolManager.setActive(name),
  getPreviousTool: () => toolbar.getPreviousTool(),
  getShapeKind: () => toolbar.getShapeKind(),
  getShapeFillMode: () => toolbar.getFillMode(),
  getSelectAfterDraw: () => toolbar.getSelectAfterDraw(),
  getEmoji: () => toolbar.getSelectedEmoji(),
  getFontSize: () => currentFontSize,
  getFontFamily: () => "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  getTextStyle: getTextStyles,
  setFontSize: (size) => {
    currentFontSize = Math.max(1, Math.min(300, parseInt(size, 10)));
    try {
      localStorage.setItem('paint:font-size', currentFontSize);
    } catch (err) {
      console.warn('Unable to save font size:', err);
    }
  },
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
  createTextTool(),
  new EyedropperTool(),
  new ZoomTool(),
].forEach((t) => toolManager.register(t));

viewportManager.onZoomChange = () => {
  toolManager.tools.get('text')?.onZoomChange?.(toolContext);
};

// Wrap toolManager.setActive to automatically save tool selection
const originalSetActive = toolManager.setActive.bind(toolManager);
toolManager.setActive = (name) => {
  originalSetActive(name);
  saveToolSelection(name);
};

const clipboardManager = new ClipboardManager({
  canvasManager,
  historyManager,
  getSelection,
  setSelection,
  statusBar,
  setActiveTool: (name) => toolManager.setActive(name),
  commitFloatingSelection,
});

// ---------- File operations ----------
let fileHandle = null;
const fileInput = document.getElementById('file-input');

function persistSession() {
  canvasManager.persistToStorage();
}

function selectAll() {
  setSelection({ x: 0, y: 0, w: canvasManager.width, h: canvasManager.height });
}

function deleteSelection() {
  const sel = getSelection();
  if (!sel || !sel.w || !sel.h) return false;
  if (canvasManager.floatingCanvas) {
    canvasManager.floatingCanvas = null;
    setSelection(null);
  } else {
    historyManager.snapshot();
    canvasManager.fillRegion(sel, canvasManager.backgroundColor);
    setSelection(null);
  }
  persistSession();
  statusBar.flash('Deleted selection');
  return true;
}

function newFile() {
  if (shouldAutoSaveOnNew()) {
    void doNewFile();
    return;
  }
  const dialog = document.getElementById('new-file-dialog');
  const button = document.getElementById('btn-new').getBoundingClientRect();
  dialog.style.left = `${Math.max(12, Math.round(button.left))}px`;
  dialog.style.top = `${Math.round(button.bottom + 8)}px`;
  dialog.showModal();
  setDialogUrl('new');
  document.getElementById('new-file-ok')?.focus();
}

async function doNewFile() {
  if (shouldAutoSaveOnNew()) await sidebar.saveCurrentToHistory();
  else if (shouldAutoSaveHistory()) await sidebar.saveCurrentToHistory();
  discardFloatingSelection();
  historyManager.clear();
  fileHandle = null;
  const { width, height } = getDefaultCanvasSize();
  canvasManager.loadFromSource(makeBlankSource(width, height));
  setSelection(null);
  persistSession();
  document.getElementById('new-file-dialog').close();
  if (new URLSearchParams(window.location.search).get('dialog') === 'new') setDialogUrl(null);
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

function getDefaultCanvasSize() {
  const value = document.getElementById('setting-default-canvas-size')?.value || '800x600';
  const [width, height] = value.split('x').map(Number);
  return Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0
    ? { width, height }
    : { width: 800, height: 600 };
}

function openFile() {
  fileInput.dataset.mode = 'open';
  fileInput.click();
}

function importFile() {
  fileInput.dataset.mode = 'import';
  fileInput.click();
}

async function openImageFile(file) {
  const bitmap = await createImageBitmap(file);
  discardFloatingSelection();
  historyManager.snapshot();
  canvasManager.loadFromSource(bitmap);
  fileHandle = null;
  setSelection(null);
  persistSession();
  statusBar.flash(`Opened ${file.name}`);
  bitmap.close?.();
}

async function importImageFile(file) {
  const bitmap = await createImageBitmap(file);
  await clipboardManager.insertBitmapAsFloatingSelection(bitmap, {
    sourceLabel: `Imported ${file.name}`,
  });
  fileHandle = null;
}

fileInput.addEventListener('change', async (e) => {
  const file = e.target.files[0];
  const mode = fileInput.dataset.mode || 'open';
  e.target.value = '';
  fileInput.dataset.mode = '';
  if (!file) return;
  if (mode === 'import') {
    await importImageFile(file);
    return;
  }
  await openImageFile(file);
});

async function save() {
  commitFloatingSelection();
  if (shouldAutoSaveHistory()) sidebar.saveCurrentToHistory();
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
      document.title = 'paint - ' + fileHandle.name;
      showToast('Successfully saved to ' + fileHandle.name, true);
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
  document.title = 'paint - untitled.png';
  showToast('Successfully downloaded untitled.png', true);
}

function showToast(msg, success = true) {
  const toast = document.createElement('div');
  toast.className = 'toast ' + (success ? 'toast-success' : 'toast-error');
  toast.textContent = msg;
  document.body.appendChild(toast);
  setTimeout(() => {
    toast.classList.add('hide');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

function crop() {
  const sel = getSelection();
  if (!sel || !sel.w || !sel.h) {
    statusBar.flash('Select an area first');
    return;
  }
  if (canvasManager.floatingCanvas) {
    canvasManager.ctx.drawImage(canvasManager.floatingCanvas, sel.x, sel.y);
    canvasManager.floatingCanvas = null;
  }
  historyManager.snapshot();
  const region = canvasManager.extractRegion(sel);
  canvasManager.loadFromSource(region);
  setSelection(null);
  persistSession();
}

// ---------- Transformations ----------
function applyTransformation(transformFn) {
  // A menu transform starts a new operation; do not use a previous rotate
  // handle's base canvas for it.
  selectionRotation = null;
  historyManager.snapshot();
  const selection = canvasManager.selection;
  if (selection && !canvasManager.floatingCanvas) {
    canvasManager.floatingCanvas = canvasManager.extractRegion(selection);
    canvasManager.fillRegion(selection, canvasManager.backgroundColor);
  }
  if (canvasManager.floatingCanvas && canvasManager.selection) {
    const newCanvas = transformFn(canvasManager.floatingCanvas);
    canvasManager.floatingCanvas = newCanvas;
    
    // Update selection region to match new dimensions
    const sel = canvasManager.selection;
    const cx = sel.x + sel.w / 2;
    const cy = sel.y + sel.h / 2;
    const nw = newCanvas.width;
    const nh = newCanvas.height;
    
    setSelection({
      x: cx - nw / 2,
      y: cy - nh / 2,
      w: nw,
      h: nh
    });
  } else {
    // Transform entire canvas
    const newCanvas = transformFn(canvasManager.canvas);
    canvasManager.loadFromSource(newCanvas);
  }
  persistSession();
}

function toggleActionMenu(event) {
  event.stopPropagation();
  const trigger = event.currentTarget;
  const menu = trigger.parentElement;
  const menuItems = menu.querySelector('.action-menu-items');
  const shouldOpen = !menu.classList.contains('open');
  document.querySelectorAll('.action-menu.open').forEach((item) => {
    item.classList.remove('open');
    const openItems = item.querySelector('.action-menu-items');
    openItems.style.removeProperty('top');
    openItems.style.removeProperty('left');
    delete openItems.dataset.direction;
  });
  if (!shouldOpen) return;
  const bounds = trigger.getBoundingClientRect();
  menuItems.style.left = `${Math.round(bounds.left)}px`;
  menuItems.style.visibility = 'hidden';
  menuItems.style.display = 'grid';
  const menuHeight = menuItems.getBoundingClientRect().height || 80;
  menuItems.style.display = '';
  menuItems.style.visibility = '';
  const spaceBelow = window.innerHeight - bounds.bottom;
  const openAbove = spaceBelow < menuHeight + 8 && bounds.top >= menuHeight + 8;
  menuItems.style.top = `${Math.round(openAbove ? bounds.top - menuHeight - 2 : bounds.bottom + 2)}px`;
  menuItems.dataset.direction = openAbove ? 'up' : 'down';
  menu.classList.add('open');
}

document.getElementById('btn-open-menu').addEventListener('click', (event) => {
  toggleActionMenu(event);
});
document.getElementById('btn-shapes-menu').addEventListener('click', (event) => {
  toggleActionMenu(event);
});
document.getElementById('btn-rotate').addEventListener('click', (event) => {
  toggleActionMenu(event);
});
document.getElementById('btn-rotate-90').addEventListener('click', () => applyTransformation(c => rotateCanvas(c, 1)));
document.getElementById('btn-rotate-180').addEventListener('click', () => applyTransformation(c => rotateCanvas(c, 2)));
document.getElementById('btn-rotate-270').addEventListener('click', () => applyTransformation(c => rotateCanvas(c, 3)));
document.getElementById('btn-rotate-free').addEventListener('click', async () => {
  const value = await dialogService.prompt({
    title: 'Free rotation',
    message: 'Enter the rotation angle in degrees.',
    value: '15',
    type: 'number',
    confirmLabel: 'Rotate',
  });
  const degrees = Number.parseFloat(value);
  if (Number.isFinite(degrees)) applyTransformation(c => rotateCanvasByAngle(c, degrees));
});
document.getElementById('btn-flip').addEventListener('click', (event) => {
  toggleActionMenu(event);
});
document.getElementById('btn-flip-horizontal').addEventListener('click', () => applyTransformation(c => flipCanvas(c, true)));
document.getElementById('btn-flip-vertical').addEventListener('click', () => applyTransformation(c => flipCanvas(c, false)));
document.getElementById('btn-crop-menu').addEventListener('click', (event) => {
  toggleActionMenu(event);
});
document.getElementById('btn-tools-menu')?.addEventListener('click', toggleActionMenu);
document.getElementById('line-size')?.addEventListener('click', toggleActionMenu);
document.getElementById('btn-remove-bg').addEventListener('click', () => applyTransformation(c => removeBackground(c, 30)));
rotateSelectionHandle?.addEventListener('click', (event) => {
  event.preventDefault();
  event.stopPropagation();
  if (rotateSelectionHandle._dragged) {
    rotateSelectionHandle._dragged = false;
    return;
  }
  if (document.getElementById('rotate-selection-toggle')?.checked) {
    rotateSelectionByAngle(90, { prepared: rotateSelectionHandle._rotationPrepared === true });
    rotateSelectionHandle._rotationPrepared = false;
  }
});
rotateSelectionHandle?.addEventListener('pointerdown', (event) => {
  if (activeToolName !== 'select' || !document.getElementById('rotate-selection-toggle')?.checked || !canvasManager.selection) return;
  event.preventDefault();
  event.stopPropagation();
  const originalSelection = { ...canvasManager.selection };
  historyManager.snapshot();
  if (!canvasManager.floatingCanvas) {
    canvasManager.floatingCanvas = canvasManager.extractRegion(originalSelection);
    canvasManager.fillRegion(originalSelection, canvasManager.backgroundColor);
    setSelection(originalSelection);
  }
  const rotationState = beginSelectionRotation(originalSelection);
  const startDegrees = rotationState.degrees;
  rotateSelectionHandle._rotationPrepared = true;
  const center = { x: originalSelection.x + originalSelection.w / 2, y: originalSelection.y + originalSelection.h / 2 };
  const startPoint = viewportManager.clientToImage(event.clientX, event.clientY);
  const startAngle = Math.atan2(startPoint.y - center.y, startPoint.x - center.x);
  let moved = false;
  const onMove = (moveEvent) => {
    const point = viewportManager.clientToImage(moveEvent.clientX, moveEvent.clientY);
    const angle = Math.atan2(point.y - center.y, point.x - center.x);
    const degrees = snapRotation(startDegrees + (angle - startAngle) * 180 / Math.PI);
    if (Math.abs(degrees - startDegrees) > 1) moved = true;
    rotationState.degrees = degrees;
    const rendered = renderSelectionRotation(rotationState);
    canvasManager.floatingCanvas = rendered.canvas;
    setSelection(rendered.region);
  };
  const onUp = () => {
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);
    if (moved) {
      rotateSelectionHandle._dragged = true;
      rotateSelectionHandle._rotationPrepared = false;
      canvasManager.persistToStorage();
    }
  };
  window.addEventListener('pointermove', onMove);
  window.addEventListener('pointerup', onUp, { once: true });
});

function rotateSelectionByAngle(degrees, { prepared = false } = {}) {
  const selection = canvasManager.selection;
  if (!selection?.w || !selection?.h) return;
  if (!prepared) historyManager.snapshot();
  if (!prepared && !canvasManager.floatingCanvas) {
    canvasManager.floatingCanvas = canvasManager.extractRegion(selection);
    canvasManager.fillRegion(selection, canvasManager.backgroundColor);
  }
  const rotationState = beginSelectionRotation(selection);
  rotationState.degrees += degrees;
  rotationState.degrees = snapRotation(rotationState.degrees);
  const rendered = renderSelectionRotation(rotationState);
  canvasManager.floatingCanvas = rendered.canvas;
  setSelection(rendered.region);
  persistSession();
}

function beginSelectionRotation(selection) {
  if (!canvasManager.floatingCanvas) return null;
  if (!selectionRotation || !sameRotationCenter(selectionRotation.selection, selection)) {
    selectionRotation = {
      baseCanvas: scaleCanvas(canvasManager.floatingCanvas, canvasManager.floatingCanvas.width, canvasManager.floatingCanvas.height),
      selection: { ...selection },
      center: { x: selection.x + selection.w / 2, y: selection.y + selection.h / 2 },
      degrees: 0,
    };
  }
  return selectionRotation;
}

function snapRotation(degrees) {
  const quarterTurn = Math.round(degrees / 90) * 90;
  return Math.abs(degrees - quarterTurn) < 0.75 ? quarterTurn : degrees;
}

function renderSelectionRotation(rotationState) {
  const { center, degrees, baseCanvas } = rotationState;
  const quarterTurn = Math.round(degrees / 90) * 90;
  // Always rotate the untouched source at its natural size. Fitting an
  // already-rotated canvas into the old rectangle changes the shape's scale
  // and can clip its corners. The resulting canvas is the true rotated
  // bounding box, so the selection travels with the pixels.
  const canvas = rotateCanvasByAngle(baseCanvas, degrees);
  return {
    canvas,
    region: {
      x: center.x - canvas.width / 2,
      y: center.y - canvas.height / 2,
      w: canvas.width,
      h: canvas.height,
    },
  };
}
bindSelectionHandles();

document.addEventListener('click', () => {
  document.querySelectorAll('.action-menu.open').forEach((menu) => menu.classList.remove('open'));
});

// Native dialogs do not close on backdrop clicks by default. Keep the modal
// interactions lightweight and predictable, like the ribbon menus.
document.querySelectorAll('dialog').forEach((dialog) => dialog.addEventListener('click', (event) => {
  if (event.target === dialog) dialog.close();
}));

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
  setDialogUrl('resize');
}

document.querySelectorAll('[data-resize-preset]').forEach((button) => {
  button.addEventListener('click', () => {
    const [width, height] = button.dataset.resizePreset.split('x').map(Number);
    resizeWidthInput.value = width;
    resizeHeightInput.value = height;
    document.querySelectorAll('[data-resize-preset]').forEach((item) => item.classList.toggle('selected', item === button));
  });
});

resizeWidthInput.addEventListener('input', () => {
  if (keepAspectInput.checked) resizeHeightInput.value = Math.round(resizeWidthInput.value / aspectRatio);
});
resizeHeightInput.addEventListener('input', () => {
  if (keepAspectInput.checked) resizeWidthInput.value = Math.round(resizeHeightInput.value * aspectRatio);
});

document.getElementById('resize-cancel').addEventListener('click', () => resizeDialog.close());
resizeDialog.addEventListener('close', () => {
  if (new URLSearchParams(window.location.search).get('dialog') === 'resize') setDialogUrl(null);
});
document.getElementById('resize-form').addEventListener('submit', () => {
  const w = parseInt(resizeWidthInput.value, 10);
  const h = parseInt(resizeHeightInput.value, 10);
  if (w > 0 && h > 0) {
    commitFloatingSelection();
    historyManager.snapshot();
    canvasManager.resize(w, h);
    persistSession();
  }
});

// ---------- Settings dialog ----------
const settingsDialog = document.getElementById('settings-dialog');
const dmCheckbox = document.getElementById('setting-dark-mode');
const sbCheckbox = document.getElementById('setting-show-status-bar');
const ciCheckbox = document.getElementById('setting-show-color-inspector');
const aiCheckbox = document.getElementById('setting-show-ai-chat');
const bgSelect = document.getElementById('setting-canvas-bg');
const defaultCanvasSizeSelect = document.getElementById('setting-default-canvas-size');
const defaultZoomSelect = document.getElementById('setting-default-zoom');
const SETTINGS_KEY = 'omerpaint:settings';
const settingsRegistry = createSettingsRegistry();
settingsRegistry.registerResetHandler(() => colorPalette.resetToDefaults());
settingsRegistry.registerResetHandler(() => sidebar.resetSettings());
const deterministicAi = createDeterministicCommandService({
  setTheme: (theme) => {
    dmCheckbox.checked = theme === 'dark';
    document.body.classList.toggle('dark-mode', dmCheckbox.checked);
    saveSettings();
  },
  setCanvasBackground: (background) => {
    bgSelect.value = background;
    bgSelect.dispatchEvent(new Event('change'));
  },
  setZoom: (zoom) => viewportManager.setZoom(zoom),
  flip: (direction) => applyTransformation((canvas) => flipCanvas(canvas, direction === 'horizontal')),
  rotate: (degrees) => applyTransformation((canvas) => rotateCanvasByAngle(canvas, degrees)),
  saveToHistory: () => sidebar.saveCurrentToHistory(),
  getImageContext: () => {
    const selection = canvasManager.selection;
    const selectionText = selection ? ` Selection: ${selection.w}×${selection.h}px.` : ' No active selection.';
    return `Current image: ${canvasManager.width}×${canvasManager.height}px.${selectionText}`;
  },
});
sidebar.setAiCommandService(deterministicAi);

function setDialogUrl(dialog, extra = {}) {
  const params = new URLSearchParams(window.location.search);
  if (dialog) params.set('dialog', dialog);
  else params.delete('dialog');
  Object.entries(extra).forEach(([key, value]) => {
    if (value) params.set(key, value);
    else params.delete(key);
  });
  const query = params.toString();
  window.history.replaceState(null, '', `${window.location.pathname}${query ? `?${query}` : ''}${window.location.hash}`);
}

function openSettingsDialog(tab = 'general') {
  if (!settingsDialog.open) settingsDialog.showModal();
  document.querySelector(`[data-settings-tab="${tab}"]`)?.click();
  setDialogUrl('settings', { tab });
}

function syncRibbonLayoutControls(state) {
  const show = document.getElementById('setting-show-ribbon');
  const position = document.getElementById('setting-ribbon-position');
  if (show) show.checked = state.visible;
  if (position) position.value = state.position;
}

function applyAiChatVisibility(visible) {
  const enabled = Boolean(visible);
  if (aiCheckbox) aiCheckbox.checked = enabled;
  const aiButton = document.getElementById('btn-ai-chat');
  if (aiButton) {
    aiButton.hidden = !enabled;
    aiButton.style.display = enabled ? '' : 'none';
  }
  if (!enabled && sidebar.activeTab === 'ai') sidebar.hide();
}

const ribbonLayoutManager = new PanelLayoutManager({
  app: document.getElementById('app'),
  panel: document.getElementById('ribbon'),
  restoreBar: document.getElementById('ribbon-restore-bar'),
  restoreButton: document.getElementById('ribbon-restore-toggle'),
  settingsButton: document.getElementById('ribbon-restore-settings'),
  onChange: (state) => {
    syncRibbonLayoutControls(state);
    if (state.action !== 'settings') return;
    openSettingsDialog('ribbon');
  },
});
const settingsShowRibbon = document.getElementById('setting-show-ribbon');
const settingsRibbonPosition = document.getElementById('setting-ribbon-position');
document.getElementById('ribbon-restore-toggle')?.addEventListener('click', () => saveSettings());
settingsShowRibbon?.addEventListener('change', () => {
  ribbonLayoutManager.setVisible(settingsShowRibbon.checked);
  saveSettings();
});
settingsRibbonPosition?.addEventListener('change', () => {
  ribbonLayoutManager.setPosition(settingsRibbonPosition.value);
  saveSettings();
});

const segmentedChoices = [...document.querySelectorAll('.choice-summary')].map((root) => new SegmentedChoice({
  root,
  select: document.getElementById(root.dataset.selectId),
}));
function renderSegmentedChoices() { segmentedChoices.forEach((choice) => choice.render()); }

function readSettings() {
  try { return JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}'); } catch { return {}; }
}

function saveSettings() {
  try {
    const ribbonVisibility = {};
    const buttonVisibility = {};
    document.querySelectorAll('.ribbon-group').forEach((groupSection) => {
      const title = groupSection.querySelector('.ribbon-group-title');
      if (!title) return;
      ribbonVisibility[title.textContent.trim()] = [...groupSection.children]
        .filter((child) => !child.classList.contains('ribbon-group-title') && child.id !== 'file-input')
        .some((child) => !child.hidden && child.style.display !== 'none');
      groupSection.querySelectorAll('.rbtn[id]').forEach((button) => {
        buttonVisibility[button.id] = !button.hidden && button.style.display !== 'none';
      });
    });
    const historyAutoSave = (document.getElementById('history-auto-save-toggle')?.checked
      ?? document.getElementById('setting-history-auto-save')?.checked) ?? true;
    const historyAutoSaveMode = document.getElementById('setting-history-auto-save-mode')?.value || 'all';
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({
      darkMode: dmCheckbox.checked,
      showStatusBar: sbCheckbox.checked,
      showColorInspector: ciCheckbox.checked,
      showAiChat: aiCheckbox?.checked === true,
      canvasBackground: bgSelect.value,
      defaultCanvasSize: defaultCanvasSizeSelect?.value || '800x600',
      defaultZoom: Number(defaultZoomSelect?.value || 100),
      historyAutoSave,
      historyAutoSaveMode,
      ribbonLayout: { ...ribbonLayoutManager.state },
      ribbonVisibility,
      buttonVisibility,
      showRotateInSelection: document.getElementById('rotate-selection-toggle')?.checked === true,
    }));
  } catch (error) { console.warn('Unable to save settings:', error); }
}

// ---------- History preferences + export helpers ----------
function getHistoryPrefs() {
  const s = readSettings();
  return {
    autoSave: s.historyAutoSave !== false, // default: automatic
    mode: s.historyAutoSaveMode === 'close' ? 'lifecycle' : (s.historyAutoSaveMode || 'lifecycle'),
  };
}

// Auto-save on "regular" events (Ctrl+S, new file). Manual Save Current always
// works on its own.
function shouldAutoSaveHistory() {
  const { autoSave, mode } = getHistoryPrefs();
  return autoSave && mode === 'all';
}

// Auto-save when the page is about to close (beforeunload).
function shouldAutoSaveOnClose() {
  const { autoSave, mode } = getHistoryPrefs();
  return autoSave && (mode === 'all' || mode === 'lifecycle');
}

function shouldAutoSaveOnNew() {
  const { autoSave, mode } = getHistoryPrefs();
  return autoSave && (mode === 'all' || mode === 'lifecycle');
}

function syncHistoryControls(saved) {
  const prefs = saved
    ? { autoSave: saved.historyAutoSave !== false, mode: saved.historyAutoSaveMode === 'close' ? 'lifecycle' : (saved.historyAutoSaveMode || 'lifecycle') }
    : getHistoryPrefs();
  const t1 = document.getElementById('history-auto-save-toggle');
  const t2 = document.getElementById('setting-history-auto-save');
  const m = document.getElementById('setting-history-auto-save-mode');
  if (t1) t1.checked = prefs.autoSave;
  if (t2) t2.checked = prefs.autoSave;
  if (m) m.value = prefs.mode;
  const status = document.getElementById('history-auto-status');
  const labels = { lifecycle: 'Exit, refresh or new image', all: 'All automatic events', manual: 'Only manually' };
  if (status) status.textContent = prefs.autoSave ? (labels[prefs.mode] || prefs.mode) : 'Off';
  renderSegmentedChoices();
}

function syncHistoryLimitSelect(value) {
  const sidebarSel = document.getElementById('history-save-limit');
  const settingsSel = document.getElementById('setting-history-save-limit');
  if (sidebarSel) sidebarSel.value = String(value);
  if (settingsSel) settingsSel.value = String(value);
  const limitStatus = document.getElementById('history-limit-status');
  if (limitStatus) limitStatus.textContent = value > 0 ? `${value} images` : 'Off';
  renderSegmentedChoices();
}

async function exportHistoryItem(session, index) {
  const stamp = session.timestamp
    ? new Date(session.timestamp).toISOString().replace(/[:.]/g, '-').slice(0, 19)
    : 'session-step';
  const name = `history-${index + 1}-${stamp}.png`;
  const a = document.createElement('a');
  a.href = session.dataUrl;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

async function exportSessionEntry(entry, index) {
  const a = document.createElement('a');
  a.href = entry.dataUrl;
  a.download = `session-${index + 1}.png`;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

async function exportAllHistory() {
  const sessionView = sidebar.historyView === 'session';
  if (sessionView) {
    const entries = sidebar.historyManager?.getSessionEntries?.() || [];
    if (!entries.length) {
      statusBar.flash('No session steps to export');
      return;
    }
    for (let i = 0; i < entries.length; i += 1) {
      await exportSessionEntry(entries[i], i);
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    statusBar.flash(`Exported ${entries.length} session images`);
    return;
  }
  const sessions = await sidebar.globalHistory.getSessions();
  if (!sessions.length) {
    statusBar.flash('No history to export');
    return;
  }
  // Preferred: let the user pick a folder and write every image into it.
  if (window.showDirectoryPicker) {
    try {
      const dir = await window.showDirectoryPicker({ mode: 'readwrite' });
      for (let i = 0; i < sessions.length; i += 1) {
        const stamp = new Date(sessions[i].timestamp).toISOString().replace(/[:.]/g, '-').slice(0, 19);
        const name = `history-${sessions.length - i}-${stamp}.png`;
        const blob = await (await fetch(sessions[i].dataUrl)).blob();
        const handle = await dir.getFileHandle(name, { create: true });
        const writable = await handle.createWritable();
        await writable.write(blob);
        await writable.close();
      }
      statusBar.flash(`Exported ${sessions.length} images to folder`);
      return;
    } catch (err) {
      if (err && err.name === 'AbortError') return;
      console.warn('Directory export failed, falling back to downloads:', err);
    }
  }
  // Fallback: sequential downloads (newest first, matching grid order).
  for (let i = 0; i < sessions.length; i += 1) {
    await exportHistoryItem(sessions[i], sessions.length - 1 - i);
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  statusBar.flash(`Exported ${sessions.length} images`);
}

function applyHistoryLimit(val) {
  const parsed = parseInt(val, 10);
  const safe = Number.isNaN(parsed) ? 50 : parsed;
  syncHistoryLimitSelect(safe);
  if (sidebar?.globalHistory?.db) {
    sidebar.globalHistory.saveSettings(safe, safe > 0);
  }
}

function applyHistoryState() {
  const { autoSave } = getHistoryPrefs();
  statusBar?.flash?.(autoSave ? 'History auto-save on' : 'History auto-save off');
  syncHistoryControls();
}

// ---------- Settings dialog ----------
function applySavedSettings() {
  const saved = readSettings();
  dmCheckbox.checked = Boolean(saved.darkMode);
  sbCheckbox.checked = saved.showStatusBar !== false;
  ciCheckbox.checked = saved.showColorInspector !== false;
  if (aiCheckbox) aiCheckbox.checked = saved.showAiChat === true;
  bgSelect.value = saved.canvasBackground || 'none';
  defaultCanvasSizeSelect.value = saved.defaultCanvasSize || '800x600';
  defaultZoomSelect.value = String(saved.defaultZoom || 100);
  viewportManager.setInitialZoom(defaultZoomSelect.value);
  if (!localStorage.getItem('paint:zoom')) viewportManager.setZoom(defaultZoomSelect.value);
  if (!localStorage.getItem('omerpaint:last-canvas')) {
    const { width, height } = getDefaultCanvasSize();
    if (width !== canvasManager.width || height !== canvasManager.height) canvasManager.resize(width, height);
  }
  syncHistoryControls(saved);
  document.body.classList.toggle('dark-mode', dmCheckbox.checked);
  document.querySelector('.status-bar').style.display = sbCheckbox.checked ? 'grid' : 'none';
  document.getElementById('color-inspector').style.display = ciCheckbox.checked ? 'flex' : 'none';
  document.getElementById('canvas-viewport').classList.toggle('bg-checkerboard', bgSelect.value === 'checkerboard');
  document.getElementById('canvas-viewport').classList.toggle('bg-grid', bgSelect.value === 'grid');
  const ribbonVisibility = saved.ribbonVisibility || {};
  document.querySelectorAll('.ribbon-group').forEach((groupSection) => {
    const title = groupSection.querySelector('.ribbon-group-title');
    if (!title || ribbonVisibility[title.textContent.trim()] === undefined) return;
    const visible = ribbonVisibility[title.textContent.trim()];
    groupSection.hidden = !visible;
    [...groupSection.children]
      .filter((child) => !child.classList.contains('ribbon-group-title') && child.id !== 'file-input')
      .forEach((child) => {
        child.hidden = !visible;
        child.style.display = visible ? '' : 'none';
      });
    const separator = groupSection.nextElementSibling;
    if (separator?.classList.contains('separator')) separator.style.display = visible ? '' : 'none';
  });
  const buttonVisibility = saved.buttonVisibility || {};
  document.querySelectorAll('.rbtn[id]').forEach((button) => {
    if (buttonVisibility[button.id] === undefined) return;
    button.hidden = !buttonVisibility[button.id];
    button.style.display = buttonVisibility[button.id] ? '' : 'none';
  });
  const fileInput = document.getElementById('file-input');
  if (fileInput) {
    fileInput.hidden = true;
    fileInput.style.display = 'none';
  }
  const rotateToggle = document.getElementById('rotate-selection-toggle');
  if (rotateToggle) {
    rotateToggle.checked = saved.showRotateInSelection !== false;
  }
  // Settings is the stable escape hatch for ribbon configuration.
  const settingsButton = document.getElementById('btn-settings');
  if (settingsButton) { settingsButton.hidden = false; settingsButton.style.display = ''; }
  const extrasGroup = document.querySelector('.ribbon-group-extras');
  if (extrasGroup) {
    extrasGroup.hidden = false;
    extrasGroup.style.display = '';
    [...extrasGroup.children]
      .filter((child) => !child.classList.contains('ribbon-group-title'))
      .forEach((child) => { child.hidden = false; child.style.display = child.classList.contains('rbtn-row') ? 'flex' : ''; });
  }
  applyAiChatVisibility(aiCheckbox?.checked === true);
  const inspectorSeparator = document.querySelector('.color-inspector')?.nextElementSibling;
  if (inspectorSeparator?.classList.contains('separator')) {
    inspectorSeparator.style.display = ciCheckbox.checked ? '' : 'none';
  }
  const layout = saved.ribbonLayout || ribbonLayoutManager.state;
  ribbonLayoutManager.setPosition(layout.position || 'top');
  ribbonLayoutManager.setVisible(layout.visible !== false);
  if (settingsShowRibbon) settingsShowRibbon.checked = ribbonLayoutManager.state.visible;
  if (settingsRibbonPosition) settingsRibbonPosition.value = ribbonLayoutManager.state.position;
  renderSegmentedChoices();
  syncRibbonSettingsControls();
}

function syncRibbonSettingsControls() {
  document.querySelectorAll('[data-ribbon-group-setting]').forEach((checkbox) => {
    const group = document.querySelector(`.${checkbox.dataset.ribbonGroupSetting}`);
    if (!group) return;
    checkbox.checked = [...group.children]
      .filter((child) => !child.classList.contains('ribbon-group-title') && child.id !== 'file-input')
      .some((child) => !child.hidden && child.style.display !== 'none');
  });
}

async function updateAboutStats() {
  document.getElementById('about-version').textContent = APP_VERSION;
  document.getElementById('about-activity').textContent = new Date().toLocaleString();
  // Storage numbers are estimates, not disk truth.
  //  - usage keeps 2 decimals: rounding it to whole MB displayed "0 MB" (and a
  //    0% bar) for a small but non-empty store. "0.00 MB" / 0% must mean
  //    genuinely empty, so any real usage shows at least 1%.
  //  - the quota is whole MB and capped: browsers report ~10 GB fantasy quotas,
  //    which made the old "10242.87 MB" total read like a real, unstable limit.
  const MB = 1024 * 1024;
  const fmt2 = (mb) => `${mb.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} MB`;
  const fmt0 = (mb) => `${Math.round(mb).toLocaleString('en-US')} MB`;
  try {
    const estimate = await navigator.storage?.estimate();
    const usageMB = (estimate?.usage || 0) / MB;
    const quotaMB = (estimate?.quota || 0) / MB;
    const displayQuotaMB = quotaMB > 0 ? Math.min(Math.round(quotaMB), 10000) : 0;
    document.getElementById('about-storage').textContent = fmt2(usageMB);
    const freeEl = document.getElementById('about-storage-free');
    if (freeEl) {
      freeEl.textContent = displayQuotaMB > 0
        ? `${fmt0(Math.max(0, displayQuotaMB - usageMB))} free of ${fmt0(displayQuotaMB)}`
        : 'Unavailable';
    }
    const fill = document.getElementById('about-storage-bar-fill');
    if (fill) {
      let pct = 0;
      if (displayQuotaMB > 0 && usageMB > 0) {
				pct = Math.max(1, Math.ceil((usageMB / displayQuotaMB) * 100));
			}
			const addingNormelize = pct > 50 && pct !== 0 ? 0 : 2;
      fill.style.width = pct + addingNormelize + '%';
    }
  } catch {
    document.getElementById('about-storage').textContent = 'Unavailable';
    const freeEl = document.getElementById('about-storage-free');
    if (freeEl) freeEl.textContent = 'Unavailable';
  }
}

function renderReleaseNotes() {
  const host = document.getElementById('release-notes-list');
  if (!host) return;
  host.innerHTML = '';
  for (const note of getReleaseNotes()) {
    const card = document.createElement('div');
    card.className = 'release-note-card';
    const head = document.createElement('div');
    head.className = 'release-note-head';
    const ver = document.createElement('strong');
    ver.textContent = note.version === 'Unreleased' ? 'Unreleased' : `v${note.version}`;
    head.appendChild(ver);
    if (note.date) {
      const date = document.createElement('span');
      date.className = 'release-note-date';
      date.textContent = note.date;
      head.appendChild(date);
    }
    const list = document.createElement('ul');
    for (const item of note.highlights) {
      const li = document.createElement('li');
      li.textContent = item;
      list.appendChild(li);
    }
    card.append(head, list);
    host.appendChild(card);
  }
}
renderReleaseNotes();

document.querySelectorAll('[data-settings-tab]').forEach((tab) => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('[data-settings-tab]').forEach((item) => item.classList.toggle('active', item === tab));
    document.querySelectorAll('[data-settings-panel]').forEach((panel) => {
      panel.hidden = panel.dataset.settingsPanel !== tab.dataset.settingsTab;
    });
    if (tab.dataset.settingsTab === 'about') updateAboutStats();
    if (settingsDialog.open) setDialogUrl('settings', { tab: tab.dataset.settingsTab });
  });
});

function populateRibbonSettings() {
  const container = document.getElementById('ribbon-settings-list');
  if (!container) return;
  container.innerHTML = '';
  document.querySelectorAll('.ribbon-group').forEach((groupSection) => {
    const title = groupSection.querySelector('.ribbon-group-title');
    if (!title) return;
    const row = document.createElement('div');
    row.className = 'ribbon-setting-row';
    const label = document.createElement('label');
    label.className = 'checkbox-row';
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.dataset.ribbonGroupSetting = [...groupSection.classList].find((name) => name.startsWith('ribbon-group-')) || '';
    checkbox.checked = [...groupSection.children]
      .filter((child) => !child.classList.contains('ribbon-group-title') && child.id !== 'file-input')
      .some((child) => !child.hidden && child.style.display !== 'none');
    const isExtras = groupSection.classList.contains('ribbon-group-extras');
    if (isExtras) checkbox.disabled = true;
    checkbox.addEventListener('change', () => {
      if (isExtras) return;
      [...groupSection.children]
        .filter((child) => !child.classList.contains('ribbon-group-title') && child.id !== 'file-input')
        .forEach((child) => {
          child.hidden = !checkbox.checked;
          child.style.display = checkbox.checked ? '' : 'none';
        });
      const separator = groupSection.nextElementSibling;
      groupSection.hidden = !checkbox.checked;
      if (separator?.classList.contains('separator')) separator.style.display = checkbox.checked ? '' : 'none';
        saveSettings();
    });
    label.append(checkbox, document.createTextNode(isExtras ? `${title.textContent} (Settings always visible)` : title.textContent));
    const details = document.createElement('button');
    details.type = 'button';
    details.className = 'ribbon-setting-details';
    details.textContent = 'Details';
    details.addEventListener('click', () => sidebar.showGroupSettings(title.textContent, groupSection));
    row.append(label, details);
    container.appendChild(row);
  });
}

populateRibbonSettings();

document.getElementById('settings-reset').addEventListener('click', async () => {
  const confirmed = await dialogService.confirm({
    title: 'Reset settings',
    message: 'Reset all settings to their defaults? Colors, layout, tools, zoom, history preferences and other preferences will be reset. Saved images and history entries will not be deleted.',
    confirmLabel: 'Reset settings',
    danger: true,
  });
  if (!confirmed) return;
  const resetButton = document.getElementById('settings-reset');
  if (resetButton) resetButton.disabled = true;
  settingsRegistry.resetAll().finally(() => {
    settingsDialog.close();
    window.location.reload();
  });
});

settingsDialog.addEventListener('close', () => {
  if (new URLSearchParams(window.location.search).get('dialog') === 'settings') setDialogUrl(null);
});
document.getElementById('settings-close').addEventListener('click', () => settingsDialog.close());

document.getElementById('settings-clear-data').addEventListener('click', async () => {
  const confirmed = await dialogService.confirm({
    title: 'Clear all saved data',
    message: 'Clear the saved canvas, workspace data, settings, and history? This cannot be undone.',
    confirmLabel: 'Clear data',
    danger: true,
  });
  if (!confirmed) return;
  localStorage.clear();
  indexedDB.deleteDatabase('omerpaint_global_history');
  indexedDB.deleteDatabase('paint-workspace');
  settingsDialog.close();
  window.location.reload();
});

window.addEventListener('paint:ribbon-change', saveSettings);
window.addEventListener('paint:ribbon-change', syncRibbonSettingsControls);

// ---------- History controls wiring (sidebar + settings tab) ----------
const autoSaveToggle = document.getElementById('history-auto-save-toggle');
const settingAutoSave = document.getElementById('setting-history-auto-save');
const settingAutoMode = document.getElementById('setting-history-auto-save-mode');
const historyLimitSel = document.getElementById('history-save-limit');
const settingLimit = document.getElementById('setting-history-save-limit');

function persistHistoryPrefs() {
  const state = {
    historyAutoSave: autoSaveToggle ? autoSaveToggle.checked : (settingAutoSave ? settingAutoSave.checked : true),
    historyAutoSaveMode: settingAutoMode ? settingAutoMode.value : 'all',
  };
  try {
    const s = readSettings();
    Object.assign(s, state);
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
  } catch (err) {
    console.warn('Unable to save history prefs:', err);
  }
}

const onAutoSaveChange = (event) => {
  const enabled = event?.target?.checked ?? settingAutoSave?.checked ?? autoSaveToggle?.checked ?? true;
  if (settingAutoSave) settingAutoSave.checked = enabled;
  if (autoSaveToggle) autoSaveToggle.checked = enabled;
  persistHistoryPrefs();
  applyHistoryState();
  saveSettings();
};
autoSaveToggle?.addEventListener('change', onAutoSaveChange);
settingAutoSave?.addEventListener('change', onAutoSaveChange);
settingAutoMode?.addEventListener('change', () => {
  persistHistoryPrefs();
  syncHistoryControls();
  renderSegmentedChoices();
});
historyLimitSel?.addEventListener('change', (e) => applyHistoryLimit(e.target.value));
settingLimit?.addEventListener('change', (e) => applyHistoryLimit(e.target.value));

defaultZoomSelect?.addEventListener('change', () => {
  viewportManager.setInitialZoom(defaultZoomSelect.value);
  viewportManager.setZoom(defaultZoomSelect.value);
  saveSettings();
});
defaultCanvasSizeSelect?.addEventListener('change', saveSettings);

document.getElementById('history-export-all-btn')?.addEventListener('click', () => exportAllHistory());
window.addEventListener('paint:history-export-item', (e) => {
  exportHistoryItem(e.detail.session, e.detail.index);
  statusBar.flash('History image saved');
});
document.getElementById('settings-history-export-all')?.addEventListener('click', () => exportAllHistory());
document.getElementById('settings-history-clear')?.addEventListener('click', async () => {
  const confirmed = await dialogService.confirm({
    title: 'Clear history',
    message: 'Are you sure you want to permanently delete all saved history? This cannot be undone.',
    confirmLabel: 'Clear history',
    danger: true,
  });
  if (!confirmed) return;
  await sidebar.globalHistory.clearAll();
  if (sidebar.activeTab === 'history') await sidebar.refreshHistory();
  statusBar.flash('History cleared');
});

document.getElementById('settings-about-close').addEventListener('click', () => settingsDialog.close());

document.getElementById('btn-settings').addEventListener('click', () => openSettingsDialog());
document.getElementById('settings-cancel').addEventListener('click', () => settingsDialog.close());
document.getElementById('settings-footer-close')?.addEventListener('click', () => settingsDialog.close());
document.getElementById('rotate-selection-toggle')?.addEventListener('change', (event) => {
  updateSelectionHandles(canvasManager.selection);
  saveSettings();
});

// ---------- New file dialog ----------
const newFileDialog = document.getElementById('new-file-dialog');
if (newFileDialog) {
  document.getElementById('new-file-ok').addEventListener('click', doNewFile);
  document.getElementById('new-file-cancel').addEventListener('click', () => newFileDialog.close());
  newFileDialog.addEventListener('close', () => {
    if (new URLSearchParams(window.location.search).get('dialog') === 'new') setDialogUrl(null);
  });
}

dmCheckbox.addEventListener('change', (e) => {
  document.body.classList.toggle('dark-mode', e.target.checked);
  saveSettings();
});
sbCheckbox.addEventListener('change', (e) => {
  document.querySelector('.status-bar').style.display = e.target.checked ? 'grid' : 'none';
  saveSettings();
});
ciCheckbox.addEventListener('change', (e) => {
  document.getElementById('color-inspector').style.display = e.target.checked ? 'flex' : 'none';
  const separator = document.querySelector('.color-inspector')?.nextElementSibling;
  if (separator?.classList.contains('separator')) separator.style.display = e.target.checked ? '' : 'none';
  saveSettings();
});
aiCheckbox?.addEventListener('change', (e) => {
  applyAiChatVisibility(e.target.checked);
  saveSettings();
});
window.addEventListener('paint:ai-chat-visibility-change', (event) => {
  applyAiChatVisibility(event.detail === true);
  saveSettings();
});
bgSelect.addEventListener('change', (e) => {
  const viewport = document.getElementById('canvas-viewport');
  viewport.classList.remove('bg-checkerboard', 'bg-grid');
  if (e.target.value !== 'none') {
    viewport.classList.add('bg-' + e.target.value);
  }
  saveSettings();
});

applySavedSettings();

function restoreDialogFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const dialog = params.get('dialog');
  if (dialog === 'settings') openSettingsDialog(params.get('tab') || 'general');
  else if (dialog === 'resize') openResizeDialog();
  else if (dialog === 'new' && newFileDialog && !newFileDialog.open) newFileDialog.showModal();
}
restoreDialogFromUrl();

const iconCopyFormats = ['SVG', 'PNG 26x26', 'PNG 100x100', 'PNG 300x300', 'PNG 500x500'];
let iconCopyIndex = 0;
const appIcon = document.querySelector('.app-icon');

async function copyAppIcon() {
  const format = iconCopyFormats[iconCopyIndex];
  try {
    const svgText = await fetch(appIcon.src).then((response) => response.text());
    if (format === 'SVG') {
      const svgBlob = new Blob([svgText], { type: 'image/svg+xml' });
      await navigator.clipboard.write([
        new ClipboardItem({
          'image/svg+xml': svgBlob,
          'text/plain': new Blob([svgText], { type: 'text/plain' }),
        }),
      ]);
    } else {
      const size = Number(format.match(/\d+/)[0]);
      const image = await createImageBitmap(new Blob([svgText], { type: 'image/svg+xml' }));
      const output = document.createElement('canvas');
      output.width = size;
      output.height = size;
      output.getContext('2d').drawImage(image, 0, 0, size, size);
      const blob = await new Promise((resolve, reject) => output.toBlob((value) => value ? resolve(value) : reject(new Error('PNG encoding failed')), 'image/png'));
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
      image.close?.();
    }
    statusBar.flash(`Copied app icon as ${format}`);
    showToast(`Copied ${format}`, true);
  } catch (error) {
    console.warn('Unable to copy app icon:', error);
    statusBar.flash('Clipboard permission is required');
  } finally {
    iconCopyIndex = (iconCopyIndex + 1) % iconCopyFormats.length;
  }
}

appIcon?.addEventListener('click', copyAppIcon);

const toolbar = new Toolbar({
  root: document.getElementById('ribbon'),
  toolManager,
  setLineWidth: (w) => (canvasManager.lineWidth = w),
  setFontSize: (size) => toolContext.setFontSize(size),
  handlers: {
    newFile,
    openFile,
    importFile,
    save,
    paste: () => clipboardManager.paste(),
    cut: () => clipboardManager.cut(),
    copy: () => clipboardManager.copy(),
    crop,
    openResizeDialog,
    undo: () => { discardFloatingSelection(); historyManager.undo(); },
    redo: () => { discardFloatingSelection(); historyManager.redo(); },
    setPrimaryColor: (hex) => colorPalette.setPrimary(hex),
  },
});

// Toolbar owns the visual tool state; keep selection handles in sync with it
// so rotate/resize affordances only appear while Select is the active tool.
const toolbarToolChange = toolManager.onToolChange;
toolManager.onToolChange = (name) => {
  activeToolName = name;
  toolbarToolChange?.(name);
  updateSelectionHandles(canvasManager.selection);
};

document.querySelectorAll('.text-style-option').forEach((button) => {
  button.addEventListener('click', (event) => {
    // Keep More Tools open while styles are previewed and combined.
    event.stopPropagation();
    const style = button.dataset.textStyle;
    if (!TEXT_STYLE_NAMES.includes(style)) return;
    if (selectedTextStyles.includes(style)) {
      selectedTextStyles = selectedTextStyles.filter((value) => value !== style);
    } else {
      // Outline colors are alternatives, while effects such as shadow/bold can
      // be composed with one of them.
      const outlineStyles = ['outline', 'black-outline'];
      if (outlineStyles.includes(style)) {
        selectedTextStyles = selectedTextStyles.filter((value) => !outlineStyles.includes(value));
      }
      selectedTextStyles = [...selectedTextStyles, style];
    }
    saveTextStyles();
  });
});
document.querySelector('.text-style-picker')?.addEventListener('click', (event) => event.stopPropagation());
window.addEventListener('paint:primary-color-change', renderTextStyleControls);
renderTextStyleControls();

// ---------- Sidebar Init ----------
document.getElementById('btn-history-panel').addEventListener('click', () => sidebar.toggleHistory());
document.getElementById('btn-ai-chat').addEventListener('click', () => sidebar.toggleAi());
document.getElementById('history-settings-link')?.addEventListener('click', () => openSettingsDialog('history'));

document.querySelectorAll('.ribbon-group-title').forEach(titleEl => {
  titleEl.addEventListener('click', () => {
    const groupSection = titleEl.closest('.ribbon-group');
    if (groupSection) {
      sidebar.showGroupSettings(titleEl.textContent, groupSection);
    }
  });
});

// ---------- File / Storage logic ----------
historyManager.onChange = (canUndo, canRedo) => toolbar.setUndoRedoEnabled(canUndo, canRedo);

// Restore the current working image for one short session window. Older work
// remains available through global history instead of unexpectedly reopening
// as the active document.
const RECENT_CANVAS_TTL_MS = 24 * 60 * 60 * 1000;
void canvasManager.restoreFromStorage({ maxAgeMs: RECENT_CANVAS_TTL_MS }).then((restored) => {
  if (restored) {
    setSelection(null);
    statusBar.flash('Restored recent image');
  }
}).catch((error) => console.warn('Unable to restore recent image:', error));

let lifecycleSnapshotQueued = false;
function queueLifecycleHistorySnapshot() {
  if (lifecycleSnapshotQueued || !sidebar.globalHistory.historyEnabled) return;
  lifecycleSnapshotQueued = true;
  try {
    localStorage.setItem('paint:pending-history-save', JSON.stringify({
      dataUrl: canvasManager.canvas.toDataURL('image/png'),
      width: canvasManager.width,
      height: canvasManager.height,
      queuedAt: Date.now(),
    }));
  } catch (error) {
    console.warn('Unable to queue lifecycle history snapshot:', error);
  }
}

window.addEventListener('beforeunload', () => {
  // A shape lifted by "select after draw" exists only as a floating layer until
  // the selection is left. Closing or refreshing IS leaving it, so bake it onto
  // the canvas first — otherwise the refresh would silently discard the shape
  // that was just drawn (the canvas holds the pre-lift pixels, not the shape).
  commitFloatingSelection();
  persistSession();
  if (shouldAutoSaveOnClose()) sidebar.saveCurrentToHistory();
  if (shouldAutoSaveOnClose()) queueLifecycleHistorySnapshot();
});
window.addEventListener('pagehide', () => {
  commitFloatingSelection();
  if (shouldAutoSaveOnClose()) queueLifecycleHistorySnapshot();
}, { once: true });
let historySaveTimer = 0;
window.addEventListener('paint:changed', () => {
  if (!shouldAutoSaveHistory()) return;
  window.clearTimeout(historySaveTimer);
  historySaveTimer = window.setTimeout(() => sidebar.saveCurrentToHistory(), 700);
});

// Default tool, per the brief: Select (not Pencil, unlike real Windows Paint).
// But restore the user's last selected tool if available
const savedTool = restoreToolSelection();
toolManager.setActive(savedTool);
saveToolSelection(savedTool);

// Finish sidebar initialization after globalHistory is ready
(async () => {
  await sidebar.finishInit();
  await sidebar.flushPendingAutoSave();
  syncHistoryLimitSelect(sidebar.globalHistory.maxHistory);
  renderSegmentedChoices();
})();

// Click outside the paint area to commit and clear selection
const viewportEl = document.getElementById('canvas-viewport');
if (viewportEl) {
  viewportEl.addEventListener('pointerdown', (e) => {
    if (e.target === viewportEl || e.target === stage) {
      commitFloatingSelection();
      setSelection(null);
    }
  });
}

// ---------- Keyboard shortcuts ----------
const TOOL_KEYS = {
  s: 'select', p: 'pencil', b: 'brush', f: 'fill', e: 'eraser', t: 'text', k: 'eyedropper', z: 'zoom',
};

window.addEventListener('keydown', (e) => {
  const tag = document.activeElement?.tagName;
  const typing = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
  // Undo: Ctrl/Cmd+Z (Shift = redo). Redo: Ctrl+Y or Ctrl/Cmd+Shift+Z.
  // Skipped while typing so text fields keep native behavior.
  if ((e.ctrlKey || e.metaKey) && !e.altKey && !typing) {
    const key = e.key.toLowerCase();
    if (key === 'z' && !e.shiftKey) {
      e.preventDefault();
      historyManager.undo();
      return;
    }
    if ((key === 'y') || (key === 'z' && e.shiftKey)) {
      e.preventDefault();
      historyManager.redo();
      return;
    }
  }

  if (e.ctrlKey || e.metaKey) {
    switch (e.key.toLowerCase()) {
      case 'a': {
        // Select all on the canvas. Only let the browser take over when an
        // actual multi-line text entry is focused (the text tool's textarea),
        // where native select-all-text is expected. Number/select/other form
        // controls keep Ctrl+A as "select the whole picture".
        const el = document.activeElement;
        const inTextEntry = tag === 'TEXTAREA' || (el && el.isContentEditable === true);
        if (inTextEntry) return;
        e.preventDefault();
        selectAll();
        return;
      }
      case 'z':
        e.preventDefault();
        discardFloatingSelection();
        e.shiftKey ? historyManager.redo() : historyManager.undo();
        return;
      case 'y':
        e.preventDefault();
        discardFloatingSelection();
        historyManager.redo();
        return;
      case 'c':
      case 'x': {
        // Defer to the browser only when the focused field has selected text
        // worth copying natively. Otherwise treat Cmd/Ctrl+C/X as an image
        // clipboard action even when a ribbon control (e.g. a size input)
        // still holds focus — previously the shortcut silently did nothing.
        const el = document.activeElement;
        const editable = el instanceof HTMLTextAreaElement || el?.isContentEditable ||
          (el instanceof HTMLInputElement &&
            !['checkbox', 'radio', 'range', 'color', 'button', 'submit'].includes(el.type));
        const hasTextSelection = editable &&
          typeof el.selectionStart === 'number' && el.selectionStart !== el.selectionEnd;
        if (editable && hasTextSelection) return;
        e.preventDefault();
        if (e.key.toLowerCase() === 'c') clipboardManager.copy();
        else clipboardManager.cut();
        return;
      }
      case 'v':
        // Handled by the native 'paste' event listener below: it carries the
        // clipboard image without any read permission, so Cmd+V works on Mac
        // (Safari blocks navigator.clipboard.read() outside real gestures).
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
  
  if (e.key.startsWith('Arrow')) {
    if (canvasManager.floatingCanvas && canvasManager.selection) {
      e.preventDefault();
      const sel = canvasManager.selection;
      const step = e.shiftKey ? 10 : 1;
      if (e.key === 'ArrowUp') sel.y -= step;
      if (e.key === 'ArrowDown') sel.y += step;
      if (e.key === 'ArrowLeft') sel.x -= step;
      if (e.key === 'ArrowRight') sel.x += step;
      setSelection(sel);
      return;
    }
  }

const tool = TOOL_KEYS[e.key.toLowerCase()];
  if (tool) toolManager.setActive(tool);
});

// ---------- Native paste events (Cmd/Ctrl+V on any OS, incl. macOS) ----------
// The browser dispatches a real 'paste' event for Cmd+V with clipboard contents
// attached — no async clipboard-read permission needed (Safari on Mac blocks
// navigator.clipboard.read() most of the time).
document.addEventListener('paste', async (e) => {
  const target = e.target;
  const editingText = target instanceof HTMLElement &&
    (target.tagName === 'TEXTAREA' || target.tagName === 'INPUT' || target.isContentEditable);
  if (editingText) return; // let form fields receive normal text paste

  const items = e.clipboardData?.items;
  if (items) {
    for (const item of items) {
      if (!item.type.startsWith('image/')) continue;
      const file = item.getAsFile();
      if (!file) continue;
      e.preventDefault();
      try {
        await clipboardManager.insertImageBlob(file, { sourceLabel: 'Pasted' });
      } catch (err) {
        console.error('Paste failed:', err);
        statusBar.flash('Paste failed — unsupported image data');
      }
      return;
    }
  }
  statusBar.flash('Clipboard has no image to paste');
});

// ---------- Drag and Drop ----------
window.addEventListener('dragover', (e) => e.preventDefault());
window.addEventListener('drop', async (e) => {
  e.preventDefault();
  const file = e.dataTransfer?.files?.[0];
  if (file && file.type.startsWith('image/')) {
    const bitmap = await createImageBitmap(file);
    await clipboardManager.insertBitmapAsFloatingSelection(bitmap, {
      sourceLabel: `Dropped ${file.name}`,
    });
    fileHandle = null;
  }
});

export { canvasManager };
