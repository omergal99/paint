### H. UI & CSS — 6.5/10

**Good:** design tokens in `:root` with a full dark-mode override (`styles.css:3-34`); flex/grid layout with min/max constraints; `.rbtn` component reused everywhere; `progressive.css` handles responsive degradation separately.

**Bad:**
1. **`styles.css` is 2,344 lines** covering ribbon + canvas + dialogs + settings + sidebar + color inspector in one file. **Fix:** split by component with `@layer` for cascade order: `tokens.css, ribbon.css, canvas.css, sidebar.css, dialog.css, settings.css`. Mechanical, zero-risk if done as pure cut/paste. **Impact:** M · **Effort:** M.
2. **Ribbon horizontal overflow is keyboard-invisible** — `overflow-x:auto` + `scrollbar-width:none` + `::-webkit-scrollbar{display:none}` (`styles.css:66-77`): narrow screens get a scrollable ribbon users can't discover or wheel-scroll. **Fix:** on narrow widths show an edge-fade gradient or collapse into the existing overflow `…` menu. **Impact:** M (UX + a11y) · **Effort:** S.
3. **No focus-visible system** — many controls rely on `title` tooltips; the dialog has no focus trap or restore. See K.
4. **`user-scalable=no`** (`index.html:6`) — defensible for a canvas app (stops pinch-zoom fighting gestures) but caps the a11y score for low-vision users. Decide deliberately and document the trade-off. **Impact:** S · **Effort:** S (a decision, not code).

### I. SEO / PWA / Lighthouse readiness — 6/10

**Good:** canonical, OG, Twitter card, JSON-LD `WebApplication`, `robots.txt`, `sitemap.xml`, verification meta — present and mutually consistent (`index.html:8-63`). `og:image` → `css/assets/preview.png` **exists (97 KB)** ✓.

**Bad (each is a concrete Lighthouse point loss):**
1. **PWA installability fails today**: `manifest.json:11-18` declares a single SVG icon. Chrome/Lighthouse require **192×192 and 512×512 PNG** (maskable recommended). Your `icon.svg` is 875 bytes — a 5-minute export fixes a whole category. **Impact:** High · **Effort:** S.
2. **`sw.js` install is all-or-nothing**: `cache.addAll(SHELL)` with ~40 URLs (`sw.js:45-47`) — one 404 and offline support *silently never installs*. The SHELL list is also a manual SSOT (every new module must be remembered).
   ```js
   self.addEventListener('install', (event) => {
     event.waitUntil((async () => {
       const cache = await caches.open(CACHE_NAME);
       await Promise.allSettled(SHELL.map((url) => cache.add(url))); // never fails wholesale
       await self.skipWaiting();
     })());
   });
   ```
   Long-term: generate the asset list at build time (`glob js/**/*.js`) so it can't drift. **Impact:** M–H · **Effort:** S.
3. **Network-first SW** (`sw.js:55-66`) re-fetches everything on reload — fine for freshness; **stale-while-revalidate** for static assets is a free repeat-view win. **Impact:** M · **Effort:** S.
4. **No Lighthouse CI anywhere** (notepad has `.gitlab-ci.yml`; paint has nothing). Until measured, "high score" is a hope — see §9. **Impact:** High · **Effort:** S.

### J. Robustness & edge cases — 5/10

**Good:** storage touches are `try/catch`ed; floating selection committed on `beforeunload`/`pagehide`; paste uses the native event for Safari (`main.js:1824-1832`); drag-drop validates `file.type`; `_pixelsSignature` degrades gracefully when reads are blocked (`CanvasManager.js:56-71`).

**Bad:**
1. **Quota exceeded = silent data loss.** `saveCanvasState` catches and `console.warn`s (`storage.js:42-45`) while the user keeps drawing believing autosave works. **Fix:** emit `paint:storage-error` → status flash + one-time dialog with "Download now". **Impact:** High (user trust) · **Effort:** S.
2. **Corrupt IndexedDB = dead autosave forever.** `openDatabase` has no recovery (`storage.js:5-16`). **Fix:** on open error, offer "Reset local storage" (delete DB, reopen) — ~20 lines. **Impact:** M · **Effort:** S.
3. **SW atomic-install failure** (I-2): a user who once got a broken install keeps it until the cache name bumps.
4. **History render race** — `Sidebar.init` has `_initPromise` guards (`Sidebar.js:44-56`) but `refreshHistory()` can still interleave with tab switches (`Sidebar.js:681-689`); the `_loadHistoryWithRetry` loop hints at a real past race. After the HistoryPanel split, make each view single-flight. **Impact:** M · **Effort:** S.

### K. Accessibility — 4/10

1. History tiles are clickable `<img>` + `<div>` (`Sidebar.js:762-803`) — not keyboard reachable as a unit. **Fix:** tile = `<button class="history-item" aria-label="…">` with an actions row. **Impact:** M · **Effort:** M.
2. Ribbon drag handle `⠿` (`index.html:71`) is mouse-only. **Fix:** arrow-key nudge when focused, or demote to a settings toggle. **Impact:** M · **Effort:** S–M.
3. `DialogService.js` — native `<dialog>` gives some focus handling for free, but add focus restore to the previously-focused element on close. **Impact:** M · **Effort:** S.
4. **Wins to keep:** `aria-label`s on all selection handles (`index.html:728-743`), `aria-expanded` on the inspector toggle, semantic `<header>/<main>`, visible `:focus-visible` states exist in places.

