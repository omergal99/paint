# Phase 2 — Round 2 Stabilization Status

Date: 2026-09-19  
Round: 2  
Previous status: [`PHASE-2-STATUS.md`](PHASE-2-STATUS.md)

This round closes the quick wins requested before continuing the Steps 09–11
sequence. The HTML version is available at
[`PHASE-2-STATUS_2.html`](PHASE-2-STATUS_2.html).

## Round results

| Area | Status / score | How to experience it | Measurement and evidence | Remaining gap |
|---|---:|---|---|---|
| Compact alpha control | Done · 10/10 for this slice | Open Colors; the checkerboard alpha trigger is a small horizontal 30×16 control beside the 32×32 swatch stack | `npm test`; CSS contract; browser snapshot of the Colors ribbon; no `swatch-alpha-transparent` class remains | Broader import/export and eyedropper alpha fixtures remain in Step 05 |
| Shape Select after draw opacity | Fixed · 9/10 | Set a low alpha, enable Shapes → Select after draw, draw a shape, then place it; opacity is committed once | `commitLayerWithSourceOver()` has a direct fake-context test recording alpha/composite values; shape-layer tests remain green; the existing browser alpha carry-over check passes | Add a direct pixel-ratio browser fixture for the full lift → place path |
| Text commit and tool exit | Done · 9/10 | Choose Text, type, click outside the editor; the editor commits and the current tool becomes Select | Playwright UI flow: `editorCount=0`, `Current tool: Select`; focus targets are listed without rewriting pixels | Full text-object editing is still intentionally deferred |
| Select text after draw | Safe focus slice · 8/10 | Text options → enable Select text after draw, type text, click outside; use the `Focus text: …` target | Playwright shows focus targets after commit; metadata-only `TextSelectionOverlay`; persisted toggle is always reversible | Move/resize/edit/reveal remain gated by overlap-safe compositor proof |
| Recent text toolbar toggle | Fixed · 9/10 | Text options → turn off Show Recent text toolbar → choose Text; Recent text controls are hidden | Storage is `paint:text-history-toolbar=false`; live editor reports `hidden=true`, `aria-hidden=true`, computed `display:none`; no console errors | Add a dedicated automated browser assertion to the permanent smoke runner if browser CI is introduced |
| Image More menu | Done for requested structure · 8/10 | Image → More → Crop/Rotate/Flip; each opens a right-side submenu; ArrowDown/Enter/ArrowLeft navigate; click outside or Escape closes all levels | Playwright snapshots: [`round2-image-crop-submenu.yml`](../../../output/playwright/phase-2/playwright-cli/round2-image-crop-submenu.yml), [`round2-image-outside-closed.yml`](../../../output/playwright/phase-2/playwright-cli/round2-image-outside-closed.yml); shared controller contract and clean console | Full focus restoration and all Ribbon positions still need the Step 11 matrix |
| Step 09 modularization | First slice · 3/10 | No new end-user screen; menu behavior is the first extracted composition-root seam | `ActionMenuController` owns positioning, nested-menu ancestry, outside click, Escape, and `aria-expanded`; unit/static contracts pass | Extract HistoryPanel, SettingsDialog, and low-risk `main.js` services |
| Step 10 quality gates | Quick-win slice · 4/10 | Run `npm test`; all four test files pass | `4/4` files green, changed-file syntax checks, `git diff --check`, direct source-over behavior test, and alpha/menu/text contracts | Add behavioral browser fixtures, `checkJs`, coverage targets, and teardown tests |
| Step 11 accessibility/PWA | Focused slice · 3/10 | Inspect the accessible tree of Image → More and Text options | Nested menus expose roles/labels/expanded state; hidden text toolbar is removed from the visual and accessibility surface; new modules are precached | Complete focus restoration, keyboard traversal, layout matrix, PWA icons, Lighthouse, and SW-list maintenance |

## Current quality score

These are evidence-based readiness scores, not a claim that Phase 2 is
release-complete.

