# UI patterns

Reusable interaction contracts. Each one already exists in the codebase — this
file records *why* they behave that way, so the next component copies the
behaviour instead of rediscovering it.

## Action menu: click locks, hover previews, leave restores

Owner: `js/ui/ActionMenuController.js`.

| Input | Result |
|---|---|
| Click a trigger / item | The menu **locks open** and stays open (a click is a deliberate choice). |
| Hover another item | The item highlights as a *preview* without changing the locked selection. |
| Mouse leave the menu | The preview highlight is dropped and the locked selection is restored. |

Why: a pointer user must be able to open a menu and move toward a submenu
without it closing (hover intent), while a click must not be undone by the
pointer drifting back (explicit intent). Escape closes the menu and returns
focus to the trigger — and it is only consumed **when a menu was actually
open**, so this document-level listener can never block the native `<dialog>`
dismiss (ADR 0001).

## Dialog ownership

- One owner per dialog. Deep links (`?dialog=settings&tab=about`) resolve
  through `js/app/router.js`; the opener decides what "settings" means.
- Closing always clears the URL, so a reload never resurrects a dismissed dialog.
- Native dismissal (Escape, backdrop click) stays intact: a global handler must
  never `preventDefault()` Escape unless it consumed the event.
- Static dialogs are framed by `standardizeDialogFrames()` during app startup;
  dialogs created later use `standardizeDialogFrame({ dialog })`. Both use a
  titled header with `.settings-close`, a scrollable `.dialog-body`, and a
  bordered `.dialog-footer`. Settings keeps its tabbed shell while sharing the
  same header/footer tokens.

## Menu and mirror icons

- Every menu item, submenu entry, and sidebar mirror section includes a
  decorative icon that is hidden from assistive technology; the text label
  remains the accessible name.
- Use the existing menu icon sizing and `currentColor` stroke conventions.
  Do not replace a visible label with an icon-only control.

## Mirrored controls (one setting, many surfaces)

`RibbonMirror` + the `js/ui/mirrors/*Mirror.js` descriptors render the ribbon's
options inside the sidebar.

- A mirror control always targets the **ribbon control itself** (`id` /
  `data-tag`), never a copy of its state, so the two cannot diverge.
- Descriptor shape: `{ key, titleKey, layout: 'sections' | 'tabs',
  sections: [{ id, titleKey, items }], visibility: bool }`.
- Titles/labels prefer a `*Key` field and carry `data-i18n-runtime` so a locale
  switch re-translates JS-built nodes.

## Disclosure sections (`<details class="disclosure-section">`)

- **Named for what they are** (expand/collapse), not where they live — the
  Sidebar settings panels reuse the same card for the "Toolbar view" /
  "Tools Header" visibility rows and the custom palette.
- **Open by default**; the user's own choice is remembered per section id in
  `paint:disclosure-sections` (the old `paint:mirror-sections` value is read
  once as a fallback so remembered choices survive the rename).
- The chevron rotates (`-90deg` collapsed → `0deg` open) and mirrors under RTL.
- One helper (`applySectionState`, exported from `RibbonMirror.js`) owns the
  rule for every builder, including the visibility block — a second builder is
  exactly how one section stayed collapsed by accident.

## Static labels vs dynamic text

A node carrying `data-i18n` in the markup is **re-asserted on every locale
pass**. Any node a feature fills at runtime must either opt out with
`data-i18n-ignore`, or hand ownership to the locale controller with
`data-i18n-runtime` when it holds a real message key. Two shipped bugs came from
forgetting this: the sidebar header title and the History auto-save state.

## Composition root wiring

`js/main.js` only wires modules. A section that grows its own state moves with
it and the root keeps a single-line call — e.g.
`const settingsStore = createPaintSettingsStore();`. Schema, validators and
registry definitions live in `js/app/settingsStore.js` and
`js/app/settingsRegistry.js`.

## Everyday rule (during development)

The service worker precaches every module reachable from `js/app.js`. After you
**add, rename, move or delete any module under `js/`**, run:

```bash
npm run sw:sync        # regenerates the SHELL list in sw.js from the import graph
npm run sw:check       # verify only (used by npm test + npm run verify:release)
```

`npm test` fails with the exact missing assets if you forget, so this is caught
before handoff, not at release time.

## Version bumps (releases)

```bash
npm run version:patch  # bumps package.json, then version:sync
```

`version:sync` writes `js/version.js` (`APP_VERSION`) and regenerates the
service-worker cache key from the app version and precache content. Build and
release-verification lifecycle hooks also run this sync automatically:

| Source | Value |
|---|---|
| `package.json` | `1.7.0` |
| `js/version.js` | `APP_VERSION = '1.7.0'` |
| `sw.js` | `CACHE_NAME = 'paint-shell-v1-7-0-<shell-hash>'` |

The hash changes whenever a precached source changes. Never edit `CACHE_NAME`
by hand; run `npm run sw:sync` only when syncing manually during development.

## Production builds need none of this

`npm run build` rewrites the shell list and appends a content fingerprint to
both the cache name and the worker URL, so a redeploy of the same version can
never serve a stale shell. See the comments in `scripts/build.mjs`.

## Before handing off or releasing

```bash
npm test                 # includes the offline-shell contract test
npm run check:i18n
npm run verify:docs
npm run verify:release   # full gate: version, shell, icons, tests, diff check
```

`verify:release` prints every shell/cache finding once, each with its fix.

## Why the precache always re-fetches

`cacheShell()` in `sw.js` re-fetches each shell asset on install and only falls
back to the cached copy when the network is unavailable. Trusting a
previous entry made a same-named cache serve stale modules until someone bumped
the cache name by hand — which is exactly the drift this workflow removes.