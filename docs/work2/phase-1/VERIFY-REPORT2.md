# Paint - Verification Report (Rounds 2–4)

**Date:** 2026-09-18 · **Scope:** P0 quick wins + P1 history/storage (#1–#6, #8) + select-after-draw layer · **#7 tabs/split:** planned, not started (agreed last) · **Round 4 (select-after-draw):** ✅ fixed & verified, see §7

> Round 1 report lives in git history (`docs/w2/VERIFY-REPORT.md` in staged tree). This is the re-verification after task resumption.

## 1. Build status: GOOD ✅

| Check | Result | Evidence |
|---|---|---|
| `npm test` (node --test) | **41/41 pass, 0 fail, EXIT:0** | `/tmp/final4.log` → `# pass 41 / # fail 0`, `1..41` (round 4: +7 behavioural tests) |
| `node --check` × 13 touched files | **all pass, no SYNTAX-FAIL** | SliderControl, releaseNotes, GlobalHistory, HistoryManager, main, ShapeTool, SelectTool, Toolbar, Sidebar, CanvasManager, ClipboardManager, SettingsRegistry, sw.js |
| Feature smoke subtest | pass | `P0 quick wins: hover affordance, slider, release notes, fresh paste, undo keys` |
| Working tree | 14 modified + 7 staged new files on `main` | `M css/styles.css, index.html, js/*, sw.js, tests/smoke.test.js` + `A docs/w2/*, js/releaseNotes.js, js/ui/SliderControl.js` |

Note: `node --test tests/` (dir path, no glob) fails with MODULE_NOT_FOUND - pre-existing runner quirk, not a code issue. `npm test` (`node --test tests/**/*.test.js`) is the supported command and passes.

## 2. Feedback loop - re-verified each request against code

| # | Your request | Verdict | What's in the tree |
|---|---|---|---|
| 1 | V moves when drawn; toggle in Shapes More to create → keep selected → move (default OFF) | ✅ done | `drawNormalizedV` re-anchored to drag box; `#shape-select-after-draw` checkbox, `paint:shape-select-after-draw` persisted + registry, default OFF; `getSelectAfterDraw` wired main→ShapeTool lifts floating selection |
| 2 | First paste on clean New → 0,0 (clean = no paint, no image) | ✅ done | `CanvasManager.isCleanDocument()` (48px signature vs blank baseline); `ClipboardManager` ignores stale pointer when clean |
| 3 | Font slider 1–120, reusable component | ✅ done | New `js/ui/SliderControl.js` (`createSliderControl({min,max,value,label,unit,ariaLabel})`); mounted in `#size-slider-row` above boxes, same `applySize()` path |
| 4 | Release Notes tab, 1.5.0 + Unreleased, deep-link ok | ✅ done | `RELEASE NOTES` tab + panel + `js/releaseNotes.js`; `renderReleaseNotes()`; `?dialog=settings&tab=release` via existing dialog-URL logic |
| 5 | `inactive-status` tool-status hover shows clickable | ✅ done | `:hover`/`:focus-visible` bg + border + `cursor:pointer` + recolor + explanatory title |
| 6 | No-change saves skipped; History/Session tabs; responsive 2-col; green/blue/red buttons | ✅ done | Undo signature dedup + `saveDataUrlToHistory` compare; `History\|Session` tabs (`Session` = in-memory undo+current, confirm-restore); grid `repeat(auto-fill,minmax(120px,1fr))`; Save green / Export blue / Clear red + dark mode |
| 8 | Quota display + compressed thumbs (before #6) | ✅ done | About Used + `X free of Y` + bar; IDB v1→v2 (`thumb` webp→jpeg ≤160px + `docId`); `_ensureQuotaRoom()` drops oldest 20% past 90% quota |
| extra | Ctrl+Z / Ctrl+Shift+Z / Ctrl+Y | ✅ done | Global handler in `main.js`, skipped while typing; buttons wired via `historyManager` |
| extra | OOM must not crash app | ✅ done | Quota guard + try/catch fallbacks on save paths |

## 3. Self-review findings this round (no new bugs)

- Re-ran full suite fresh: 33/33 at round 2, **34/34 at round 3**, EXIT:0 - no regressions.
- `node --check` on all 13 touched/new JS files: clean.
- Confirmed `sw.js` precaches both new modules (`SliderControl.js`, `releaseNotes.js`); cache name bumped.
- Confirmed no leftover dummy/scratch files (`/tmp/dummy-noop.txt` removed in round 1).
- One observation (not a bug): reports currently live under `docs/w2/` as staged-new files (moved there by repo layout); round-1 `docs/PLAN-*` references still valid at `docs/w2/PLAN-OVERVIEW.md`, `docs/w2/PLAN-DETAILS.md`, `docs/w2/VERIFY-REPORT.md`.

## 4. Manual QA checklist (~5 min, unchanged)

- [ ] V drag anchors at pointer; toggle ON → movable after draw; OFF → old behavior
- [ ] Blank New → paste at 0,0; after drawing → follows cursor
- [ ] Slider 1–120 syncs with number/boxes/committed text
- [ ] Release Notes shows Unreleased + 1.5.0; deep-link opens it
- [ ] Dim tool-status button highlights on hover
- [ ] History/Session tabs switch; Session restores mid-stroke; no dup saves; colored buttons
- [ ] About shows Used + Free + bar
- [ ] Ctrl+Z / Ctrl+Shift+Z / Ctrl+Y work on canvas

## 5. Round 3 - post-review fixes (your 2nd review)

Round 2 was reported green, but two items were **not actually in the tree**. Both are fixed now, and I stopped trusting the summary tests and validated the real shipped functions instead.

### 5.1 Bugs found & fixed

| # | Bug | Root cause | Fix |
|---|---|---|---|
| A | **V icon off-centre + arms skew while drawing** | Icon path was authored on a **24×24** grid (`M 5 12 L 10 17 L 19 6`) but the gallery uses `viewBox="0 0 20 20"` → bbox centre (12,11.5) ≠ (10,10), and the round cap at x=19 got clipped. Canvas used `w*0.12…0.88` / `h*0.18…0.74` → **x and y scaled independently**, so the two arm angles changed with the drag aspect | Tile re-authored centred on the 20-grid: `M 3 10.5 L 8 15.5 L 17 4.5`, stroke 1.6 (fits inside 20 incl. caps). Canvas now `V_MARK` + **single scale factor** `k = box.size / max(spanX,spanY)` - arm angles are now constant for every drag |
| B | **Settings dialog still 440px** (regression, test asserted 560px) | Round-2 edit touched a different rule; `.settings-shell` kept `min(440px, 88vh)` | `height`/`max-height` → `min(560px, 88vh)` |
| C | **"0 MB" + 0% bar with data stored** | Usage was **rounded to whole MB** → 0.4 MB rendered as `0 MB` → `usageMB > 0` guard false → bar 0%, breaking your rule "0% only when truly empty" | Usage keeps 2 decimals (`0.40 MB`), quota stays whole-MB + capped 10 000. Bar shows ≥1% for any real usage, 0% only at exactly 0 |

### 5.2 Proof (validated the shipped code, not the summary)

- **V glyph** - drove the real `ShapeTool._draw()` with a mock 2D context over 5 drags (square, wide, tall, reverse, tiny):

  `arm1=45.00° arm2=-50.71°` - **identical for all 5** · glyph stays inside the drag box · valley below & between both tips (it *is* a V) · tile bbox centre = `(10,10)` = viewBox centre · tile fits inside the 20-grid incl. 1.6 stroke. **ALL PASS**
- **Storage math** - extracted and executed the real `updateAboutStats()` with injected stubs:

  | case | Stored data | Free space | Bar |
  |---|---|---|---|
  | empty | `0.00 MB` | `10,000 MB free of 10,000 MB` | `0%` ✅ |
  | 0.4 MB | `0.40 MB` | - | `1%` ✅ |
  | your report (2.87 MB / 10242.87 MB quota) | `2.87 MB` | `9,997 MB free of 10,000 MB` | `1%` ✅ |
  | quota missing | - | `Unavailable` | - |
  | estimate throws | `Unavailable` | `Unavailable` | - |

  **ALL PASS** - no more `10242.87` total, and no more 0% with data
- `npm test` → **34/34, EXIT:0** at end of round 3 (round 4 grows the suite to 41/41); `node --check` clean on `main.js`, `ShapeTool.js`, `tests/smoke.test.js`
- Regression guard added: the smoke test now asserts the centred tile path, `V_MARK`, the uniform-scale `k`, and that the old per-axis maths is gone (the first version of my own comment tripped the negative assertion - fixed by rewording, not by weakening the test)

## 6. Round 3 - your review items, re-verified in code

| Item | Status | Evidence in tree |
|---|---|---|
| V icon centred + constant angle | ✅ fixed | `index.html:479` centred path; `ShapeTool.js:180-204` `V_MARK` + uniform `k` |
| Session survives refresh, dies on tab close | ✅ | `HistoryManager` `SESSION_BACKUP_KEY` + `sessionStorage` (cleared by browser only on tab close), 96px jpeg thumbs |
| Session tab view-aware buttons | ✅ | `Sidebar._syncHistoryActionLabels()` → `Save to Session`/`Export Session`/`Clear Session` vs History labels; per-view clear confirm ("Saved history is kept") |
| Settings dialog taller | ✅ fixed | `.settings-shell` `min(560px, 88vh)` |
| `ribbon-setting-row` less dead space | ✅ | compact 30px rows, `padding: 3px 8px`, `:hover` bg/border |
| Free space math stable & readable | ✅ fixed | whole-MB capped quota → `9,997 MB free of 10,000 MB` |
| Bar ≥1% whenever any usage | ✅ fixed | `Math.max(1, Math.ceil(...))`, 0% only at exactly 0 MB |
| Undo/redo keyboard shortcuts | ✅ | `main.js` global handler: Ctrl/Cmd+Z, Ctrl/Cmd+Shift+Z, Ctrl+Y, skipped while typing |

## 7. Round 4 - select-after-draw: shape-only layer + exact ink bounds ✅

Your two reports:

> "it not catch it all, like we have some sides it draw but not in the selection"

> "the selection also select the whole background behind it! - it should select only the shape drawn without changing or affecting the area … it will make layer and then make it selection and only when selection leave it will paste it to the main layer paint."

That is now exactly how it works.

| # | Symptom | Root cause | Fix |
|---|---|---|---|
| D | Painted pixels fell **outside** their own selection; edges clipped on commit | Selection was set to the **raw drag box**, but the ink is not inside the box: emoji glyphs are wider than their font size (`min(w,h)`), and round caps/joins + stroke width overhang the box | `CanvasManager.renderShapeLayer(bounds, drawFn, pad)` renders the shape on a transparent scratch canvas, measures the **real alpha bounding box** (`_alphaBounds`), and inflates generously (25% / ≥8px / `lineWidth*2`). If the measured ink **touches a scratch edge that is not a canvas edge**, it was cut off → the scratch is doubled and re-measured (≤4 passes, always converges because once clamped to the canvas nothing is "clipped") |
| E | Selection dragged a **background rectangle** over the painting; artwork underneath was affected | The lift copied the rectangular region out of the main canvas (background + whatever was underneath) and painted a background patch into the hole | The shape is drawn **in isolation on transparency** - the main canvas is never read, never erased, never painted during the lift. The floating layer is cropped to the ink box, so it is the shape alone; committing composites it with real alpha, so the artwork behind stays untouched until you leave the selection |

**Lifecycle (matches "only when selection leaves does it paste to the main layer"):** the canvas keeps its pre-lift pixels while the layer floats; commit happens on tool switch (`SelectTool.onDeactivate`), click outside (viewport `pointerdown`, `SelectTool.onDown`), save, resize, `beforeunload`, `pagehide` → `commitFloatingSelection()` → `drawImage(layer, x, y)`. Escape/undo discard the layer instead. Moving a lifted shape never lifts-and-erases again (the `!floatingCanvas` guard), so no hole is cut under your shape.

**Proof** - new `tests/shape-layer.test.js` (6 tests) drives the **shipped** `CanvasManager`/`ShapeTool` code against a fake 2D context:

| Test | Asserts |
|---|---|
| layer is ink, not the drag box | selection = measured ink `{x:83,y:100,w:75,h:58}`; ink spills past the drag box on **all four** sides and is still inside the selection |
| layer holds the ink only | `floatingCanvas` cropped to the ink box inside the scratch; **main canvas `fillRect`/`drawImage` counts unchanged** → no background patch, no background copy |
| clipped ink ⇒ wider re-measure | ink touching the scratch edge triggers a second measurement; `getImageData` called ≥2× |
| border ink is not "clipped" | bounds at the canvas corner → exactly **1** measurement, no pointless retry |
| click / nothing painted | `renderShapeLayer` → `null`, `_liftAsSelection` → `false` → normal bake fallback |
| stroke overhang | scratch inflated by the `pad` (`100×100` + `pad 80` → `260×260`) |

Plus smoke assertions that `snapshot({ force: true })` is used (the canvas is unchanged at lift time, so dedup would otherwise swallow the undo entry) and that unload bakes the floating shape before saving.

**Failure mode:** if measurement is impossible (context blocked, `getImageData` throws, canvas entirely off-screen) the function returns `null` and the shape is **baked normally** - the shape always appears, it just is not selectable. No crash path.

## 8. Next: #7 tabs/split (planned - awaiting your go)

`js/session/` service, TabBar + SplitView, per-doc storage keys, crash recovery, `.skills/` docs.
