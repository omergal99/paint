# paint — Architecture Guide

`paint` is a browser-based drawing app styled after Windows 10 Paint. It is built
with **plain JavaScript (ES modules)** — no framework, no build step — and targets
Chrome/Edge.

---

## 1. Directory layout

```
paint/
├── index.html                 # Single page: Fluent ribbon, status bar, canvas stage
├── css/
│   ├── styles.css             # Design system + component styles (ribbon, canvas area, dialogs)
│   └── progressive.css        # Progressive/mobile enhancement layer (safe-area, touch, dark-mode fixes)
│   └── assets/                # icon.svg, preview.png, screenshot.png
├── js/
│   ├── app.js                 # Entry point: autosave, telemetry, SW registration, legacy-session restore
│   ├── main.js                # Composition root — wires every manager/tool (the only big file)
│   ├── storage.js             # IndexedDB autosave (blob of the last canvas)
│   ├── telemetry.js           # LCP/CLS/INP/FPS performance metrics
│   ├── version.js             # APP_VERSION singleton
│   ├── canvas/                # Core canvas area
│   │   ├── CanvasManager.js   # Two stacked canvases + floating selection
│   │   ├── ViewportManager.js # Zoom + scroll-geometry (outer/inner box model)
│   │   └── CanvasResizer.js   # Drag-to-extend handles
│   ├── tools/                 # One module per drawing tool
│   │   ├── ToolManager.js     # Pointer-event translation + coordinate scaling
│   │   ├── FreehandTools.js   # Pencil / Brush / Eraser
│   │   ├── ShapeTool.js       # Line, Arrow, Rectangle, Rounded rect, Ellipse, Triangle (+ fill modes)
│   │   ├── SelectTool.js      # Marquee selection
│   │   ├── FillTool.js        # Bucket fill
│   │   ├── TextTool.js        # Text insertion
│   │   ├── EyedropperTool.js  # Color picker
│   │   └── ZoomTool.js        # Magnifier tool
│   ├── ui/                    # Non-canvas UI components
│   │   ├── Toolbar.js         # Ribbon buttons: tools, shapes, fill modes, file/undo actions
│   │   ├── Sidebar.js         # Right sidebar: history + AI chat + group settings
│   │   ├── PanelLayoutManager.js # Reusable dock/float/hide panel layout state
│   │   ├── SegmentedChoice.js # Reusable quick-choice buttons backed by a select
│   │   ├── StatusBar.js       # Pointer / selection / canvas-size / zoom footer
│   │   ├── ColorPalette.js    # Swatches + custom color input
│   │   └── ColorInspector.js  # Hex/RGB readout + copy actions
│   ├── settings/
│   │   └── SettingsRegistry.js # Central reset contract for persisted preferences
│   ├── utils/
│   │   ├── color.js           # hex→rgb conversions
│   │   └── transform.js       # rotate/flip/scale/remove-background helpers
│   ├── clipboard/ClipboardManager.js  # OS clipboard bridge (copy/cut/paste)
│   └── history/HistoryManager.js      # Snapshot-based undo/redo (≤50 steps)
├── docs/
│   ├── ai-integration/        # Provider-neutral AI connection/editing plan
│   ├── ARCHITECTURE.md        # This file
│   ├── future_ideas.md        # Long-running wishlist (features requested over time)
│   ├── future_ideas2.md       # Second-wave ideas (PWA, mobile, selection, etc.)
│   └── NEXT_STEPS_PLAN.md     # Prioritized roadmap (effort × impact)
├── tests/smoke.test.js        # Node smoke tests (run: `npm test`)
├── sw.js                      # Service worker shell cache
├── manifest.json              # PWA manifest
└── package.json
```

---

## 2. Data flow

```
index.html  ──►  js/app.js  ──►  js/main.js (composition root)
                                        │
                    ┌───────────────────┼────────────────────┐
                    ▼                   ▼                    ▼
            CanvasManager         ViewportManager      HistoryManager
            (pixels, selection)   (zoom + scrolling)   (undo/redo)
                    ▲                   │                    │
                    │                   ▼                    │
            js/tools/* ─────────► ToolManager ──────────────┘
            (tool logic)          (pointer → canvas coords)
```

- All drawing happens in **true image-pixel coordinates**. Zoom is purely a
  *view* concern (CSS transform), never a pixel-space mutation.
- `ToolManager` converts each pointer event through
  `ViewportManager.clientToImage()` so every tool receives `{x, y, button}`
  in image pixels regardless of zoom.

---

## 3. Canvas stage model (important)

The viewport hosts **two nested boxes** so that scrollbars always match the
visible canvas at any zoom:

```
.canvas-viewport      ← scroll container (#canvas-viewport, overflow:auto)
└── .canvas-stage     ← OUTER box;   width/height = canvasSize × zoom  (set by ViewportManager.syncStageSize)
    └── .canvas-scale ← INNER box;   width/height = canvasSize (image px) (set by CanvasResizer.reposition)
        ├── #paint-canvas
        ├── #overlay-canvas
        ├── resize handles (.resize-handle*)
        ├── selection handles ([data-selection-handle])
        └── .resize-ghost
```

- The zoom `scale()` transform lives on **`.canvas-scale`** (transform-origin:
  top-left). Handles and selection rectangles are positioned in image pixels
  inside this box, so they stay glued to the canvas at every zoom level.
- The outer **`.canvas-stage`** is sized to the *scaled* canvas (e.g. 800×600 at
  100%, 400×300 at 50%, 1600×1200 at 200%). Because it defines the scrollable
  extent, the browser shows **no scrollbars / no dead gray space below 100%**,
  and full panning room above 100% — exactly proportional to the view.

### Scroll & zoom behavior

| Input                          | Behavior                                                        |
|--------------------------------|-----------------------------------------------------------------|
| Plain wheel / scroll           | Native viewport scroll (pan). **Never** changes zoom.           |
| `Ctrl`/`Cmd` + wheel           | Zoom in/out in 10% steps (like Windows Paint).                  |
| Zoom `+` / `−` / slider / % box| Instant zoom; persisted to `localStorage` (`paint:zoom`).        |
| Canvas resize drag + wheel     | The handles own the wheel (grow/shrink sizing); viewport scroll  |
---

## 4. CanvasManager responsibilities

- Owns the **real** canvas (`paint-canvas`) and the **overlay** canvas
  (`overlay-canvas`). Shapes previews, selection marquees and text carets are
  drawn on the overlay and never touch real pixels until committed.
- Manages the **floating selection** (`floatingCanvas`) for move/copy behavior.
- `persistToStorage()` saves the canvas as a PNG data URL under
  `omerpaint:last-canvas` (legacy autosave), while `js/storage.js` keeps a
  richer IndexedDB copy for `app.js`.

---

## 5. Settings reset contract

`js/settings/SettingsRegistry.js` owns the list of local-storage preference
keys and reset handlers. The About tab uses it for **Reset Settings**. Resetting
preferences preserves the current canvas and saved history entries; **Clear
Data** remains the separate destructive action.

When adding a persisted preference, register its storage key with the registry.
When a feature stores settings outside localStorage, register an async reset
handler as well. This keeps the UI independent from feature storage details:

```js
settingsRegistry.registerStorageKey('paint:my-feature');
settingsRegistry.registerResetHandler(() => myFeature.resetSettings());
```

---

## 6. Tools contract

Every tool in `js/tools/` implements the same interface:

```js
{
  name: 'pencil',          // unique id used by ribbons/keyboard
  cursor: 'crosshair',     // CSS cursor on the overlay
  onActivate?(ctx),        // optional setup
  onDeactivate?(ctx),      // optional teardown
  onDown(pt, ctx, e),      // pointerdown
  onMove(pt, ctx, e),      // pointermove
  onUp(pt, ctx, e),        // pointerup
}
```

`ctx` is a small bag of collaborators (`canvasManager`, `historyManager`, plus
`getShapeKind()` / `getShapeFillMode()` accessors provided by `Toolbar`).

**Adding a new shape** (e.g. `arrow`):

1. Add a ribbon button with `data-shape="arrow"` in `index.html`.
2. `Toolbar` picks it up automatically (`_bindShapes`).
3. Implement rendering in `ShapeTool._draw` (or a dedicated helper like
   `drawArrowPath()`).

---

## 7. Styling conventions

- Theme tokens (`--w10-*`) are defined in `css/styles.css` under `:root` and
  `body.dark-mode`; components consume tokens only.
- Ribbon icons are inline SVGs using `fill="currentColor"` /
  `stroke="currentColor"`. The four primary tools use authentic **Microsoft
  Fluent System Icons** paths (MIT licensed) so they inherit the theme color and
  the active-state accent automatically. Avoid hard-coded `fill="#000"`.
- `css/progressive.css` holds the small mobile/touch/accessibility layer and is
  loaded after `styles.css`.

---

## 8. Testing & validation

```bash
npm test                 # node --test tests/**/*.test.js  (no browser needed)
```

Smoke tests are string/behavioral assertions over the source files (ribbon
markup, module wiring, SW cache entries). For real browser checks the app can be
served locally:

```bash
python3 -m http.server 8000   # then open http://localhost:8000
```
|                                | is temporarily locked via `.prevent-scroll`.                    |
