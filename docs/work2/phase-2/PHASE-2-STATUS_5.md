# Paint - Round 5 delivery status

Last updated: 2026-09-19  
Customer release: **1.6.0**  
Previous round: [`PHASE-2-STATUS_4.md`](PHASE-2-STATUS_4.md)

This round closes the unsafe text-focus/raster-selection boundary and the
quick PWA release gates. Release-note wording is customer-facing; internal
phase names remain only in engineering documentation.

## Top-line score

| Dimension | Score | Evidence | Remaining gap |
|---|---:|---|---|
| Code design | 8.9/10 | `TextLayerRenderer` and `TextLayerService` own text rendering/movement; CanvasManager owns composition | More legacy class owners and the large composition root remain |
| UI design | 9/10 | Visible text focus target, drag affordance, responsive 74px Ribbon, PNG PWA icons | RTL and full visual regression matrix remain |
| Logic/data safety | 9/10 | Text movement never enters pixel selection; save/history/copy/export composite the layer; outside click clears focus | Editable text metadata is not reload-persisted; recovery edge cases remain |
| Verification | 8.9/10 | `npm test` 5/5; 41 smoke assertions plus renderer contract; live text move/off-click test; SW/offline/reduced-motion/mobile checks | Lighthouse, browser-level 200% zoom, update-prompt and device matrix remain |
| Overall professional readiness | **8.9/10** | Strong `1.6.0` release candidate | Final Step 11 audit is still open |

## Round 5 results

| Area | Score | What changed | How it was measured | Try it in Paint |
|---|---:|---|---|---|
| Text layer ownership | 9.5/10 | Added transparent `#text-layer-canvas`; shared renderer; composited PNG/storage/history/clipboard output | Browser snapshot contains text focus targets while `#status-selection` remains empty; source contract has no direct TextTool raster commit | Choose Text → click canvas → type → click outside |
| Select text after draw | 9.5/10 | Enabled option focuses a metadata target; drag and arrow keys move only the text object; outside pointerdown clears it | Target moved from `(x,y)` to `(x+100,y+50)`; pixel selection status stayed empty; outside click produced zero selected targets | Text options → Select text after draw → draw text → drag the visible target |
| Raster safety boundary | 9/10 | Normal SelectTool explicitly flattens committed text before a pixel operation; text focus never calls `setSelection` | Browser run showed no normal selection rectangle during text movement; flatten is explicit and centralized | After moving text, start a normal marquee if you want pixel editing |
| Release notes/version | 9/10 | Customer notes are versioned `1.6.0` and no longer expose “Phase 2”; package/app version synchronized | `package.json`, `js/version.js`, and release note entry all report `1.6.0` | Settings → Release notes |
| PWA shell | 9/10 | Added 192/512/maskable PNG icons, manifest entries, manifest precache, resilient `allSettled` shell install, reduced-motion CSS | SW activated; manifest and all PNG URLs returned OK; offline reload kept title, app root, text layer, and SW control | Reload once online, then test offline reload in DevTools/browser |
| Mobile journey | 8.5/10 | 320px layout retains a 74px Ribbon and an internally scrollable Ribbon; document/body are clipped horizontally | Browser metrics: 320px viewport, Ribbon 320×74, body width 320, Ribbon scroll width 1065 | Resize to 320px and horizontally browse the Ribbon |

## Step 11 remaining gate

Step 11 is substantially improved but not fully closed. Remaining evidence is
Lighthouse, browser-level 200% zoom, service-worker update-prompt behavior,
and a final device matrix. The current Playwright CLI does not expose a
browser-level zoom control (`Control+=` is not implemented by its headless
session), so that item must be verified in a real browser or a dedicated
device emulation run.

## `.playwright-cli` audit

The files in `paint/.playwright-cli/` are generated Playwright CLI snapshots
and console logs. They are not loaded by the app or service worker. Curated
round evidence belongs under `paint/output/playwright/phase-2/playwright-cli/`;
the raw directory can be archived or removed in a separate cleanup decision.

## Release handoff

The working tree now describes customer version `1.6.0`; no git tag, push, or
customer deployment was performed. Steps 12 and 13 can be planned now, but I
recommend starting implementation only after approval of the `1.6.0` release
boundary and the remaining Step 11 audit. If approved, Step 12 should be
handled first as a lazy provider seam, followed by Step 13’s persistent tabs,
split-pane, and recovery work.
