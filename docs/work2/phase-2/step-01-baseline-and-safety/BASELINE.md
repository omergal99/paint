# Step 01 Baseline

Captured 2026-09-19 from the Paint working tree after correcting the stale
community-standards paths and settings-height assertion.

## Test and static gates

| Check | Result |
|---|---|
| `npm test` | Pass: 2 test files, 35 subtests, 0 failures |
| Community standards path | Pass: canonical file is `docs/work1/COMMUNITY_STANDARDS.md` |
| Code of conduct path | Pass: `docs/CODE_OF_CONDUCT.md` |
| Settings height expectation | Pass: `min(470px, 88vh)` |
| `git diff --check` | Pass |
| Lighthouse | Not run in this Node-only baseline; browser evidence remains required in Step 11 |

## Size baseline

| Area | Lines |
|---|---:|
| `js/main.js` | 1,867 |
| `js/ui/Sidebar.js` | 827 |
| `css/styles.css` | 2,344 |
| `js/history/HistoryManager.js` | 173 |

## Listener and storage census

- JavaScript listener registrations: 176 `addEventListener` calls.
- JavaScript listener removals: 14 `removeEventListener` calls.
- Storage references: 25 `localStorage.getItem`, 22 `localStorage.setItem`,
  3 `localStorage.removeItem`, 1 each for sessionStorage get/set/remove, and
  5 IndexedDB references.
- The listener ratio is intentionally recorded as a baseline, not a quality
  target by itself; Step 07 must measure lifecycle ownership and teardown.

## Known limitations

- Browser memory is not measured by `npm test`; Step 08 needs a profile covering
  decoded images, scratch canvases, Blobs, object URLs, and undo entries.
- Ribbon height and Lighthouse budgets need headed browser runs across layouts.
- Service-worker asset-list synchronization remains deferred maintenance.
