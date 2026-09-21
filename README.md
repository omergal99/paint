# Paint Online

A browser-based image editor styled after classic **Windows Paint**. It uses
plain JavaScript ES modules, no framework, and no build step. The app runs
locally in the browser, keeps ordinary editing state on the device, and does
not require an account or API key.

Project status: actively maintained, with a focused vanilla-JavaScript
architecture and browser-native storage/clipboard features. The current
community and security readiness status is tracked in
[`docs/work1/COMMUNITY_STANDARDS.md`](./docs/work1/COMMUNITY_STANDARDS.md).

![omerpaint screenshot](./css/assets/screenshot.png)

## Running it locally

ES modules need to be served over `http://`, not opened directly as a `file://` path (the browser blocks module imports over `file://`). Pick one:

```bash
# Option A - Node (no install needed beyond npx)
npx serve .

# Option B - Python
python3 -m http.server 8000
```

Then open the printed `localhost` URL in Chrome or Edge.

### Install and update

On a supported browser, open **Settings → App** and choose **Install paint**.
On iPhone or iPad, use the browser’s **Share → Add to Home Screen** action.
Published releases run `npm run version:patch` (or the matching version
command), which synchronizes `js/version.js` and the service-worker cache
version. The service worker checks for the new shell and controlled pages
reload once the new worker takes control.

## Contributing and support

