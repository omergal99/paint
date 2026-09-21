# Paint Phase 2 - Round 3 Status

Last updated: 2026-09-19

This round closes the requested UI fixes and completes the planned 09.1,
09.2, 10.1, and 11.1 slices with browser evidence. HTML status is maintained
as a white-theme companion in [`PHASE-2-STATUS_3.html`](PHASE-2-STATUS_3.html).

## Top-line score

| Dimension | Score | Evidence | Remaining gap |
|---|---:|---|---|
| Code design | 8/10 | Functional `ActionMenuController`, `HistoryPanel`, and `SettingsDialog` seams; no new class owner | `main.js` and `Sidebar` still contain older feature ownership |
| UI design | 8.5/10 | Palette context menu, visible text focus affordance, empty draggable toolbar, 74px/alternate Ribbon matrix | Full visual regression and compact/expanded matrix still need CI capture |
| Logic/data safety | 8/10 | Source-over alpha fixture, selection nudge path, text remains metadata-only | Safe text-object move/edit/compositing is still gated |
| Verification | 8/10 | `npm test` 4/4, syntax, direct browser pixel fixture, keyboard/layout matrix | `checkJs`, coverage, Lighthouse, and offline update checks remain |
| Overall professional readiness | **8.1/10** | All four requested slices have implementation and evidence | Release readiness still depends on the open gates above |

## Round 3 results and UI checks

| Area | Score | Delivered | Measurement / verification | Missing points / next gate | Try it in Paint |
|---|---:|---|---|---|---|
| Palette context menu | 9.5/10 | Right-click opens `action-menu-items color-palette-context-menu-items` beside the clicked swatch; outside click closes it | Playwright open/closed snapshots and shared controller event | Add keyboard context-menu invocation and file/import alpha fixture | Right-click any Colors swatch, choose an action, then click elsewhere |
| Text toolbar toggle | 9/10 | Off state leaves an empty `.text-editor-toolbar` shell, `hidden=false`, `aria-hidden=true`, and it remains draggable | Browser measured shell position changed after dragging the empty toolbar | Add a dedicated direct unit fixture for live toggle across multiple editors | Text → Text options → clear “Show Recent text toolbar” → click canvas → drag the empty bar |
| Select text after draw | 8.5/10 | Optional checkbox commits text, switches to Select, and shows a labeled selected metadata target with a visible move glyph | Snapshot shows `Focus text: Alpha test`, pressed state, `✥`, and Select tool | Safe pixel-preserving text-object move/edit is still deferred | Enable “Select text after draw”, type text, click outside, and inspect the highlighted target |
| Selection keyboard nudge | 9/10 | Arrow/Shift+Arrow nudges ordinary marquee selections by 1/10px; it lifts pixels once and respects menu `defaultPrevented` | Browser measured x `616 → 617` after ArrowRight | Add undo/reload browser journey and focus-restore assertions | Select an area, focus the canvas/body, press ArrowRight or Shift+ArrowRight |
| 09.1 HistoryPanel seam | 8/10 | Functional seam owns History/Session tabs, roving tab index, labels, and view-aware action wording; Sidebar keeps persistence/rendering | Source contract, Node suite, live History tab semantics | Move data-rendering callbacks behind the seam after teardown coverage | Open History and switch History/Session with mouse or left/right arrows |
| 09.2 SettingsDialog seam | 8/10 | Functional seam owns settings tabs, roles, `aria-selected`, panel visibility, keyboard traversal, and focus restoration | Live Settings snapshot exposes tablist/tab/tabpanel; keyboard matrix passes | Move URL/settings side effects into a narrower adapter; add close-focus fixture | Open Settings, use arrow keys across tabs, close, and verify focus returns |
| 10.1 direct alpha/browser fixture | 8.5/10 | 20% foreground shape with Select after draw commits once with source-over; pixel matches expected `[237,219,237,255]` | `round3-browser-fixtures.json`; floating layer and 8 handles observed before commit; 0 app errors | Add transparent PNG/import/export and file/eyedropper fixtures | Set Colors opacity to 20%, enable Shapes → Select after draw, draw rectangle, click outside |
| 11.1 keyboard/layout matrix | 8/10 | Top/left/bottom/floating at 1280 and narrow 320 mobile order; 74px top/bottom Ribbon and 1065px scroll content measured | `round3-browser-fixtures.json`; Enter opens Image More, Escape closes, settings arrows select next tab | Add 200% zoom/reduced-motion/Lighthouse and offline shell checks | Resize browser to 320px; open Settings → Ribbon; try Top/Left/Bottom/Floating |

## Safety boundaries retained

- Text remains rasterized on commit. The focus target is a visible, optional
  metadata affordance, not proof that editing existing text is safe.
- Text compositor, hit-testing, move/resize/edit-after-blur, range formatting,
  right-click Edit, reveal mode, and pixel-preserving text movement remain
  behind overlap + undo/redo + reload proofs.
- The alpha fixture proves one selected shape placement does not double-apply
  opacity. It does not replace transparent PNG/import/export fixtures.
- Browser memory remains distinct from storage quota; About still uses one
  validated cached browser estimate per 24-hour window and computes
  `max(0, quota - usage)` from raw bytes before display formatting.
- Service-worker assets for the new functional seams are explicitly listed;
  automated list synchronization remains deferred as a lower-priority gate.

## Evidence

- [Round 3 browser fixture report](../../../output/playwright/phase-2/playwright-cli/round3-browser-fixtures.json)
- [Palette context open snapshot](../../../output/playwright/phase-2/playwright-cli/round3-palette-context-open.yml)
- [Palette outside-close snapshot](../../../output/playwright/phase-2/playwright-cli/round3-palette-context-closed.yml)
- [Empty text toolbar snapshot](../../../output/playwright/phase-2/playwright-cli/round3-text-toolbar-empty.yml)
- [Visible text focus snapshot](../../../output/playwright/phase-2/playwright-cli/round3-text-select-visible.yml)
- [Round 3 web-quality report](WEB-QUALITY-AUDIT-ROUND3.json)

## Verification gate

```text
npm test                                      4/4 top-level files pass
node --check changed JS                      pass
git diff --check                              pass
direct alpha/browser fixture                  pass
keyboard/layout matrix                        pass
web-quality analyzer (app + status HTML)      pending for this round
```

Next recommended order: add the transparent file/import fixture and then move
the remaining low-risk Settings/History callbacks behind their seams. Keep the
advanced text compositor and optional Python/background-removal path deferred
until their explicit proof gates are affordable.
