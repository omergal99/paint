# Functional JavaScript Migration

## Rule for future work

New modules use pure functions or closure factories. State stays private and
the returned API is small; a class is not added just to group methods. Existing
classes migrate at dependency seams with contract tests before their callers
change. Named standalone functions use `const name = (...) => {}` (including
exports); class methods remain methods until the class boundary is migrated.

## Completed in this pass

- `core/EventBus.js` → `createEventBus`
- `ui/SegmentedChoice.js` → `createSegmentedChoice`
- `ui/ColorPalette.js` → `createColorPalette`
- `ui/ColorInspector.js` → `createColorInspector`
- `ui/StatusBar.js` → `createStatusBar`
- `tools/ZoomTool.js` → `createZoomTool`
- `tools/FillTool.js` → `createFillTool`
- `tools/EyedropperTool.js` → `createEyedropperTool`
- `tools/FreehandTools.js` internal base → closure factory
- `tools/SelectTool.js` → `createSelectTool`
- `tools/ShapeTool.js` → `createShapeTool`
- `document/TextDocumentStore.js` and `storage/MemoryBudget.js` were added as
  functional modules from the start.
- All standalone named function declarations in `js/`, `tests/`, and
  `scripts/` were converted to arrow constants. This is a syntax/style
  migration only; class owners remain unchanged and are still listed below.

## Remaining class owners

`CanvasManager`, `ViewportManager`, `CanvasResizer`, `HistoryManager`,
`GlobalHistory`, `ClipboardManager`, `ToolManager`, `Toolbar`, `Sidebar`, and
`PanelLayoutManager` still expose established
instance contracts. They are the next migration seams, ordered by risk:

1. pure/tool controllers (`ToolManager`, `SelectTool`, `ShapeTool`),
2. UI controllers (`Toolbar`, `PanelLayoutManager`),
3. history/storage (`HistoryManager`, `GlobalHistory`, `ClipboardManager`),
4. canvas state (`CanvasManager`, `ViewportManager`, `CanvasResizer`),
5. the large `Sidebar` composition boundary.

Do not convert these in one broad rewrite. Each conversion needs behavior tests,
browser smoke coverage, and a reversible adapter if another feature still
depends on `new Constructor()`.
