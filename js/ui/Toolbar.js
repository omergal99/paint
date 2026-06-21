// js/ui/Toolbar.js
export class Toolbar {
  constructor({ root, toolManager, setLineWidth, handlers }) {
    this.root = root;
    this.toolManager = toolManager;
    this.handlers = handlers; // {newFile, openFile, save, saveAs, copy, cut, paste, crop, openResizeDialog, undo, redo}

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
    this._bindLineSize(setLineWidth);
    this._bindFileButtons();
    this._bindUndoRedo();

    toolManager.onToolChange = (name) => this._highlightTool(name);
  }

  _bindTools() {
    this.toolButtons.forEach((btn) => {
      btn.addEventListener('click', () => this.toolManager.setActive(btn.dataset.tool));
    });
  }

  _highlightTool(name) {
    this.toolButtons.forEach((b) => b.classList.toggle('active', b.dataset.tool === name));
    // Selecting any of the shape-drawing tools is implicit: the "shape" tool
    // itself isn't a ribbon button — shapes are chosen via the Shapes group
    // and always use the active drawing color. If a shape is clicked, switch
    // to the shape tool automatically (handled in _bindShapes).
  }

  _bindShapes() {
    this.shapeButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        this._shapeKind = btn.dataset.shape;
        this.shapeButtons.forEach((b) => b.classList.toggle('active', b === btn));
        this.toolManager.setActive('shape');
      });
    });
  }

  _bindFillModes() {
    this.fillModeButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        this._fillMode = btn.dataset.fillmode;
        this.fillModeButtons.forEach((b) => b.classList.toggle('active', b === btn));
      });
    });
  }

  _bindLineSize(setLineWidth) {
    const select = this.root.querySelector('#line-size');
    select.addEventListener('change', () => setLineWidth(parseInt(select.value, 10)));
  }

  _bindFileButtons() {
    document.getElementById('btn-new').addEventListener('click', () => this.handlers.newFile());
    document.getElementById('btn-open').addEventListener('click', () => this.handlers.openFile());
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
