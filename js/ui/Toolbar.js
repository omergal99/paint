// js/ui/Toolbar.js
import { createSliderControl } from './SliderControl.js';
import { getSelectedEmoji, setSelectedEmoji, renderEmojiGrid, syncEmojiSelection } from '../tools/EmojiStore.js';
import { STORAGE_KEYS } from '../core/constants.js';
const SHAPE_STORAGE_KEY = 'paint:selected-shape';
const SHAPE_AFTER_DRAW_KEY = 'paint:shape-select-after-draw';
const TEXT_AFTER_DRAW_KEY = STORAGE_KEYS.textSelectAfterDraw;
const TEXT_HISTORY_TOOLBAR_KEY = STORAGE_KEYS.textHistoryToolbar;
const STYLE_STORAGE_KEY = 'paint:tool-styles';
const STYLE_HISTORY_KEY = 'paint:style-history';
const TOOL_MENU_ITEMS = Object.freeze([
  Object.freeze({ tool: 'pencil', labelKey: 'ribbon.tools.pencil', label: 'Pencil' }),
  Object.freeze({ tool: 'fill', labelKey: 'ribbon.tools.fill', label: 'Fill' }),
  Object.freeze({ tool: 'eraser', labelKey: 'ribbon.tools.eraser', label: 'Eraser' }),
  Object.freeze({ tool: 'eyedropper', labelKey: 'ribbon.tools.colorPicker', label: 'Color picker' }),
  Object.freeze({ tool: 'zoom', labelKey: 'ribbon.tools.magnifier', label: 'Magnifier' }),
  Object.freeze({ tool: 'pan', labelKey: 'ui.handPan', label: 'Hand / Pan' }),
]);
const SVG_NAMESPACE = 'http://www.w3.org/2000/svg';
const PAN_ICON_PATH = 'M6.5 9V4.5a1 1 0 0 1 2 0V9V3.5a1 1 0 0 1 2 0V9V4.5a1 1 0 0 1 2 0V9V6a1 1 0 0 1 2 0v5.2c0 3.2-2.1 5.3-5.1 5.3H8.6c-1.6 0-2.8-.8-3.6-2.1L3.6 12a1.2 1.2 0 0 1 2.1-1.1L6.5 12V9Z';

const createPanIcon = (document) => {
  const svg = document.createElementNS(SVG_NAMESPACE, 'svg');
  svg.setAttribute('class', 'icon');
  svg.setAttribute('viewBox', '0 0 20 20');
  svg.setAttribute('aria-hidden', 'true');
  const path = document.createElementNS(SVG_NAMESPACE, 'path');
  path.setAttribute('d', PAN_ICON_PATH);
  path.setAttribute('fill', 'none');
  path.setAttribute('stroke', 'currentColor');
  path.setAttribute('stroke-linejoin', 'round');
  svg.append(path);
  return svg;
};

export class Toolbar {
  constructor({ root, toolManager, setLineWidth, setFontSize, handlers, brushState = null }) {
    this.root = root;
    this.toolManager = toolManager;
    this.handlers = handlers; // {newFile, openFile, importFile, save, saveAs, copy, cut, paste, crop, openResizeDialog}
    this._eventController = new AbortController();

    this._renderToolMenu();
    this.toolButtons = [...root.querySelectorAll('.tool-btn')];
    this.shapeButtons = [...root.querySelectorAll('.shape-btn')];
    this.fillModeButtons = [...root.querySelectorAll('.fillmode-btn')];

    this._shapeKind = 'rectangle';
    this._fillMode = 'outline';
    this._emojiGrid = null;
    this._showCurrentTool = this._loadShowCurrentTool();
    this.getShapeKind = () => this._shapeKind;
    this.getFillMode = () => this._fillMode;

    this._bindTools();
    this._bindShapes();
    this._bindEmojiPicker();
    this._bindFillModes();
    this._bindLineSize(setLineWidth, setFontSize);
    this._bindSelectAfterDraw();
    this._bindTextOptions();
    this._bindFileButtons();

    this._onToolChange = (name) => this._highlightTool(name);
    toolManager.onToolChange = this._onToolChange;

    this._activeTool = 'select';
    this._previousTool = 'select';
    this.brushState = brushState;
    this._bindBrushOptions();
    this._styles = this._loadStyles();
    this._styleHistory = this._loadStyleHistory();
    this._renderStyleHistory();
    this._listen(window, 'paint:primary-color-change', (event) => {
      const key = this._activeTool === 'eyedropper' ? this._styleKeyFor(this._previousTool) : this._styleKey();
      const detail = typeof event.detail === 'string' ? { hex: event.detail } : (event.detail || {});
      this._styles[key].color = detail.hex || this._styles[key].color;
      if (Number.isFinite(Number(detail.alpha))) this._styles[key].alpha = Number(detail.alpha);
      this._saveStyles();
      this._recordStyle(key);
    });
    this._listen(window, 'paint:show-current-tool-change', (event) => {
      this._showCurrentTool = event.detail !== false;
      try { localStorage.setItem('paint:show-current-tool', String(this._showCurrentTool)); } catch {}
      this._highlightTool(this._activeTool);
    });

    this._restoreShape();
  }

