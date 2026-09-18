### D. Structure & modularity — 5.5/10

**Good:** the `canvas/ tools/ history/ ui/ settings/ utils/` split is right; the small modules (`ToolManager` 79, `ViewportManager` 137, `DialogService` 64, `storage.js` 78) are models of what the rest should look like.

**Bad:**
1. `main.js` (1,867) = composition root + keyboard manager + file menu + resize dialog + settings store + export pipeline + release notes + drag-drop. Its *own* section headers (`// ---------- History preferences + export helpers ----------`, main.js:1013) admit it.
2. `Sidebar.js` (827) is three features in one class: History grid (IndexedDB), Session grid, AI chat + connection store, ribbon/group settings. It also calls `historyManager._restore(entry)` directly (`Sidebar.js:778`) — reaching into a private method of another module.
3. `Toolbar.js` reads buttons via `document.getElementById` inside a UI class (`Toolbar.js:355-370`) instead of receiving them — untestable outside a full DOM.
   **Fix:** see target graph §3.2. Extract in this order: `SettingsStore` → `HistoryPanel` → `AiPanel` → `keyboard.js` → `fileMenu.js`. Delete `_`-private access; expose `historyManager.restore(entry)` as a public API.
   **Impact:** High (all future velocity) · **Effort:** L (but split into 5 safe M-sized PRs).

### E. Clean code / SSOT / DRY — 5/10

Your `.skills/coding.md` says: "defaults, labels, storage keys, and command definitions belong in one place." Reality:

| Key | Defined in |
|-----|-----------|
| `omerpaint:last-canvas` | `CanvasManager.js:8` |
| `paint:session-backup` | `HistoryManager.js:7` |
| `omerpaint:settings` | `main.js:882` |
| `paint:zoom` / `paint:initial-zoom` | `ViewportManager.js:19-20` |
| `paint:selected-shape` / `paint:shape-select-after-draw` / `paint:tool-styles` / `paint:style-history` / `paint:show-current-tool` | `Toolbar.js:4-7,49` |
| app version | `package.json` 1.5.0 vs `sw.js:1` `paint-shell-v1-6-3` (sync script exists: `scripts/sync-version.mjs` — verify it runs on release) |

**Settings logic is quadruplicated:** `saveSettings()` (main.js:978-1011), `readSettings()` (974-976), `getHistoryPrefs()` (1014-1020), `syncHistoryControls()` (1040-1054) each re-implement the same defaults (`historyAutoSave !== false`, mode `'lifecycle'`). One bad merge and two UI mirrors disagree.
**Fix:** `settings/SettingsStore.js` — one `get(key)`, one `set(patch)` (persist + emit), defaults declared once. `getHistoryPrefs()` becomes `settings.get('historyAutoSave')`.
**Impact:** High (bug prevention, not style) · **Effort:** M.

### F. TypeScript readiness — 2/10

No `tsconfig.json`/`jsconfig.json`, no `// @ts-check`, types exist only in some JSDoc comments. The app's hardest bugs were type-shaped: the "phantom selection" bug (smoke.test.js:432-440 documents it), `floatingCanvas` lifecycle, `_pendingToolRestore`. Types would have flagged each one.
**Fix — three steps, no rewrite:**
1. `jsconfig.json` with `"checkJs": true, "strict": false` in the IDE — instant editor feedback, zero runtime change.
2. `js/types.d.ts` + JSDoc on the 5 core contracts:
   ```js
   /** @typedef {{x: number, y: number, button: number}} Pt */
   /** @typedef {{x: number, y: number, w: number, h: number}} Region */
   /** @typedef {{name: string, cursor?: string, onDown?, onMove?, onUp?, onActivate?, onDeactivate?}} Tool */
   /** @typedef {{blob: Blob, width: number, height: number}} HistoryEntry */
   /** @typedef {{canvasManager: CanvasManager, historyManager: HistoryManager, setSelection: (r: Region|null) => void, getSelection: () => Region|null, …}} ToolContext */
   ```
3. Gradually add `"strict": true`. Migrate leaf-pure modules (`utils/color.js`, `utils/transform.js`) to `.ts` first if you ever adopt a build step.
**Impact:** High (kills an entire bug class before the AI/plugin features grow) · **Effort:** M (1 day for step 1+2 across ~30 files of headers).

### G. Tests & coverage — 3/10

**Current state: 41 tests, 39 pass, 2 fail (`npm test` today).**

- `tests/shape-layer.test.js` — the **good one**: drives real `CanvasManager`/`ShapeTool` code against a fake 2D context, tests behaviour (clipped-ink re-measure, OOM bound, click fallback). Keep and extend this style.
- `tests/smoke.test.js` (~23 KB) — mostly **regex-over-source-text** assertions:
  ```js
  assert.match(main, /beforeunload'[\s\S]{0,400}?commitFloatingSelection\(\)/);   // tests:404-441
  assert.match(css, /height:\s*min\(560px,\s*88vh\)/);                            // ← this one is FAILING right now
  ```
  These tests break when you reformat or rename — not when behaviour breaks — and they give **zero behavioural coverage** of drawing, undo, or save.
- **Missing entirely:** HistoryManager tests (undo/redo/byte-cap/quota), ToolManager gesture tests (pending-restore, no phantom drag), storage.js tests, any DOM test, any e2e, coverage measurement, CI for paint (`.gitlab-ci.yml` exists in `notepad/`, **nothing for `paint/`**).

**Fix:**
1. Make the suite green (exact fixes in §10).
2. Port each grep-test to a behavioural test of the extracted module (possible only after §D refactor — another reason to do it).
3. Add `tests/history.test.js`, `tests/toolmanager.test.js`, `tests/storage.test.js` (fake `indexedDB`), `tests/app.dom.test.js` (happy-dom/jsdom) for Ribbon delegation.
4. Add coverage: `node --test --experimental-test-coverage` (zero new deps) and a target: **≥70% lines on `js/canvas`, `js/tools`, `js/history`, `js/clipboard`**.
5. Add CI (GitHub Actions) running `node --check` on all JS + `npm test` + Lighthouse CI (§9).
**Impact:** High · **Effort:** M, and it must come *after* the §D split or you'll test the god file's strings again.

<!-- CHUNK-3D -->
