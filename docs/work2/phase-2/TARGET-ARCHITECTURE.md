# Target Architecture

## Principles

- `main.js` remains the composition root while feature behavior moves behind
  small controllers; no second framework is introduced.
- Logic, persisted data, and UI rendering stay separate.
- Canvas pixels remain the saved/exported raster SSOT, but editable text gets a
  durable object representation before being flattened.
- Settings keys, storage keys, event names, defaults, and migration versions
  each have one owner.
- Every long-lived listener has a teardown path.

## Proposed boundaries

```text
js/
  core/                 EventBus, constants, lifecycle helpers
  document/             PaintDocument, object/layer model, compositor
  features/             keyboard, file actions, resize, export, drag/drop
  history/              session history + persistent history + codecs
  settings/             SettingsStore, registry, migrations
  storage/              IndexedDB adapters, quota, recovery
  tools/                existing tool contracts; no DOM reach-through
  ui/                   Ribbon, HistoryPanel, SettingsDialog, TextEditor
  utils/                pure color, transform, validation helpers
```

## Core contracts

```js
/** @typedef {{ x:number, y:number, w:number, h:number }} Region */
/** @typedef {{ r:number, g:number, b:number, a:number }} Rgba */
/** @typedef {{ id:string, text:string, x:number, y:number, width:number,
 *   height:number, fontSize:number, fontFamily:string, color:Rgba,
 *   styles:string[], zIndex:number, revision:number }} TextObject */
/** @typedef {{ id:string, kind:'history'|'session'|'current',
 *   full:Blob|undefined, thumb:Blob|undefined, width:number, height:number }} HistoryEntry */
```

## EventBus example

```js
const EVENTS = Object.freeze({
  canvasChanged: 'paint:changed',
  storageError: 'paint:storage-error',
  toolChanged: 'paint:tool-change',
  settingsChanged: 'paint:settings-change',
});

bus.on(EVENTS.canvasChanged, onCanvasChanged);
// teardown is explicit and testable
bus.destroy();
```

## Text composition rule

Do not implement text editing by only remembering coordinates after the text
has become a single raster. The planned `TextDocumentStore` keeps text objects,
style runs, z-order, and a render/hit-test representation. Raster paint that
overlaps text must be represented as an ordered cover/layer or an equivalent
occlusion mask, so right-click editing remains correct after partial overlap.

## Future document/session boundary

`PaintDocument` should own canvas pixels, selection, text objects, undo/redo,
dirty state, and document metadata. `SessionService` should own the map of
document IDs, tab order, panes, recovery, and inactive-document memory policy.
This is the seam required for Phase 1's deferred tabs/split work.