| Dimension | Score | Why |
|---|---:|---|
| Code design | 7.5/10 | Functional menu/text seams are clear and the opacity commit boundary is explicit; legacy class owners and the large composition root remain |
| UI design | 8/10 | Compact alpha control, nested Image actions, text focus affordance, and responsive Ribbon settings are usable; alternate layouts and keyboard traversal need a full matrix |
| Logic and data safety | 7.5/10 | Alpha is no longer compounded during floating-layer placement, text focus is metadata-only, and storage math is bounded; overlap-safe text editing and recovery are not complete |
| Verification discipline | 7/10 | Four test files, syntax/diff checks, focused Playwright snapshots, and clean console checks pass; trace, coverage, Lighthouse, and full layout matrix are pending |
| Overall professional readiness | **7.5/10** | Good stabilization progress, not yet a complete Step 9–11 release gate |

## Missing points / next gate

| Missing point | Why it matters | Recommended next action | Step |
|---|---|---|---:|
| Direct browser alpha pixel fixture for selected shapes | Prevents a future reintroduction of 20% → 4% opacity when a floating shape is placed | The source-over fake-context behavior test is done; add a real browser pixel-ratio lift/place fixture | 05 / 10 |
| Text overlap-safe editing | Raster commit alone cannot safely support edit-after-blur over existing paint | Keep focus-only behavior enabled; design compositor and prove overlap, duplicate, vanish, undo/redo, and reload cases before editing UI | 06 |
| Pointer/event measurement | Functional seams exist, but performance claims are not measured | Add one rAF pointer trace, listener count, and teardown assertion | 07 / 10 |
| Blob/object URL and recovery path | Browser memory and storage quota are different failure domains | Add bounded Blob history, URL revocation, IndexedDB corruption/reset, and quota-error fixtures | 08 / 10 |
| More composition-root extraction | `main.js` and `Sidebar.js` still carry too many owners | Extract HistoryPanel/SettingsDialog and keep public functional seams | 09 |
| Full accessibility/PWA gate | Nested menus are only one representative journey | Run all Ribbon positions, keyboard traversal/focus restore, icons, offline launch, and Lighthouse budgets | 11 |

## UI walkthrough for this round

1. Open `http://127.0.0.1:4173/` (or serve the `paint` directory locally).
2. Colors: activate the checkerboard arrow and choose a foreground/background
   opacity. Right-click a palette swatch, then click elsewhere; the menu closes.
3. Image: choose More, open Crop/Rotate/Flip, and press Escape. Only the
   requested submenu is exposed at a time and all menus close together.
4. Text: open Text options, toggle Recent text off, choose Text, click the
   canvas, type, then click outside the editor. The editor commits and the
   tool becomes Select. Enable Select text after draw to expose a focus target.

## Evidence files

- [`round2-image-crop-submenu.yml`](../../../output/playwright/phase-2/playwright-cli/round2-image-crop-submenu.yml)
- [`round2-image-keyboard-submenu.yml`](../../../output/playwright/phase-2/playwright-cli/round2-image-keyboard-submenu.yml)
- [`round2-image-outside-closed.yml`](../../../output/playwright/phase-2/playwright-cli/round2-image-outside-closed.yml)
- [`round2-text-toolbar-hidden.yml`](../../../output/playwright/phase-2/playwright-cli/round2-text-toolbar-hidden.yml)
- [`round2-text-select-option.yml`](../../../output/playwright/phase-2/playwright-cli/round2-text-select-option.yml)
- [`round2-tools-menu.yml`](../../../output/playwright/phase-2/playwright-cli/round2-tools-menu.yml)
- [`WEB-QUALITY-AUDIT-ROUND2.json`](WEB-QUALITY-AUDIT-ROUND2.json) — `index.html`: 0 issues, 0 warnings
- [`WEB-QUALITY-AUDIT-ROUND2-STATUS.json`](WEB-QUALITY-AUDIT-ROUND2-STATUS.json) — this HTML status: 0 issues, 0 warnings
- [`PROGRESS-LOG.md`](PROGRESS-LOG.md)

## Next recommended order

Continue with the smallest safe sequence:

1. Step 09.1: extract a HistoryPanel seam and add its behavior contract.
2. Step 09.2: extract SettingsDialog/Ribbon settings ownership.
3. Step 10.1: add the direct shape-alpha pixel fixture and browser smoke
   assertions for nested menus and text commit.
4. Step 11.1: run keyboard/focus checks across compact, expanded, left, and
   right Ribbon layouts.

The larger text compositor, Python/background-removal provider, service-worker
asset synchronization, and multi-document recovery remain later gates rather
than reasons to weaken the current safe slice.
