# Requirements Traceability Matrix

| Source request | Normalized requirement | Step | Acceptance evidence |
|---|---|---:|---|
| Session history delete | Persistent and session cards expose predictable per-item actions; action does not load the image | 03 | DOM/interaction test plus manual history/session check |
| Session order | Newest/current entry appears first; export/delete indices use stable IDs, not visual position | 03 | Session fixture with 3 entries |
| Active history tab | Active tab has light-blue background, contrast, focus style, and selected semantics | 03, 11 | CSS + keyboard test |
| Ribbon settings | Stable group order, compact rows, no duplicated/default drift | 02, 03, 09 | SettingsStore and DOM tests |
| General settings | Canvas background/default size/default zoom use clearer choice controls | 03, 11 | Keyboard and narrow-layout check |
| Remove unnecessary Close buttons | General and About do not duplicate the footer/header close action | 03 | DOM assertion |
| Image More menu | Crop, resize, rotate, flip, and background actions are grouped into one space-saving menu | 03 | Menu interaction test |
| Ribbon group alignment | Fixed control/title bands align all group titles; total ribbon height stays within budget | 03 | Layout measurement at top/left/bottom/float |
| Shape gallery stays open | Shape-gallery descendants stop internal close propagation; outside click closes | 03 | Browser interaction test |
| Resize percentage/ratio | Percent control, default ratio lock, absolute values, validation | 04 | Unit + browser test |
| Resize selected content | Active selection is the resize target; whole canvas only when no selection exists | 04 | Selection transform test |
| Transparent canvas/PNG | Transparent mode preserves alpha through edits and PNG save | 04 | Pixel/PNG fixture |
| Python background removal | Optional advanced provider behind adapter; default app stays lightweight and local-first | 12 | Provider contract and failure-path test |
| Palette right-click editing | Context menu edits a palette slot without accidental secondary-color mutation | 05 | DOM/keyboard/context-menu test |
| Alpha/transparent colors | Foreground/background alpha persisted and applied by drawing/composition | 05 | RGBA migration + pixel test |
| Movable text | Text can remain selected/movable after creation via Tools More setting | 06 | Text object gesture test |
| Text toolbar | Selected ranges support a scoped formatting toolbar with sanitized style runs | 06 | Editor model test |
| Text history | Recent textarea text, persisted locally, click restores text, clear works, and the bounded history has a maximum of 20 entries; full text-object editing is deferred | 06 | Store contract tests plus browser smoke |
| Right-click text edit | Topmost editable text hit-test opens editor; overlapping paint does not create false hits | 06 | Hit-test/compositor test |
| Reveal/edit mode | Temporary visual overlay identifies editable text regions | 06 | Timed UI test/manual check |
| Text split button | T activates text; adjacent chevron independently opens text settings | 06 | DOM interaction test |
| Whole-app audit | Measured performance, memory, listeners, structure, UI, tests, SEO/PWA, and edge cases | 01, 07–11 | Phase report with before/after metrics |
| Phase 1 #8 | Verify and harden quota/thumb behavior; add document IDs and byte limits | 08 | Storage tests and quota fixture |
| Phase 1 #7 | Add tabs/split/session/recovery only after document/storage seams stabilize | 13 | Multi-document acceptance suite |