### L. Expandability & onboarding — 5/10

**Good:** `AGENTS.md` + `.skills/` is a real onboarding contract; `CONTRIBUTING.md`, `SECURITY.md`, PR template exist — rare for a small app.
**Bad:** adding one tool = read `main.js` to learn the `toolContext` bag; adding one setting = touch ~5 places (`main.js` registry, `index.html`, `saveSettings`, `syncHistoryControls`, maybe Sidebar).
**Fix:** after the §3.2 refactor, define two extension APIs:
```js
// registering a tool — one file, no main.js edit
toolManager.register(createMarkerTool({ canvasManager, history, bus }));
// registering a persisted setting — one entry drives dialog + sync + persistence
SettingsStore.define({
  key: 'grid.show', default: false,
  ui: { control: 'checkbox', label: 'Show grid', section: 'Canvas' },
});
```
**Impact:** High for your "expand in the future" goal · **Effort:** M (after §D).

---

## 6. Prioritized improvement backlog

Impact: 🔴 critical · 🟠 high · 🟡 medium · ⚪ low. Effort: S < half day · M = 1–3 days · L = a week+.

| # | Priority | Improvement | Area | Impact | Effort | Why (one line) |
|---|----------|-------------|------|--------|--------|----------------|
| 1 | P0 | Fix the 2 failing tests + make `npm test` a hard gate in CI | G | 🔴 | S | A red gate means every other guarantee on this page is unchecked |
| 2 | P0 | History → Blobs, byte-capped; kill re-encode in `getSessionEntries` | C | 🔴 | M | Prevents OOM crash = your explicit "must not crash" requirement |
| 3 | P0 | PWA icons 192/512 PNG + `Promise.allSettled` SW install + Lighthouse CI budgets | I | 🟠 | S–M | Everything else is pointless if the domain launch scores poorly |
| 4 | P0 | rAF-coalesce pointer path + cached rect | A | 🟠 | S | Cheapest measurable INP/FPS win |
| 5 | P1 | Extract `SettingsStore` (SSOT for settings + keys) | E | 🟠 | M | Kills the 4-way settings duplication and the mirrored-control bug class |
| 6 | P1 | Ribbon `data-action` delegation + EventBus with typed names | B | 🟠 | M | 176 listeners → ~40; leaks become impossible |
| 7 | P1 | Split `main.js` into `features/*` (keyboard, fileMenu, resize, export, dragDrop) | D | 🟠 | L | Unblocks every future feature; makes grep-tests replaceable by real tests |
| 8 | P1 | Split `Sidebar.js` → HistoryPanel / AiPanel / SettingsDialog; public `restore()` API | D | 🟠 | M | Second god object; also removes `_restore` privacy violation |
| 9 | P1 | `jsconfig` + `checkJs` + typedefs for the 5 core contracts | F | 🟠 | M | Type-shaped bugs (phantom selection) get caught at edit time |
| 10 | P1 | Behavioural test pack: history, tool gestures, storage, DOM smoke via happy-dom | G | 🟠 | M | Real coverage of the code that exists, not of its source text |
| 11 | P1 | Quota-exceeded + corrupt-IDB recovery UX; import size clamp 4096px | J | 🟠 | S | "No data loss" promise, currently enforced by luck |
| 12 | P2 | Split `styles.css` by component + `@layer` | H | 🟡 | M | 2,344 lines → 6 files a new dev can navigate |
| 13 | P2 | A11y pass: history tile buttons, dialog focus restore, ribbon keyboard overflow | K | 🟡 | M | Lighthouse a11y + real users on keyboards/screen readers |
| 14 | P2 | Telemetry visible-state pause + `destroy()` | A | 🟡 | S | Battery + honest FPS numbers |
| 15 | P2 | Stale-while-revalidate for static assets; build-time SW asset list | I | 🟡 | S | Repeat-view speed, no more manual SHELL |
| 16 | P2 | Tool/setting registration APIs | L | 🟡 | M | "Expandable" becomes a property, not an intention |

## 7. Suggested execution order (4 phases)

```mermaid
gantt
  dateFormat YYYY-MM-DD
  axisFormat %b %d
  section P0 — stabilize (week 1)
  Fix red tests + CI gate (1)            :p0a, 2026-09-21, 1d
  History Blobs + byte cap (2)           :p0b, 2026-09-21, 2d
  rAF pointer path (4)                   :p0c, after p0b, 1d
  PWA icons + SW + LHCI (3)              :p0d, after p0c, 2d
  section P1 — structure (weeks 2-3)
  SettingsStore (5)                      :p1a, after p0d, 2d
  Ribbon delegation + EventBus (6)       :p1b, after p1a, 2d
  Split main.js (7)                      :p1c, after p1b, 4d
  Split Sidebar + tests pack (8,10)      :p1d, after p1c, 3d
  jsconfig + typedefs (9)                :p1e, after p1d, 2d
  Robustness UX (11)                     :p1f, after p1e, 1d
  section P2 — polish (week 4)
  CSS split (12) · a11y (13) · telemetry (14) · SW v2 (15) · APIs (16) :p2, after p1f, 5d
```

Rule of thumb applied: **crash-safety before speed, speed before beauty, beauty before convenience-APIs.**

<!-- CHUNK-4B -->

