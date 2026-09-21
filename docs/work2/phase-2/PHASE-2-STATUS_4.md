# Paint Phase 2 - Round 4 status

Last updated: 2026-09-19

This round fixes the shared menu placement contract, palette color-edit state,
button-based Ribbon position settings, settings icon, SSOT keyboard/history
constants, and text focus-to-raster-selection handoff. The HTML companion is
white-theme only: [`PHASE-2-STATUS_4.html`](PHASE-2-STATUS_4.html).

## Top-line score

| Dimension | Score | Evidence | Missing points |
|---|---:|---|---|
| Code design | 8.5/10 | Functional menu/settings/history/text seams; shared constants; architecture skill rule added | Legacy class owners and large `main.js`/`Sidebar.js` remain |
| UI design | 8.8/10 | Native Ribbon radio group, gear icon, clamped menus, full text bounds, selection handles | Full visual regression and RTL/mobile PWA polish remain |
| Logic/data safety | 8.5/10 | Palette edit lifetime fixed; text move follows normal pixel selection; alpha path retained | Text-only overlap-safe editing and storage recovery remain gated |
| Verification | 8.4/10 | `npm test` 4/4, syntax, diff, analyzer 0/0, live Chromium checks, console errors 0 | `checkJs`, coverage, Lighthouse, offline/update, 200% zoom/reduced-motion |
| Overall professional readiness | **8.5/10** | Strong Phase 2 release candidate | Do not call PWA production-ready until Step 11 gates close |

## Round 4 results and UI checks

| Area | Score | Delivered | Measurement / verification | Missing points / next gate | Try it in Paint |
|---|---:|---|---|---|---|
| Shared action menus | 9.2/10 | One controller measures and clamps top-level, submenu, and pointer-context menus | 1280×720 and 320×720 representative menus have no viewport overflow; outside/Escape closure passes | Add all-menu automated fixture and focus-restore assertions | Open Size, Text options, Image → More → Rotate; resize to 320px and repeat |
| Palette Edit color | 9/10 | Chosen palette index survives menu close until native color input emits input/change; `showPicker()` fallback added | Right-click slot → Edit: menu closed, picker value `#000000`; outside click leaves menu hidden; console errors 0 | Add an automated native-picker change fixture where browser support permits | Right-click a palette slot and choose Edit color |
| Ribbon position | 9/10 | Native radio buttons replace dropdown; keyboard arrows activate options; layout manager remains SSOT | Accessibility snapshot exposes radiogroup/radio and checked Top state | Add RTL direction matrix and focus-restore assertion | Settings → Ribbon → choose Top/Left/Bottom/Floating |
| Settings icon/SSOT | 8.5/10 | Explicit gear icon; keyboard arrow constants and History view constants are shared | Source syntax and full suite pass; no repeated state literals in Sidebar/Main examples | Continue class-to-factory migration only where behavior seams justify it | Open Settings and switch History/Session with arrows |
| Text focus target | 8.8/10 | Bounds measured with active font, padded/minimum interactive target, optional selection handoff, metadata follows move | Off: Text stays active; on: Select active, target selected, 8 handles visible; live drag offset followed target | Text-only compositor/editing remains behind overlap + undo/redo + reload proof | Enable Text options → Select text after draw, draw text, click outside, drag the selected pixel region |
| Phase 2 release notes | 9/10 | Settings Release notes lists the Phase 2 candidate highlights | `js/releaseNotes.js` is rendered by existing Settings release panel | Version bump/tag/push requires user approval after final PWA decision | Settings → Release notes |

## Step 11 / PWA decision

Step 11 is partial, not complete PWA production readiness. The app has a
manifest, service worker, offline fallback path, responsive layouts, and live
keyboard/layout evidence, but `manifest.json` still declares only an SVG icon.
The remaining release gates are 192×192 and 512×512 PNG icons, offline reload
and update behavior, Lighthouse, 200% zoom, reduced motion, and a final mobile
journey.

## Phase 3 planning added

The follow-on plan is in [`../phase-3/README.md`](../phase-3/README.md). It
defines catalog-based localization, a language/`dir` service with LTR/RTL
matrix checks, and a bounded persistent tabbed right-panel notepad.

## Verification gate

Detailed live measurements: [`round4-browser-fixtures.json`](../../../output/playwright/phase-2/playwright-cli/round4-browser-fixtures.json).

```text
npm test                                      4/4 top-level files pass
node --check changed JS                      pass
git diff --check                              pass
web-quality analyzer (app HTML)               0 issues / 0 warnings
live action-menu bounds                       1280px + 320px pass
palette outside-close                        pass
text off/on and move handoff                 pass
browser console errors                        0
PWA/Lighthouse/offline                         pending
```

## Release handoff

Phase 2 can be prepared as a release candidate with the current release notes,
but do not push/tag a new customer version until the remaining Step 11 decision
is made. After the user approves the release boundary, the next work should
close the PWA/Lighthouse/offline path before Phase 3 implementation begins.
