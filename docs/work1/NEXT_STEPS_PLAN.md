# paint - Next-Steps Roadmap (prioritized)

> Reviewed: `docs/future_ideas.md` + `docs/future_ideas2.md`.
> Each candidate is rated by effort (S ≤ ½ day, M 1–2 days, L ≈ a week, XL 2+ weeks)
> and impact (H/M/L). __Quick wins__ are cheap and clearly valuable - do them first.

---

## 1. Status review of existing wishlists

### From `future_ideas.md`
| # | Idea | Status now |
|---|------|-----------|
| 1 | History sidebar (auto-save, limits, export, apply) | ✅ Mostly done (History panel + settings tabs, per-item save/export) |
| 2 | Rotation, flipping, shearing | 🔶 Rotate 90/180/270/free + flip exist in Image menu; selection-scoped still partial |
| 3 | Background removal (color key → AI) | ✅ Color-key button in Crop menu; ❌ AI/big-refine not done |
| 4 | AI chat sidebar | 🔶 Mock assistant exists; real LLM/Gemini connection not done |
| 5 | Eyedropper magnifier balloon | ✅ Implemented |
| 6 | Settings / workspace layout toggles | 🔶 Partially (dark mode, status/CI toggles, canvas bg, ribbon visibility) |
| 7 | Smart click deselection | ✅ Implemented |
| 8 | Color-inspector layout + selectable hex | ✅ Done |
| 9 | Save feedback + tab title | 🔶 Toast exists but no filename-in-title |
| 10 | Corner-handle size, arrow-key nudge, 8-pt selection, paste-at-cursor | 🔶 Arrow-nudge + 8-pt selection done; paste-at-cursor & corner-handle lock partial |
| 11 | Mobile/tablet full view + bottom toolbar | ❌ Not done (responsive CSS only) |
| 12 | Custom size, drag&drop import, lock size | 🔶 Custom size + d&d import done; **lock size not done** |
| 13 | Accessibility (underlined shortcut letters, focus) | 🔶 Partially done |
| 14 | App-icon click → copy SVG/PNG loop | ✅ Done |

### From `future_ideas2.md`
| # | Idea | Status now |
|---|------|-----------|
| 1 | PWA + offline first | 🔶 SW cache exists; no install/update banner UX |
| 2 | Automatic update banner | ❌ Not done (SW waits silently) |
| 3 | Better mobile canvas UX | ❌ Not done |
| 4 | Image import flow | ✅ Mostly done (Import + paste-like floating) |
| 5 | Selection improvements | 🔶 Resize handles done; rotate/duplicate/crop toolbar partial |
| 6 | Sidebar tabs/search/resizable | ❌ Not done |
| 7 | Safer saving (status, Save As, backup trail) | 🔶 Save-as exists; status + backup trail not done |
| 8 | Accessibility pass | ❌ Not done |

---

## 2. New ideas (proposed)

- **N1 - Space-drag / middle-drag panning.** Natural for a paint app: hold
  `Space` (or middle mouse) and drag to pan. Complements the new native-scroll
  fix and is far more precise than scrollbars.
- **N2 - Smart shape modifiers.** `Shift` while dragging a shape constrains
  line/arrow to 45° steps and rectangle/ellipse to perfect square/circle;
  `Alt` draws from the center. Classic Paint behavior, tiny code change.
- **N3 - Fit-to-window zoom (`Ctrl+0`).** One-click "fit" that computes the
  zoom % so the whole canvas is visible (today you must slide the zoom bar).
- **N4 - "Open history copy as new image"** button alongside the existing
  per-item save/export in the History panel (idea 1 remainder).
- **N5 - Keyboard-shortcut reference dialog (`F1` / `?`).** Lists every
  shortcut and ribbon letter; improves discoverability massively.
- **N6 - Save-success toast + page title sync.** Green toast "Saved to <file>" and
  `document.title` shows the filename (idea 9 remainder).
- **N7 - Lock canvas size toggle** on the ribbon/resize area (idea 12 remainder)
  so the drag-handles disappear until unlocked.
- **N8 - Stroke style presets** (solid / dashed / dotted) for freehand and the
  line/arrow shapes - cheap and noticeable.
- **N9 - Selection toolbar for floating selections** (rotate, duplicate, flip,
  crop-as-new) - picks up idea 10 / future_ideas2 5 fully.
- **N10 - SW update banner** (future_ideas2 2): when a new worker is waiting, show
  a toast with Reload, preserving the canvas first.
- **N11 - Rulers + optional grid overlay** on the viewport edges (settings-gated).
- **N12 - Text outline/stroke options** for the Text tool (fill vs stroke).
- **N13 - Background-removal refinement mode** - after auto/keying, brush to
  keep/erase, like Word's mark-areas UX.
---

## 3. Prioritized table (`docs` + new)

| ID | Idea | Source | Effort | Impact | Why |
|----|------|--------|:------:|:------:|-----|
| Q1 | N2 Shift/Alt shape constraints | new | S | **H** | Instant pro-feel for all shapes |
| Q2 | N1 Space/middle-drag pan | new | S | **H** | Most-requested navigation gap after the scroll fix |
| Q3 | N3 Fit-to-window + `Ctrl+0` | new | S | M | One-click resets zoom for big canvases |
| Q4 | N8 Stroke presets (dash/dot) | new | S | M | Visible feature, isolated to Shape/Freehand |
| Q5 | N5 Shortcut dialog (`F1`) | new | S | M | Big discoverability win, tiny code |
| Q6 | N6 Save toast + title sync | ##9/#7 | S | M | Clear feedback, low risk |
| Q7 | N7 Lock canvas size | #12 | S | M | Stops accidental drags |
| Q8 | N10 SW update banner | ideas2 #2 | S | M | Completes the PWA story |
| Q9 | N4 History "open as new" | #1 | S | M | Closes the main history gap |
| Q10 | N14 Zoom-to-selection | new | M | M | Nice for large canvases |
| M1 | N9 Selection toolbar (rotate/crop/duplicate) | #10/#5 | **M** | **H** | Finishes the "floating selection" model |
| M2 | N12 Text outline/stroke options | #14 | M | M | Text becomes presentation-ready |
| M3 | N11 Rulers + grid overlay | new/#6 | M | M | Design-accuracy crowd-pleaser |
| M4 | N13 BG-removal refine mode | #3/#14 | M | **H** | Makes remove-bg actually usable |
| M5 | Sidebar tabs/search/resizable | ideas2 #6 | M | M | Navigation of many history entries |
| M6 | Safer saving: backup trail + status | ideas2 #7 | M | M | Trust for long sessions |
| L1 | Mobile bottom-toolbar canvas view | #11 | **L** | **H** | Opens tablets/phones as first-class |
| L2 | Real AI editing (Gemini/WebLLM) in sidebar | #4 | **L** | **H** | Differentiator; needs provider-hosted flow or an explicitly configured secure backend |
| L3 | Accessibility pass | ideas2 #8 | L | M | Compliance + quality |
| L4 | AI background removal (MediaPipe) vs refine | #3 | L | H | SOTA result, larger scope |

---

## 4. Recommendation

1. **Now (this sprint):** Q1–Q3 + Q6. All small, no shared-file risk, high touch.
2. **Next:** Q5, Q7, Q9, then **M1 (selection toolbar)** and **M4 (bg-remove refine)**
   - the two most "finish the feature" investments.
3. **When ready for a bigger push:** L1 (mobile view) and L2 (real AI) unlock new
   audiences; both deserve their own focused session.
- **N14 - Magnifier preview while panning/zooming at high % + zoom-to-selection.**
