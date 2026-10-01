# ADR 0001 — Work 3 lessons: extraction, ordering and drift

Status: accepted · Context: Phase 3 modularisation (2026-10-01)

## Context

`js/main.js` was a 2,948-line composition root that owned every feature
section, the settings schema, the URL, and a hand-maintained service-worker
shell. Work 3 split it into `js/app/*` modules. This ADR records the failures
that happened along the way and the rules that now prevent them.

## The five incidents

### 1. Service-worker cache drift

A stale-cache boot failure was "fixed" by hand-editing `CACHE_NAME` to
`paint-shell-v1-8-0` while the app version was 1.7.0. That broke the project
convention enforced by `scripts/release-check.mjs`, and it was a symptom: the
source `sw.js` shell list was maintained by hand and silently missed every new
module.

**Rules**

- `npm run sw:sync` regenerates the shell from the import graph and syncs the
  cache name with the version. Run it after **any** module move.
- `npm test` fails on drift, so this is caught in the normal loop, not at
  release time. Production builds are safe regardless (content fingerprint).

### 2. The cache that could not self-heal

`cacheShell()` skipped re-fetching anything already in the cache, so a
same-named cache kept serving a changed module until someone bumped the name.

**Rule:** a shell precache always re-fetches and falls back to the cached copy
only when the network fails. Never "fix" staleness by renaming the cache.

### 3. Temporal dead zone at the composition root

Passing collaborators as values at init time (rather than reading them lazily)
exposed ordering faults that a "it works in dev" mindset hides: `flattenLayers`
was a `toolContext` property, not a module binding; two background factories
still needed to become module imports; `bgSelect` was declared after its first
use; and one reorder slice dropped `const shortcutManager` entirely.

**Rules**

- Collaborators cross a module boundary as **values at init**, so the store and
  its readers are created above the feature sections.
- Extract with **narrow, ordered ranges**. Cutting an over-wide block silently
  deletes the code in between.
- `node --check` plus a browser boot after every batch is mandatory: three of
  these faults only appeared at runtime.

### 4. Unkeyed text and re-asserted labels

Two classes of i18n defect shipped:

- Text written with `t()` but no ownership (`status.textContent = t(...)`)
  froze in the language that was active when it was rendered.
- Nodes with a static `data-i18n` kept overwriting a feature's dynamic value on
  the next locale pass (the sidebar header always reverted to "Sidebar").

**Rules**

- Values JS renders go through a helper that sets `data-i18n-runtime` (or
  clears it for unkeyed values) — never a bare `textContent = t(...)`.
- Runtime-filled nodes opt out with `data-i18n-ignore` (existing pattern, see
  `SegmentedChoice`).
- Raw English left behind while moving code becomes message keys in the same
  change, across all eight catalogs.

### 5. Two catalog shapes

`es` is a nested catalog; the other six are flat factory catalogs that clone the
English shape at runtime. A flat insert into `es` produced literal keys
(`"status.exportedImages": …`) that `check:i18n` correctly rejected.

**Rule:** `check:i18n` verifies key *coverage*, not override *quality*. A catalog
can still fall back to English; that is a translation task, not a code fix.

## Boot performance: measured, not assumed

A report of "1–2s to boot" led to instrumentation (`js/app/bootTiming.js`).
Measured cold boot: first paint ~104ms, settings hydration **8ms**, ~40 settings
reads ≈ 1.6ms (`structuredClone` is not the bottleneck), total interactive
~523ms.

**Rule:** profile before optimising. `markBoot()` exists so "why is boot slow"
is answered with numbers, not with a guess about `localStorage`.

## Consequences

- `.skills/work3-delivery.md` gained a step for `npm run sw:sync`.
- `docs/RELEASING.md` and `docs/UI-PATTERNS.md` document the version/shell
  workflow and the reusable interaction contracts.
- Every module extraction ships with a contract test, so a future session
  cannot silently undo the split.