- [Contributing guide](./CONTRIBUTING.md)
- [Code of conduct](./docs/CODE_OF_CONDUCT.md)
- [Security policy](./SECURITY.md)
- [Open an issue](https://github.com/omergal99/paint/issues/new)
- [Community standards audit](./docs/work1/COMMUNITY_STANDARDS.md)

The project does not yet declare an open-source license. That is an explicit
maintainer decision still required before presenting the repository as
licensed open source.

## Architecture & How It's Built

The application follows a modular vanilla-JavaScript design, with focused
manager, tool, service, and UI-component modules that use browser-native APIs.
Below is a Mermaid diagram explaining how the components interact:

```mermaid
graph TD
    index[index.html <br> Ribbon UI & HTML structure]
    main[js/main.js <br> Composition root & state coordinator]
    
    index --> main
    
    main --> CanvasManager[js/canvas/CanvasManager.js <br> stacked canvases, real & overlay layers, floating canvas]
    main --> ViewportManager[js/canvas/ViewportManager.js <br> zoom % slider, numeric input, scroll-synced scaling]
    main --> CanvasResizer[js/canvas/CanvasResizer.js <br> drag-to-extend handles]
    main --> ClipboardManager[js/clipboard/ClipboardManager.js <br> OS Clipboard copy/cut/paste]
    main --> HistoryManager[js/history/HistoryManager.js <br> snapshot-based undo/redo stack]
    main --> ToolManager[js/tools/ToolManager.js <br> active tool pointer event translator]
    
    ToolManager --> Tools[js/tools/* <br> Tool family logic]
    Tools --> CanvasManager
```

**Project structure.** See [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) for the full layout. Highlights: all logic lives under `js/` grouped by concern (`canvas/`, `tools/`, `ui/`, `utils/`, `clipboard/`, `history/`), styles live under `css/` (`styles.css` + `css/progressive.css`), and the docs folder tracks the roadmap (`docs/future_ideas*.md`, `docs/NEXT_STEPS_PLAN.md`).

### Module Breakdown
- **index.html**: Defines the Fluent ribbon layout, the Color Inspector bar, the pointer status bars, and the main canvas stage viewport (`.canvas-stage` outer scroll box → `.canvas-scale` inner zoom box).
- **js/main.js**: Wires all the managers and tools together. Coordinates selection outline rendering, global keyboard shortcuts, and file actions (New, Open, Save, Crop, Resize).
- **js/canvas/CanvasManager.js**: Handles the two canvas layers: `paint-canvas` (real image pixels) and `overlay-canvas` (selection marquees, shapes previews, caret). Manages the `floatingCanvas` for uncommitted selections.
- **js/canvas/ViewportManager.js**: Handles zoom logic (buttons, slider, editable %, `Ctrl/Cmd+wheel`). Sizes the outer stage to the *scaled* canvas so scrollbars always match the visible canvas - plain wheel scrolls/panels natively and never changes the zoom.
- **js/canvas/CanvasResizer.js**: Tracks drag events on the bottom-right handles to expand the canvas workspace while preserving existing image contents.
- **js/clipboard/ClipboardManager.js**: Bridges the browser to the OS Clipboard. Supports pasting image blobs directly, copying active selection pixels, and cutting pixels.
- **js/history/HistoryManager.js**: Retains up to 50 snapshots of the canvas for instant undo/redo functionality (`Ctrl+Z` / `Ctrl+Y`).
- **js/tools/ToolManager.js**: Binds to the pointer events and passes scaled coordinate offsets to the active tool.

---

## Core Features

- **Fluent Win10 Ribbon & Layout**: Responsive toolbar controls, shape dropdowns, custom palettes, line size pickers, and status footer.
- **Rich Shape Kit**: Line, **Arrow**, Rectangle, Rounded Rectangle, Ellipse, and Triangle with three fill modes (outline, outline+fill, fill) and a shared size control that also drives the text tool's font size.
- **Professional Icon Set**: Pencil, Brush, Eraser and Color-picker (eyedropper) use Microsoft **Fluent System Icons** that recolor automatically with the active theme / active state.
- **Paint-Style Floating Selection**: 
  - Paste images or drag selected areas to move them.
  - Selections float on the **overlay canvas** without overwriting the background until deselected, committed, or tool switched.
  - Multi-drag support: Dragging and dropping a selection multiple times does not leave white gaps under intermediate positions.
- **Real OS Clipboard Integration**: Supports full-resolution copy/cut/paste directly to and from the OS system clipboard. Pasted images expand the canvas dynamically if they exceed current size.
- **Canvas Resize & Drag-to-Extend**: Drag corner or bottom handles to expand the canvas, or open the **Resize Dialog** with keeping-aspect-ratio option.
- **Crop-to-Selection**: Crop canvas directly to the current bounding box of the active selection marquee.
- **Color Inspector**: Interactive eyedropper tool with a hex/RGB indicator bar that allows copy-to-clipboard actions.
- **50-Step Undo & Redo History**: Complete state history that records image pixels and dimensions on mutated canvas events.
- **Smart Click Deselection**: Clicking anywhere outside the paint area (in the viewport background stage) automatically commits the floating selection and clears selection state.

---

## Keyboard shortcuts

| Key | Action |
|---|---|
| `Ctrl+Z` / `Ctrl+Y` / `Ctrl+Shift+Z` | Undo / Redo |
| `Ctrl+C` / `Ctrl+X` / `Ctrl+V` | Copy / Cut / Paste (real OS clipboard, full resolution) |
| `Ctrl+S` / `Ctrl+O` / `Ctrl+N` | Save / Open / New |
| `S P B F E T K Z H` | Select / Pencil / Brush / Fill / Eraser / Text / Eyedropper / Zoom / Hand-Pan |
| `Ctrl+Scroll` / `Cmd+Scroll` over canvas | Zoom in/out (plain scroll just pans/scrolls the viewport) |
| `Esc` (while typing text) | Cancel the text box without committing |
| `Delete` / `Backspace` | Discard active floating selection or clear marquee selection |

---

## Browser support note

Per design choice, this targets **Chrome/Edge** specifically:
- **Async Clipboard API** (`navigator.clipboard.write/read` with `ClipboardItem`) - Baseline 2024, works in current Chrome, Edge, Firefox, and Safari.
- **File System Access API** (`window.showSaveFilePicker`) - Chrome/Edge only. `save()` checks for it and silently falls back to a plain PNG download everywhere else, so the app still works (just without "save back to the same file") in other browsers.