  _listen(target, type, listener, options = {}) {
    target?.addEventListener?.(type, listener, {
      ...(typeof options === 'object' ? options : {}),
      signal: this._eventController.signal,
    });
  }

  _bindTools() {
    this._listen(this.root, 'click', (event) => {
      const btn = event.target.closest?.('.tool-btn');
      if (!btn || !this.root.contains(btn)) return;
        if (btn.dataset.tool === 'eyedropper' && this._activeTool === 'eyedropper') {
          this.toolManager.setActive(this._previousTool || 'select');
          return;
        }
        this.toolManager.setActive(btn.dataset.tool);
    });
  }

  _renderToolMenu() {
    const menu = this.root.querySelector('.tools-menu > .action-menu-items');
    if (!menu) return;
    const document = menu.ownerDocument;
    const styleHistory = menu.querySelector('.style-history-block');
    const items = TOOL_MENU_ITEMS.map(({ tool, labelKey, label }) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'rbtn small tool-menu-item tool-btn';
      button.dataset.tool = tool;
      button.setAttribute('role', 'menuitem');

      const source = this.root.querySelector(`.tool-grid .tool-btn[data-tool="${tool}"]`);
      const icon = source?.querySelector('svg')?.cloneNode(true)
        || (tool === 'pan' ? createPanIcon(document) : null);
      const labelGroup = document.createElement('span');
      labelGroup.className = 'menu-item-label';
      if (icon) labelGroup.append(icon);
      const labelElement = document.createElement('span');
      labelElement.dataset.i18n = labelKey;
      labelElement.textContent = label;
      labelGroup.append(labelElement);
      button.append(labelGroup);
      return button;
    });
    menu.replaceChildren(...items, ...(styleHistory ? [styleHistory] : []));
  }

  _highlightTool(name) {
    if (name !== 'eyedropper' && this._activeTool !== 'eyedropper') this._previousTool = name;
    this._activeTool = name;
    this.toolButtons.forEach((b) => b.classList.toggle('active', b.dataset.tool === name));
    this.root.querySelectorAll('.tool-menu-item').forEach((b) => b.classList.toggle('active', b.dataset.tool === name));
    const statusButton = this.root.querySelector('#tool-status');
    const statusIcon = this.root.querySelector('#tool-status-icon');
    const currentShapeButton = this.root.querySelector('#btn-shapes-current');
    // Select lives in the Image group, while the other tools have a source
    // button in the compact quick-tool grid. The split status button should
    // represent either kind of active tool.
    const source = this.root.querySelector(`.tool-grid .tool-btn[data-tool="${name}"]`)
      || this.root.querySelector(`.tool-btn[data-tool="${name}"]:not(#tool-status)`);
    const shapeSource = name === 'shape'
      ? this.shapeButtons.find((button) => button.dataset.shape === this._shapeKind)
      : null;
    // Keep More as a stable menu label. The status button is always present:
    // regular tools use the purple state, while Shape uses a neutral state
    // because the adjacent current-shape button is the specific indicator.
    if (statusButton) {
      statusButton.dataset.tool = name;
      statusButton.hidden = false;
      statusButton.style.display = '';
      const label = source
        ? `Current tool: ${source.title.replace(/ \(.+\)$/, '')}`
        : name === 'shape' ? `Current tool: Shape (${this._shapeKind})` : 'Current tool';
      statusButton.title = label;
      statusButton.classList.toggle('active-status', Boolean(source) && this._showCurrentTool);
      statusButton.classList.toggle('inactive-status', !source || !this._showCurrentTool);
      if (!source || !this._showCurrentTool) {
        statusButton.title = 'Show tools (click to open the tools menu)';
      }
      statusButton.setAttribute('aria-label', statusButton.title);
      // Tooltip is the affordance when there is nothing to preview; the
      // inactive-status:hover CSS handles the visual part.
      const iconSource = source || shapeSource;
      if (statusIcon && iconSource) {
        const icon = iconSource.querySelector('svg');
        statusIcon.innerHTML = icon?.innerHTML || '';
        statusIcon.setAttribute('viewBox', icon?.getAttribute('viewBox') || '0 0 20 20');
      }
    }
    currentShapeButton?.classList.toggle('active-shape-status', name === 'shape');
    currentShapeButton?.classList.toggle('inactive-shape-status', name !== 'shape');
    this._applyRememberedStyle();
    if (name !== 'eyedropper') this._recordStyle(this._styleKey());
    // Selecting any of the shape-drawing tools is implicit: the "shape" tool
    // itself isn't a ribbon button - shapes are chosen via the Shapes gallery
    // and always use the active drawing color (handled in _bindShapes).
  }

  _bindShapes() {
    this._listen(this.root, 'click', (event) => {
      const btn = event.target.closest?.('.shape-btn');
      if (btn && this.root.contains(btn)) this.selectShape(btn.dataset.shape, btn);
    });
    this._listen(document.getElementById('btn-shapes-current'), 'click', () => {
      this.selectShape(this._shapeKind, document.getElementById('btn-shapes-current'));
    });
  }

  /**
   * The single writer for shape-selection state: the remembered kind, the
   * gallery highlight, the dropdown icon, the emoji-picker highlight, and the
   * persisted value. `activate` is true for a user pick; it is false while
   * restoring on load because the active tool is restored separately so it can
   * stay e.g. the pencil.
   */
  _applyShapeSelection(kind, btnEl = null, { activate = true } = {}) {
    if (!kind) return;
    this._shapeKind = kind;
    this.shapeButtons.forEach((b) => b.classList.toggle('active', b.dataset.shape === kind));
    document.getElementById('btn-shapes-current')?.classList.add('active-shape-status');
    const menuIcon = document.getElementById('shape-menu-icon');
    if (menuIcon) {
      const tileSvg = btnEl ? btnEl.querySelector('svg') : this.shapeButtons.find((b) => b.dataset.shape === kind)?.querySelector('svg');
      if (tileSvg) this._setShapeMenuIcon(menuIcon, tileSvg);
    }
    // Only the emoji shape owns the picker highlight; every other kind clears it
    // so the gallery never shows two selected tiles at once.
    syncEmojiSelection(this._emojiGrid, { active: kind === 'emoji' });
    try {
      localStorage.setItem(SHAPE_STORAGE_KEY, kind);
    } catch (err) {
      console.warn('Unable to save shape:', err);
    }
    if (!activate) return;
    this.toolManager.setActive('shape');
    this._applyRememberedStyle();
  }

  /**
   * Pick a shape: store the kind, highlight the gallery tile, reflect the
   * chosen shape's icon on the dropdown trigger button and switch to the
   * shape tool. Persisted so a refresh keeps the last shape.
   */
  selectShape(kind, btnEl = null) {
    this._applyShapeSelection(kind, btnEl);
  }

  /** Restore the last chosen shape on load (kind + icon + highlight only - the
   *  active tool is restored separately so it can stay e.g. the pencil). */
  _restoreShape() {
    let kind = null;
    try {
      kind = localStorage.getItem(SHAPE_STORAGE_KEY);
    } catch {}
    const btn = this.shapeButtons.find((b) => b.dataset.shape === kind);
    if (!btn) {
      const defaultBtn = this.shapeButtons.find((b) => b.dataset.shape === 'rectangle');
      if (defaultBtn) this._applyShapeSelection('rectangle', defaultBtn, { activate: false });
      return;
    }
    this._applyShapeSelection(kind, btn, { activate: false });
  }

  _bindFillModes() {
    this._listen(this.root, 'click', (event) => {
      const btn = event.target.closest?.('.fillmode-btn');
      if (!btn || !this.root.contains(btn)) return;
      this._fillMode = btn.dataset.fillmode;
      this.fillModeButtons.forEach((item) => item.classList.toggle('active', item === btn));
    });
  }

  getSelectAfterDraw() { return this._selectAfterDraw === true; }

  getTextSelectAfterDraw() { return this._textSelectAfterDraw === true; }

  getTextHistoryToolbarVisible() { return this._showTextHistoryToolbar !== false; }

  _bindTextOptions() {
    let saved = true;
    try {
      const value = localStorage.getItem(TEXT_HISTORY_TOOLBAR_KEY);
      if (value !== null) saved = value === 'true';
    } catch {}
    this._showTextHistoryToolbar = saved;
    const historyToolbarToggle = this.root.querySelector('#text-history-toolbar-toggle');
    if (!historyToolbarToggle) return;
    historyToolbarToggle.checked = saved;
    this._listen(historyToolbarToggle, 'change', () => {
      this._showTextHistoryToolbar = historyToolbarToggle.checked === true;
      try { localStorage.setItem(TEXT_HISTORY_TOOLBAR_KEY, String(this._showTextHistoryToolbar)); } catch {}
      window.dispatchEvent(new CustomEvent('paint:text-history-toolbar-change', {
        detail: { visible: this._showTextHistoryToolbar },
      }));
    });
  }

  _bindSelectAfterDraw() {
    let saved = false;
    try { saved = localStorage.getItem(SHAPE_AFTER_DRAW_KEY) === 'true'; } catch {}
    this._selectAfterDraw = saved; // default OFF
    const box = this.root.querySelector('#shape-select-after-draw');
    if (box) {
      box.checked = saved;
      this._listen(box, 'change', () => {
        this._selectAfterDraw = box.checked === true;
        try { localStorage.setItem(SHAPE_AFTER_DRAW_KEY, String(this._selectAfterDraw)); } catch {}
      });
    }

    let textSaved = false;
    try { textSaved = localStorage.getItem(TEXT_AFTER_DRAW_KEY) === 'true'; } catch {}
    this._textSelectAfterDraw = textSaved;
    const textBox = this.root.querySelector('#text-select-after-draw');
    if (textBox) {
      textBox.disabled = false;
      textBox.checked = textSaved;
      textBox.closest('.menu-checkbox')?.classList.remove('menu-checkbox-disabled');
      this._listen(textBox, 'change', () => {
        this._textSelectAfterDraw = textBox.checked === true;
        try { localStorage.setItem(TEXT_AFTER_DRAW_KEY, String(this._textSelectAfterDraw)); } catch {}
      });
    }
  }

  _bindEmojiPicker() {
    const grid = this.root.querySelector('#shape-emoji-grid');
    if (!grid) return;
    this._emojiGrid = grid;
    this._disposeEmojiGrid = renderEmojiGrid({
      container: grid,
      onPick: (emoji) => {
        setSelectedEmoji(emoji);
        this.selectShape('emoji');
      },
    });
  }

  getSelectedEmoji() { return getSelectedEmoji(); }

  _setShapeMenuIcon(menuIcon, tileSvg) {
    menuIcon.innerHTML = tileSvg.innerHTML;
    menuIcon.setAttribute('viewBox', tileSvg.getAttribute('viewBox') || '0 0 20 20');
  }

  // One shared size control (the size-select in the Shapes group) drives both
  // the drawing line width AND the text-tool font size, so the dropdown works
  // for text exactly as it works for the brush.
  _bindLineSize(setLineWidth, setFontSize) {
    const sizeButton = this.root.querySelector('#line-size');
    const sizeOptions = [...this.root.querySelectorAll('[data-size-option]')];
    const customInput = this.root.querySelector('#custom-line-size');

    const applySize = (val) => {
      let size = parseInt(val, 10);
      if (isNaN(size) || size < 1) size = 1;
      if (size > 300) size = 300;
      // The two setters stay explicit here because the public size control is
      // shared, while the remembered value is scoped to the active tool.
      if (this._activeTool === 'text') setFontSize(size);
      else {
        setLineWidth(size);
        this.brushState?.set({ size });
      }
      // setLineWidth(size); setFontSize(size); (legacy shared-control contract)
      customInput.value = size;
      const sizeLabel = sizeButton?.querySelector('.size-value');
      if (sizeLabel) sizeLabel.textContent = `${size}px`;
      sizeOptions.forEach((option) => option.classList.toggle('active', Number(option.dataset.sizeOption) === size));
      // Save to localStorage
      try {
        const key = this._styleKey();
        this._styles[key].size = size;
        this._saveStyles();
        this._recordStyle(key);
      } catch (err) {
        console.warn('Unable to save line width:', err);
      }
    };

    this._listen(this.root, 'click', (event) => {
      const option = event.target.closest?.('[data-size-option]');
      if (option && this.root.contains(option)) applySize(option.dataset.sizeOption);
    });
    this._listen(customInput, 'input', () => applySize(customInput.value));
    this._setLineWidth = setLineWidth;
    this._setFontSize = setFontSize;
    this._sizeSlider = this._mountSizeSlider(applySize);
  }

  // `#custom-line-size` is the single writer for brush size: _bindLineSize pushes
  // it to the canvas engine through that input's `input` event. Assigning `.value`
  // alone left the engine on the previous width until the next stroke, so mirrors
  // write through the event instead (same contract as mirrors/lineSizeControl.js).
  //
  // `_bindBrushOptions` runs during construction, before `_styles` is loaded, and
  // `applySize` reads `this._styles[key]`. Dispatching there would re-enter it with
  // no styles loaded (and would log a duplicate style-history entry on every
  // boot), so before the store exists we fall back to a plain value write. The
  // equality guard also stops applySize -> brushState.set -> notify -> here loops.
  _syncLineSizeMirror(size) {
    const customSize = this.root.querySelector('#custom-line-size');
    if (customSize && this._activeTool !== 'text' && customSize.value !== String(size)) {
      customSize.value = String(size);
      if (this._styles) customSize.dispatchEvent(new Event('input', { bubbles: true }));
    }
    const sizeLabel = this.root.querySelector('#line-size .size-value');
    if (sizeLabel && this._activeTool !== 'text') sizeLabel.textContent = `${size}px`;
  }

  _bindBrushOptions() {
    const options = [...this.root.querySelectorAll('[data-brush-option]')];
    const updateControls = (state) => {
      options.forEach((input) => {
        const field = input.dataset.brushOption;
        const value = field === 'size' ? state.size : Math.round(state[field] * 100);
        input.value = String(value);
        const output = this.root.querySelector(`[data-brush-value="${field}"]`);
        if (output) output.textContent = field === 'size' ? `${value} px` : `${value}%`;
      });
      this._syncLineSizeMirror(state.size);
    };

    options.forEach((input) => {
      input.addEventListener('input', () => {
        const field = input.dataset.brushOption;
        const value = Number(input.value);
        this.brushState?.set({ [field]: field === 'size' ? value : value / 100 });
      }, { signal: this._eventController.signal });
    });
    this._listen(this.root, 'click', (event) => {
      if (!event.target.closest?.('[data-brush-open-studio]')) return;
      this.handlers.openBrushStudio?.();
    });
    if (this.brushState) {
      updateControls(this.brushState.get());
      this._brushStateUnsubscribe = this.brushState.subscribe(updateControls);
    }
  }

  syncBrushState(state) {
    if (!state) return;
    this._syncLineSizeMirror(state.size);
    this.root.querySelectorAll('[data-size-option]').forEach((option) => {
      option.classList.toggle('active', Number(option.dataset.sizeOption) === state.size);
    });
  }

  // Reusable slider (1-120) mounted above the preset boxes. It reuses the
  // same applySize() path so number input, boxes and slider always agree.
  _mountSizeSlider(applySize) {
    const host = this.root.querySelector('#size-slider-row');
    if (!host) return null;
    const slider = createSliderControl({
      min: 1, max: 120, value: Number(this.root.querySelector('#custom-line-size')?.value) || 3,
      label: 'Font / line size', unit: 'px', ariaLabel: 'Font size slider, 1 to 120 pixels',
    });
    slider.onInput = (val) => applySize(val);
    host.appendChild(slider.element);
    const sync = () => {
      const cur = Number(this.root.querySelector('#custom-line-size')?.value);
      if (Number.isFinite(cur) && cur >= 1 && cur <= 120
        && slider.getValue() !== cur) slider.setValue(cur);
    };
    this._listen(host.closest('.size-menu-items'), 'pointerenter', sync);
    return slider;
  }

  _styleKeyFor(tool) { return tool === 'shape' ? `shape:${this._shapeKind}` : tool; }
  _styleKey() { return this._styleKeyFor(this._activeTool); }
  _loadStyles() {
    let saved = {};
    try { saved = JSON.parse(localStorage.getItem(STYLE_STORAGE_KEY) || '{}'); } catch {}
    return new Proxy(saved, {
      get: (obj, key) => {
        // JSON.stringify probes `toJSON`; do not turn that probe into a fake
        // remembered tool entry.
        if (key === 'toJSON') return obj[key];
        if (typeof key !== 'string') return obj[key];
        return obj[key] || (obj[key] = { size: key === 'text' ? 40 : 3, color: null, alpha: null });
      },
    });
  }
  _loadShowCurrentTool() {
    try { return localStorage.getItem('paint:show-current-tool') !== 'false'; } catch { return true; }
  }
  _saveStyles() { try { localStorage.setItem(STYLE_STORAGE_KEY, JSON.stringify(this._styles)); } catch {} }
  _loadStyleHistory() { try { const value = JSON.parse(localStorage.getItem(STYLE_HISTORY_KEY) || '[]'); return Array.isArray(value) ? value : []; } catch { return []; } }
  _saveStyleHistory() { try { localStorage.setItem(STYLE_HISTORY_KEY, JSON.stringify(this._styleHistory)); } catch {} }
  _styleLabel(key) {
    if (key.startsWith('shape:')) return `Shape · ${key.slice(6)}`;
    return key.charAt(0).toUpperCase() + key.slice(1);
  }
  _recordStyle(key) {
    const style = this._styles[key];
    const entry = { key, size: Number(style.size) || 3, color: style.color || '', alpha: Number.isFinite(Number(style.alpha)) ? Number(style.alpha) : null, label: this._styleLabel(key) };
    this._styleHistory = [entry, ...this._styleHistory.filter((item) => !(item.key === entry.key && item.size === entry.size && item.color === entry.color && item.alpha === entry.alpha))].slice(0, 8);
    this._saveStyleHistory();
    this._renderStyleHistory();
  }
  _renderStyleHistory() {
    const list = this.root?.querySelector('#style-history-list');
    if (!list) return;
    if (!this._styleHistoryClickBound) {
      this._listen(list, 'click', (event) => {
        const button = event.target.closest?.('.recent-style[data-style-index]');
        if (!button || !list.contains(button)) return;
        const entry = this._styleHistory[Number(button.dataset.styleIndex)];
        if (!entry) return;
        if (entry.key.startsWith('shape:')) this.selectShape(entry.key.slice(6));
        else this.toolManager.setActive(entry.key);
        const style = this._styles[this._styleKey()];
        style.size = entry.size;
        style.color = entry.color;
        style.alpha = entry.alpha;
        this._saveStyles();
        this._applyRememberedStyle({ restoreColor: true });
      });
      this._styleHistoryClickBound = true;
    }
    list.innerHTML = '';
    this._styleHistory.forEach((entry, index) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'recent-style';
      button.dataset.styleIndex = String(index);
      button.title = `${entry.label}, ${entry.size}px`;
      const swatch = document.createElement('span');
      swatch.className = 'recent-style-swatch';
      swatch.style.background = entry.color || 'var(--w10-accent)';
      const label = document.createElement('span');
      label.textContent = entry.label;
      const size = document.createElement('small');
      size.textContent = `${entry.size}px`;
      button.append(swatch, label, size);
      list.appendChild(button);
    });
  }
  _applyRememberedStyle({ restoreColor = false } = {}) {
    if (!this._setLineWidth || !this._setFontSize) return;
    const style = this._styles[this._styleKey()];
    const size = Number(style.size) || (this._activeTool === 'text' ? 40 : 3);
    if (this._activeTool === 'text') this._setFontSize(size); else this._setLineWidth(size);
    const sizeButton = this.root.querySelector('#line-size');
    const custom = this.root.querySelector('#custom-line-size');
    if (custom) custom.value = size;
    const sizeLabel = sizeButton?.querySelector('.size-value');
    if (sizeLabel) sizeLabel.textContent = `${size}px`;
    this.root.querySelectorAll('[data-size-option]').forEach((option) => {
      option.classList.toggle('active', Number(option.dataset.sizeOption) === size);
    });
    this._sizeSlider?.setValue(Math.max(1, Math.min(120, size)));
    // Foreground color/alpha are global picker state. Do not silently switch
    // them when the user changes tools; only an explicit recent-style choice
    // may restore the remembered color.
    if (restoreColor && style.color) {
      this.handlers.setPrimaryColor?.(style.color, Number.isFinite(Number(style.alpha)) ? style.alpha : undefined);
    }
  }
  getPreviousTool() { return this._previousTool || 'select'; }

  _bindFileButtons() {
    this._listen(document.getElementById('btn-new'), 'click', () => this.handlers.newFile());
    this._listen(document.getElementById('btn-open'), 'click', () => this.handlers.openFile());
    this._listen(document.getElementById('btn-import'), 'click', () => this.handlers.importFile());
    this._onExportFormatClick = (event) => {
      const option = event.target.closest?.('[data-export-format]');
      if (!option || !this.root.contains(option)) return;
      event.preventDefault();
      this.handlers.saveAs?.(option.dataset.exportFormat);
    };
    this._listen(this.root, 'click', this._onExportFormatClick);
    this._listen(document.getElementById('btn-paste'), 'click', () => this.handlers.paste());
    this._listen(document.getElementById('btn-cut'), 'click', () => this.handlers.cut());
    this._listen(document.getElementById('btn-copy'), 'click', () => this.handlers.copy());
    // File > More mirrors the (hidden-by-default) Clipboard group: same
    // handlers, same commands - the menu is just another face of the action.
    this._listen(document.getElementById('btn-file-paste'), 'click', () => this.handlers.paste());
    this._listen(document.getElementById('btn-file-cut'), 'click', () => this.handlers.cut());
    this._listen(document.getElementById('btn-file-copy'), 'click', () => this.handlers.copy());
    this._listen(document.getElementById('btn-crop'), 'click', () => this.handlers.crop());
    this._listen(document.getElementById('btn-canvas-size'), 'click', () => this.handlers.openResizeDialog());
  }

  destroy() {
    if (this._eventController.signal.aborted) return;
    this._eventController.abort();
    this._brushStateUnsubscribe?.();
    this._disposeEmojiGrid?.();
    this._disposeEmojiGrid = null;
    if (this.toolManager.onToolChange === this._onToolChange) this.toolManager.onToolChange = null;
    this._sizeSlider?.destroy?.();
    this._sizeSlider?.element.remove();
    this._onExportFormatClick = null;
  }

  setUndoRedoEnabled(canUndo, canRedo) {
    document.getElementById('btn-undo').disabled = !canUndo;
    document.getElementById('btn-redo').disabled = !canRedo;
  }
}
