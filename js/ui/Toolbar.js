// js/ui/Toolbar.js
const SHAPE_STORAGE_KEY = 'paint:selected-shape';

export class Toolbar {
  constructor({ root, toolManager, setLineWidth, setFontSize, handlers }) {
    this.root = root;
    this.toolManager = toolManager;
    this.handlers = handlers; // {newFile, openFile, importFile, save, saveAs, copy, cut, paste, crop, openResizeDialog, undo, redo}

    this.toolButtons = [...root.querySelectorAll('.tool-btn')];
    this.shapeButtons = [...root.querySelectorAll('.shape-btn')];
    this.fillModeButtons = [...root.querySelectorAll('.fillmode-btn')];

    this._shapeKind = 'line';
    this._fillMode = 'outline';
    this.getShapeKind = () => this._shapeKind;
    this.getFillMode = () => this._fillMode;

    this._bindTools();
    this._bindShapes();
    this._bindFillModes();
    this._bindLineSize(setLineWidth, setFontSize);
    this._bindFileButtons();
    this._bindUndoRedo();

    toolManager.onToolChange = (name) => this._highlightTool(name);

    this._restoreShape();
  }

  _bindTools() {
    this.toolButtons.forEach((btn) => {
      btn.addEventListener('click', () => this.toolManager.setActive(btn.dataset.tool));
    });
  }

  _highlightTool(name) {
    this.toolButtons.forEach((b) => b.classList.toggle('active', b.dataset.tool === name));
    // Selecting any of the shape-drawing tools is implicit: the "shape" tool
    // itself isn't a ribbon button — shapes are chosen via the Shapes gallery
    // and always use the active drawing color (handled in _bindShapes).
  }

  _bindShapes() {
    this.shapeButtons.forEach((btn) => {
      btn.addEventListener('click', () => this.selectShape(btn.dataset.shape, btn));
    });
  }

  /**
   * Pick a shape: store the kind, highlight the gallery tile, reflect the
   * chosen shape's icon on the dropdown trigger button and switch to the
   * shape tool. Persisted so a refresh keeps the last shape.
   */
  selectShape(kind, btnEl = null) {
    if (!kind) return;
    this._shapeKind = kind;
    this.shapeButtons.forEach((b) => b.classList.toggle('active', b === btnEl || (!btnEl && b.dataset.shape === kind)));
    const menuIcon = document.getElementById('shape-menu-icon');
    if (menuIcon) {
      const tileSvg = btnEl ? btnEl.querySelector('svg') : this.shapeButtons.find((b) => b.dataset.shape === kind)?.querySelector('svg');
      if (tileSvg) menuIcon.innerHTML = tileSvg.innerHTML;
    }
    this.toolManager.setActive('shape');
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
    if (!btn) return;
    this._shapeKind = kind;
    btn.classList.add('active');
    const menuIcon = document.getElementById('shape-menu-icon');
    if (menuIcon) menuIcon.innerHTML = btn.querySelector('svg').innerHTML;
  }

  _bindFillModes() {
    this.fillModeButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        this._fillMode = btn.dataset.fillmode;
        this.fillModeButtons.forEach((b) => b.classList.toggle('active', b === btn));
      });
    });
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
      setLineWidth(size);
      setFontSize(size);
      customInput.value = size;
      // Select matching option if exists
      const opt = Array.from(select.options).find(o => o.value == size);
      if (opt) select.value = size;
      // Save to localStorage
      try {
        localStorage.setItem('paint:line-width', size);
      } catch (err) {
        console.warn('Unable to save line width:', err);
      }
    };

    select.addEventListener('change', () => applySize(select.value));
    customInput.addEventListener('input', () => applySize(customInput.value));
  }

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
