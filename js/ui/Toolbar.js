// js/ui/Toolbar.js
const SHAPE_STORAGE_KEY = 'paint:selected-shape';
const STYLE_STORAGE_KEY = 'paint:tool-styles';
const STYLE_HISTORY_KEY = 'paint:style-history';

export class Toolbar {
  constructor({ root, toolManager, setLineWidth, setFontSize, handlers }) {
    this.root = root;
    this.toolManager = toolManager;
    this.handlers = handlers; // {newFile, openFile, importFile, save, saveAs, copy, cut, paste, crop, openResizeDialog, undo, redo}

    this.toolButtons = [...root.querySelectorAll('.tool-btn')];
    this.shapeButtons = [...root.querySelectorAll('.shape-btn')];
    this.fillModeButtons = [...root.querySelectorAll('.fillmode-btn')];

    this._shapeKind = 'rectangle';
    this._fillMode = 'outline';
    this._showCurrentTool = this._loadShowCurrentTool();
    this.getShapeKind = () => this._shapeKind;
    this.getFillMode = () => this._fillMode;

    this._bindTools();
    this._bindShapes();
    this._bindFillModes();
    this._bindLineSize(setLineWidth, setFontSize);
    this._bindFileButtons();
    this._bindUndoRedo();

    toolManager.onToolChange = (name) => this._highlightTool(name);

    this._activeTool = 'select';
    this._previousTool = 'select';
    this._styles = this._loadStyles();
    this._styleHistory = this._loadStyleHistory();
    this._renderStyleHistory();
    window.addEventListener('paint:primary-color-change', (event) => {
      const key = this._activeTool === 'eyedropper' ? this._styleKeyFor(this._previousTool) : this._styleKey();
      this._styles[key].color = event.detail;
      this._saveStyles();
      this._recordStyle(key);
    });
    window.addEventListener('paint:show-current-tool-change', (event) => {
      this._showCurrentTool = event.detail !== false;
      try { localStorage.setItem('paint:show-current-tool', String(this._showCurrentTool)); } catch {}
      this._highlightTool(this._activeTool);
    });

    this._restoreShape();
  }

