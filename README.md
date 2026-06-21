# omerpaint

A browser-based paint app styled after classic **Windows 10 Paint** (Fluent ribbon, light theme, Segoe UI) — built with plain JavaScript (ES modules), no framework, no build step. Targets **Chrome/Edge** (uses the Async Clipboard API and the File System Access API).

## Running it locally

ES modules need to be served over `http://`, not opened directly as a `file://` path (the browser blocks module imports over `file://`). Pick one:

```bash
# Option A — Node (no install needed beyond npx)
npx serve .

# Option B — Python
python3 -m http.server 8000
```

Then open the printed `localhost` URL in Chrome or Edge.

## Feature checklist (against the original brief)

| # | Requirement | Where it lives |
|---|---|---|
| 1 | Full ribbon, default tool = **Select** | `index.html` ribbon + `js/main.js` (`toolManager.setActive('select')`) |
| 2 | Zoom +/− **and** a directly-editable % field (real Paint doesn't allow typing in it — this one does) | `js/canvas/ViewportManager.js` |
| 3 | Drag the right/bottom/corner edge to extend the canvas, preserving existing pixels | `js/canvas/CanvasResizer.js` + `CanvasManager.resize()` |
| 4 | Status bar: pointer position, selection size, canvas size, zoom | `js/ui/StatusBar.js` |
| 5 | Light, dependency-free, fast | No external runtime deps; SVG icons are inline, not image requests |
| 6 | Paste at full native resolution (canvas auto-expands to fit); Ctrl+C copies the real selection to the **OS clipboard** as an actual image | `js/clipboard/ClipboardManager.js` |
| 7 | Ribbon has shapes + palette; new **Color Inspector** bar under the ribbon shows the eyedropper's RGB and hex, each with a copy button | `js/ui/ColorInspector.js`, `#color-inspector` in `index.html` |
| 8 | Modular file layout (below) | — |
| 9 | Asked before building — see prior turn | — |
| 10 | Researched the Clipboard Image API before building (it's Baseline 2024, so no hacks needed) | — |

Also included, since they're core to Paint even though they weren't explicitly on the list: **undo/redo** (Ctrl+Z/Y, 50-step history), **crop to selection**, an explicit **Resize canvas** dialog (with aspect-ratio lock), and tool keyboard shortcuts.

## Architecture

```
omerpaint/
├── index.html              Ribbon markup, color inspector bar, canvas stage, status bar
├── css/styles.css          Fluent/Win10 visual language (one file, CSS variables for the palette)
└── js/
    ├── main.js              Composition root — wires every module together, owns selection
    │                        state, file New/Open/Save, the resize dialog, keyboard shortcuts
    ├── canvas/
    │   ├── CanvasManager.js  The real pixel surface: resize, paste-at-full-size, crop, undo restore
    │   ├── ViewportManager.js  Zoom %, slider, numeric input, Ctrl+Scroll
    │   └── CanvasResizer.js  Drag-to-extend handles (right / bottom / corner)
    ├── tools/                One file per tool family, all implementing {onDown, onMove, onUp}
    ├── ui/                   Toolbar, ColorPalette, ColorInspector, StatusBar — all DOM-facing
    ├── clipboard/            ClipboardManager.js — the real OS clipboard image read/write
    ├── history/              HistoryManager.js — snapshot-based undo/redo
    └── utils/color.js        rgb⇄hex helpers, default palette
```

Each tool is a small object with `{name, cursor, onDown, onMove, onUp}` registered into `ToolManager`, which translates raw mouse events into true image-pixel coordinates (zoom already divided out) before handing them to whichever tool is active. That's the seam where an "AI tool" button would slot in later — it would just be another tool, or a ribbon button that hands the current selection's pixels to a model and draws the result back with `canvasManager.drawImageAtFullSize()`.

## Keyboard shortcuts

| Key | Action |
|---|---|
| `Ctrl+Z` / `Ctrl+Y` / `Ctrl+Shift+Z` | Undo / Redo |
| `Ctrl+C` / `Ctrl+X` / `Ctrl+V` | Copy / Cut / Paste (real OS clipboard, full resolution) |
| `Ctrl+S` / `Ctrl+O` / `Ctrl+N` | Save / Open / New |
| `S P B F E T K Z` | Select / Pencil / Brush / Fill / Eraser / Text / Eyedropper / Zoom |
| `Ctrl+Scroll` over canvas | Zoom in/out |
| `Esc` (while typing text) | Cancel the text box without committing |

## Known limitations / good v2 candidates

These were deliberately cut to ship a solid v1 rather than a half-built everything:

- Selection is rectangular only (no free-form/lasso select).
- No image rotate/flip.
- No transparent-selection mode (moving a selection always leaves a background-colored hole, matching Paint's default "opaque" behavior — Paint also has a "transparent" toggle we haven't added).
- Text tool uses a fixed font/size; no font picker yet.
- "Save" always writes PNG. No Save As / format picker (BMP, JPEG).
- Brush is a single round shape; Paint has several brush shapes (calligraphy, airbrush, etc.).
- Firefox/Safari aren't targeted — clipboard image read/write and the File System Access save will behave differently or fall back to download there.

## Browser support note

Per your choice, this targets **Chrome/Edge**. The two browser-specific APIs in use:
- **Async Clipboard API** (`navigator.clipboard.write/read` with `ClipboardItem`) — Baseline 2024, works in current Chrome, Edge, Firefox, and Safari.
- **File System Access API** (`window.showSaveFilePicker`) — Chrome/Edge only. `save()` checks for it and silently falls back to a plain PNG download everywhere else, so the app still works (just without "save back to the same file") in other browsers.

## Putting this in your own repo

```bash
cd omerpaint
git init
git add .
git commit -m "Initial commit: omerpaint v1"
git remote add origin <your-repo-url>
git push -u origin main
```
