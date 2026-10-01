# Releasing and versioning

Paint is a static, dependency-free PWA. Version numbers and the offline shell are
automated — **never hand-edit a cache name or add shell entries by hand**.

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

`version:sync` writes `js/version.js` (`APP_VERSION`) and the service-worker
cache name, and re-runs `sw:sync`. The convention is fixed:

| Source | Value |
|---|---|
| `package.json` | `1.7.0` |
| `js/version.js` | `APP_VERSION = '1.7.0'` |
| `sw.js` | `CACHE_NAME = 'paint-shell-v1-7-0'` |

The cache name is always `paint-shell-v<version with dots replaced by dashes>`.
A hand-written cache name (for example `paint-shell-v1-8-0` at version 1.7.0)
is a release-check failure, not a workaround.

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