  _bindTools() {
    this.root.querySelectorAll('.tool-menu-item').forEach((menuButton) => {
      const source = this.root.querySelector(`.tool-grid .tool-btn[data-tool="${menuButton.dataset.tool}"]`);
      if (source) menuButton.innerHTML = `${source.querySelector('svg')?.outerHTML || ''}<span>${source.title.replace(/ \(.+\)$/, '')}</span>`;
    });
    this.toolButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        if (btn.dataset.tool === 'eyedropper' && this._activeTool === 'eyedropper') {
          this.toolManager.setActive(this._previousTool || 'select');
          return;
        }
        this.toolManager.setActive(btn.dataset.tool);
      });
    });
  }

  _highlightTool(name) {
    if (name !== 'eyedropper' && this._activeTool !== 'eyedropper') this._previousTool = name;
    this._activeTool = name;
    this.toolButtons.forEach((b) => b.classList.toggle('active', b.dataset.tool === name));
    this.root.querySelectorAll('.tool-menu-item').forEach((b) => b.classList.toggle('active', b.dataset.tool === name));
    const statusButton = this.root.querySelector('#tool-status');
    const statusIcon = this.root.querySelector('#tool-status-icon');
    const currentShapeButton = this.root.querySelector('#btn-shapes-current');
    const source = this.root.querySelector(`.tool-grid .tool-btn[data-tool="${name}"]`);
    const showStatus = name !== 'select' && Boolean(source);
    // Keep More as a stable menu label. The adjacent status button is a
    // compact, purple current-tool indicator for both quick tools and tools
    // selected from More, without changing the More button's label.
    if (statusButton) {
      statusButton.dataset.tool = name;
      statusButton.hidden = !this._showCurrentTool || !showStatus;
      statusButton.title = source ? `Current tool: ${source.title.replace(/ \(.+\)$/, '')}` : 'Current tool';
      statusButton.classList.toggle('active-status', showStatus);
      if (statusIcon && source) statusIcon.innerHTML = source.querySelector('svg')?.innerHTML || '';
    }
    currentShapeButton?.classList.toggle('active-shape-status', name === 'shape');
    currentShapeButton?.classList.toggle('inactive-shape-status', name !== 'shape');
    this._applyRememberedStyle();
    if (name !== 'eyedropper') this._recordStyle(this._styleKey());
    // Selecting any of the shape-drawing tools is implicit: the "shape" tool
    // itself isn't a ribbon button — shapes are chosen via the Shapes gallery
    // and always use the active drawing color (handled in _bindShapes).
  }

  _bindShapes() {
    this.shapeButtons.forEach((btn) => {
      btn.addEventListener('click', () => this.selectShape(btn.dataset.shape, btn));
    });
    document.getElementById('btn-shapes-current')?.addEventListener('click', () => this.selectShape(this._shapeKind, document.getElementById('btn-shapes-current')));
  }

  /**
   * Pick a shape: store the kind, highlight the gallery tile, reflect the
   * chosen shape's icon on the dropdown trigger button and switch to the
   * shape tool. Persisted so a refresh keeps the last shape.
   */
  selectShape(kind, btnEl = null) {
    if (!kind) return;
    this._shapeKind = kind;
    this.shapeButtons.forEach((b) => b.classList.toggle('active', b.dataset.shape === kind));
    document.getElementById('btn-shapes-current')?.classList.add('active-shape-status');
    const menuIcon = document.getElementById('shape-menu-icon');
    if (menuIcon) {
      const tileSvg = btnEl ? btnEl.querySelector('svg') : this.shapeButtons.find((b) => b.dataset.shape === kind)?.querySelector('svg');
      if (tileSvg) this._setShapeMenuIcon(menuIcon, tileSvg);
    }
    this.toolManager.setActive('shape');
    this._applyRememberedStyle();
    try {
      localStorage.setItem(SHAPE_STORAGE_KEY, kind);
    } catch (err) {
      console.warn('Unable to save shape:', err);
    }
  }

  /** Restore the last chosen shape on load (kind + icon + highlight only — the
   *  active tool is restored separately so it can stay e.g. the pencil). */
  _restoreShape() {
    let kind = null;
    try {
      kind = localStorage.getItem(SHAPE_STORAGE_KEY);
    } catch {}
    const btn = this.shapeButtons.find((b) => b.dataset.shape === kind);
    if (!btn) {
      const defaultBtn = this.shapeButtons.find((b) => b.dataset.shape === 'rectangle');
      if (defaultBtn) this.selectShape('rectangle', defaultBtn);
      return;
    }
    this._shapeKind = kind;
    this.shapeButtons.forEach((shapeButton) => shapeButton.classList.toggle('active', shapeButton.dataset.shape === kind));
    document.getElementById('btn-shapes-current')?.classList.add('active-shape-status');
    const menuIcon = document.getElementById('shape-menu-icon');
    if (menuIcon) this._setShapeMenuIcon(menuIcon, btn.querySelector('svg'));
  }

  _bindFillModes() {
    this.fillModeButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        this._fillMode = btn.dataset.fillmode;
        this.fillModeButtons.forEach((b) => b.classList.toggle('active', b === btn));
      });
    });
  }

  _setShapeMenuIcon(menuIcon, tileSvg) {
    menuIcon.innerHTML = tileSvg.innerHTML;
    menuIcon.setAttribute('viewBox', tileSvg.getAttribute('viewBox') || '0 0 20 20');
  }

  // One shared size control (the size-select in the Shapes group) drives both
  // the drawing line width AND the text-tool font size, so the dropdown works
  // for text exactly as it works for the brush.
  _bindLineSize(setLineWidth, setFontSize) {
    const select = this.root.querySelector('#line-size');
    const customInput = this.root.querySelector('#custom-line-size');

    const applySize = (val) => {
      let size = parseInt(val, 10);
      if (isNaN(size) || size < 1) size = 1;
      if (size > 300) size = 300;
      // The two setters stay explicit here because the public size control is
      // shared, while the remembered value is scoped to the active tool.
      if (this._activeTool === 'text') setFontSize(size);
      else setLineWidth(size);
      // setLineWidth(size); setFontSize(size); (legacy shared-control contract)
      customInput.value = size;
      // Select matching option if exists
      const opt = Array.from(select.options).find(o => o.value == size);
      select.value = opt ? String(size) : '';
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

    select.addEventListener('change', () => applySize(select.value));
    customInput.addEventListener('input', () => applySize(customInput.value));
    this._setLineWidth = setLineWidth;
    this._setFontSize = setFontSize;
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
        return obj[key] || (obj[key] = { size: key === 'text' ? 40 : 3, color: null });
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
    const entry = { key, size: Number(style.size) || 3, color: style.color || '', label: this._styleLabel(key) };
    this._styleHistory = [entry, ...this._styleHistory.filter((item) => !(item.key === entry.key && item.size === entry.size && item.color === entry.color))].slice(0, 8);
    this._saveStyleHistory();
    this._renderStyleHistory();
  }
  _renderStyleHistory() {
    const list = this.root?.querySelector('#style-history-list');
    if (!list) return;
    list.innerHTML = '';
    this._styleHistory.forEach((entry) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'recent-style';
      button.title = `${entry.label}, ${entry.size}px`;
      const swatch = document.createElement('span');
      swatch.className = 'recent-style-swatch';
      swatch.style.background = entry.color || 'var(--w10-accent)';
      const label = document.createElement('span');
      label.textContent = entry.label;
      const size = document.createElement('small');
      size.textContent = `${entry.size}px`;
      button.append(swatch, label, size);
      button.addEventListener('click', () => {
        if (entry.key.startsWith('shape:')) this.selectShape(entry.key.slice(6));
        else this.toolManager.setActive(entry.key);
        const style = this._styles[this._styleKey()];
        style.size = entry.size;
        style.color = entry.color;
        this._saveStyles();
        this._applyRememberedStyle();
      });
      list.appendChild(button);
    });
  }
  _applyRememberedStyle() {
    if (!this._setLineWidth || !this._setFontSize) return;
    const style = this._styles[this._styleKey()];
    const size = Number(style.size) || (this._activeTool === 'text' ? 40 : 3);
    if (this._activeTool === 'text') this._setFontSize(size); else this._setLineWidth(size);
    const select = this.root.querySelector('#line-size');
    const custom = this.root.querySelector('#custom-line-size');
    if (custom) custom.value = size;
    if (select) select.value = [...select.options].some((o) => Number(o.value) === size) ? String(size) : '';
    if (style.color) this.handlers.setPrimaryColor?.(style.color);
  }
  getPreviousTool() { return this._previousTool || 'select'; }

  _bindFileButtons() {
    document.getElementById('btn-new').addEventListener('click', () => this.handlers.newFile());
    document.getElementById('btn-open').addEventListener('click', () => this.handlers.openFile());
    document.getElementById('btn-import').addEventListener('click', () => this.handlers.importFile());
    document.getElementById('btn-save').addEventListener('click', () => this.handlers.save());
    document.getElementById('btn-paste').addEventListener('click', () => this.handlers.paste());
    document.getElementById('btn-cut').addEventListener('click', () => this.handlers.cut());
    document.getElementById('btn-copy').addEventListener('click', () => this.handlers.copy());
    document.getElementById('btn-crop').addEventListener('click', () => this.handlers.crop());
    document.getElementById('btn-canvas-size').addEventListener('click', () => this.handlers.openResizeDialog());
  }

  _bindUndoRedo() {
    document.getElementById('btn-undo').addEventListener('click', () => this.handlers.undo());
    document.getElementById('btn-redo').addEventListener('click', () => this.handlers.redo());
  }

  setUndoRedoEnabled(canUndo, canRedo) {
    document.getElementById('btn-undo').disabled = !canUndo;
    document.getElementById('btn-redo').disabled = !canRedo;
  }
}
