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
import { Sidebar } from './ui/Sidebar.js';
import { hexToRgb } from './utils/color.js';
import { rotateCanvas, rotateCanvasByAngle, flipCanvas, scaleCanvas, removeBackground } from './utils/transform.js';
import { APP_VERSION } from './version.js';

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

const sidebar = new Sidebar({ canvasManager, statusBar });

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
const primaryRgb = hexToRgb(colorPalette.primary);
if (primaryRgb) {
  colorInspector.show({ ...primaryRgb, hex: colorPalette.primary });
}

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

function updateSelectionHandles(region) {
  selectionHandles.forEach((handle) => {
    handle.hidden = !region || !region.w || !region.h;
  });
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
    setSelection(null);
    canvasManager.persistToStorage();
  }
}

function discardFloatingSelection() {
  if (canvasManager.floatingCanvas) {
    canvasManager.floatingCanvas = null;
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

// Font size state
let currentFontSize = (() => {
  try {
    const saved = localStorage.getItem('paint:font-size');
    return saved ? parseInt(saved, 10) : 24;
  } catch {
    return 24;
  }
})();

const toolContext = {
  canvasManager,
  historyManager,
  viewportManager,
  stage,
  colorInspector,
  getSelection,
  setSelection,
  commitFloatingSelection,
  discardFloatingSelection,
  drawSelectionOutline,
  setPrimaryColor: (hex) => colorPalette.setPrimary(hex),
  setSecondaryColor: (hex) => colorPalette.setSecondary(hex),
  getShapeKind: () => toolbar.getShapeKind(),
  getShapeFillMode: () => toolbar.getFillMode(),
  getFontSize: () => currentFontSize,
  getFontFamily: () => 'Segoe UI, sans-serif',
  setFontSize: (size) => {
    currentFontSize = Math.max(1, Math.min(100, parseInt(size, 10)));
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
  new TextTool(),
  new EyedropperTool(),
  new ZoomTool(),
].forEach((t) => toolManager.register(t));

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
  document.getElementById('new-file-dialog').showModal();
}

async function doNewFile() {
  await sidebar.saveCurrentToHistory();
  discardFloatingSelection();
  historyManager.clear();
  fileHandle = null;
  canvasManager.loadFromSource(makeBlankSource(800, 600));
  setSelection(null);
  persistSession();
  document.getElementById('new-file-dialog').close();
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
  discardFloatingSelection();
  historyManager.snapshot();
  canvasManager.loadFromSource(bitmap);
  fileHandle = null;
  setSelection(null);
  persistSession();
  statusBar.flash(`Opened ${file.name}`);
});

async function save() {
  commitFloatingSelection();
  sidebar.saveCurrentToHistory();
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

document.getElementById('btn-rotate').addEventListener('click', (event) => {
  toggleActionMenu(event);
});
document.getElementById('btn-rotate-90').addEventListener('click', () => applyTransformation(c => rotateCanvas(c, 1)));
document.getElementById('btn-rotate-180').addEventListener('click', () => applyTransformation(c => rotateCanvas(c, 2)));
document.getElementById('btn-rotate-270').addEventListener('click', () => applyTransformation(c => rotateCanvas(c, 3)));
document.getElementById('btn-rotate-free').addEventListener('click', () => {
  const degrees = Number.parseFloat(window.prompt('Rotation angle in degrees', '15'));
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
document.getElementById('btn-remove-bg').addEventListener('click', () => applyTransformation(c => removeBackground(c, 30)));
bindSelectionHandles();

document.addEventListener('click', () => {
  document.querySelectorAll('.action-menu.open').forEach((menu) => menu.classList.remove('open'));
});

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
const bgSelect = document.getElementById('setting-canvas-bg');
const SETTINGS_KEY = 'omerpaint:settings';

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
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({
      darkMode: dmCheckbox.checked,
      showStatusBar: sbCheckbox.checked,
      showColorInspector: ciCheckbox.checked,
      canvasBackground: bgSelect.value,
      ribbonVisibility,
      buttonVisibility,
    }));
  } catch (error) { console.warn('Unable to save settings:', error); }
}

function applySavedSettings() {
  const saved = readSettings();
  dmCheckbox.checked = Boolean(saved.darkMode);
  sbCheckbox.checked = saved.showStatusBar !== false;
  ciCheckbox.checked = saved.showColorInspector !== false;
  bgSelect.value = saved.canvasBackground || 'none';
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
}

async function updateAboutStats() {
  document.getElementById('about-version').textContent = APP_VERSION;
  document.getElementById('about-activity').textContent = new Date().toLocaleString();
  try {
    const estimate = await navigator.storage?.estimate();
    const megabytes = (estimate?.usage || 0) / (1024 * 1024);
    document.getElementById('about-storage').textContent = `${megabytes.toFixed(2)} MB`;
  } catch { document.getElementById('about-storage').textContent = 'Unavailable'; }
}

document.querySelectorAll('[data-settings-tab]').forEach((tab) => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('[data-settings-tab]').forEach((item) => item.classList.toggle('active', item === tab));
    document.querySelectorAll('[data-settings-panel]').forEach((panel) => {
      panel.hidden = panel.dataset.settingsPanel !== tab.dataset.settingsTab;
    });
    if (tab.dataset.settingsTab === 'about') updateAboutStats();
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
    checkbox.checked = [...groupSection.children]
      .filter((child) => !child.classList.contains('ribbon-group-title') && child.id !== 'file-input')
      .some((child) => !child.hidden && child.style.display !== 'none');
    checkbox.addEventListener('change', () => {
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
    label.append(checkbox, document.createTextNode(title.textContent));
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

document.getElementById('settings-reset').addEventListener('click', () => {
  localStorage.removeItem(SETTINGS_KEY);
  applySavedSettings();
});

document.getElementById('settings-close').addEventListener('click', () => settingsDialog.close());

document.getElementById('settings-clear-data').addEventListener('click', async () => {
  if (!window.confirm('Clear saved canvas data and history?')) return;
  localStorage.clear();
  indexedDB.deleteDatabase('omerpaint_global_history');
  indexedDB.deleteDatabase('paint-workspace');
  settingsDialog.close();
  window.location.reload();
});

window.addEventListener('paint:ribbon-change', saveSettings);

document.getElementById('settings-about-close').addEventListener('click', () => settingsDialog.close());

document.getElementById('btn-settings').addEventListener('click', () => settingsDialog.showModal());
document.getElementById('settings-cancel').addEventListener('click', () => settingsDialog.close());

// ---------- New file dialog ----------
const newFileDialog = document.getElementById('new-file-dialog');
if (newFileDialog) {
  document.getElementById('new-file-ok').addEventListener('click', doNewFile);
  document.getElementById('new-file-cancel').addEventListener('click', () => newFileDialog.close());
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

const iconCopyFormats = ['SVG', 'PNG 26x26', 'PNG 100x100', 'PNG 300x300', 'PNG 500x500'];
let iconCopyIndex = 0;
const appIcon = document.querySelector('.app-icon');

async function copyAppIcon() {
  const format = iconCopyFormats[iconCopyIndex];
  try {
    const svgText = await fetch(appIcon.src).then((response) => response.text());
    if (format === 'SVG') {
      await navigator.clipboard.writeText(svgText);
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
  handlers: {
    newFile,
    openFile,
    save,
    paste: () => clipboardManager.paste(),
    cut: () => clipboardManager.cut(),
    copy: () => clipboardManager.copy(),
    crop,
    openResizeDialog,
    undo: () => { discardFloatingSelection(); historyManager.undo(); },
    redo: () => { discardFloatingSelection(); historyManager.redo(); },
  },
});

// Restore line width from localStorage
(function restoreLineWidth() {
  try {
    const saved = localStorage.getItem('paint:line-width');
    if (saved) {
      const customInput = document.querySelector('#custom-line-size');
      if (customInput) {
        customInput.value = saved;
        customInput.dispatchEvent(new Event('input', { bubbles: true }));
      }
    }
  } catch (err) {
    console.warn('Unable to restore line width:', err);
  }
})();

// ---------- Sidebar Init ----------
document.getElementById('btn-history-panel').addEventListener('click', () => sidebar.toggleHistory());
document.getElementById('btn-ai-chat').addEventListener('click', () => sidebar.toggleAi());

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

(async () => {
  const restored = await canvasManager.restoreFromStorage();
  if (restored) {
    setSelection(null);
    statusBar.flash('Restored your last canvas');
  }
})();
window.addEventListener('beforeunload', () => {
  persistSession();
  sidebar.saveCurrentToHistory();
});

// Default tool, per the brief: Select (not Pencil, unlike real Windows Paint).
// But restore the user's last selected tool if available
const savedTool = restoreToolSelection();
toolManager.setActive(savedTool);
saveToolSelection(savedTool);

// Finish sidebar initialization after globalHistory is ready
(async () => {
  await sidebar.finishInit();
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

  if (e.ctrlKey || e.metaKey) {
    switch (e.key.toLowerCase()) {
      case 'a':
        if (typing) return;
        e.preventDefault();
        selectAll();
        return;
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

// ---------- Drag and Drop ----------
window.addEventListener('dragover', (e) => e.preventDefault());
window.addEventListener('drop', async (e) => {
  e.preventDefault();
  const file = e.dataTransfer?.files?.[0];
  if (file && file.type.startsWith('image/')) {
    const bitmap = await createImageBitmap(file);
    discardFloatingSelection();
    historyManager.snapshot();
    canvasManager.loadFromSource(bitmap);
    fileHandle = null;
    setSelection(null);
    persistSession();
    statusBar.flash(`Dropped ${file.name}`);
  }
});

export { canvasManager };
