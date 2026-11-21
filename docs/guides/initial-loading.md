# Initial Loading — Developer Options

This document explains the loading-screen behaviour of Paint Online and the
developer-only knobs that exist for local inspection. **None of these options
should ever be active in a committed/production build.**

## Architecture

`js/core/initAppLoadingService.js` is the single source of truth for all
initial-load masking:

| Mask | Element | Released by |
|---|---|---|
| Canvas overlay | `.canvas-loading-mask` (covers `.overlay-canvas`) | `paint:image-loaded` event or fallback timer (10 s) |
| Ribbon header | `.ribbon-loading-mask` (inside `.ribbon`) | `paint:ready` event |

Both `js/app.js` (ribbon) and `js/main.js` (canvas) import from this module,
so there is one shared state machine and no duplicated delay logic.

The static shell in `index.html` is shown first. `js/app.js` yields a browser
paint before dynamically importing `js/main.js`; the editor then hydrates
settings and, when enabled, resolves the working-canvas recovery record before
dispatching `paint:ready`. This is a staged startup, not two sequential
one-second waits.

## Production behaviour

Masks are released by their readiness events with **zero artificial delay**.
The 10-second fallback timer in `startCanvasReleaseFallback()` is a safety net
so users are never blocked by a stuck overlay if a readiness event is missed.

### Service-worker control and reloads

The service worker may claim a page during the first visit. The global
`controllerchange` listener in `js/app.js` ignores that first transition; it
reloads only when a page that already had a controller changes to an updated
worker. This separates initial control from an update, which previously could
make first-time startup look like a second load.

Local check (2026-11-20): a fresh origin at `127.0.0.1:4175`, 1280 × 800,
reported one navigation of type `navigate`; the editor reached its ready state
without a second navigation. This is local browser evidence, not proof for a
production domain or physical mobile device. Test a later worker update on an
already-controlled page separately; a warm tab is not evidence for the
first-visit case.

## Developer options

### 1. `?debugLoading=1&loadingMs=N` (URL parameter)

Appends a bounded artificial delay to both masks so you can inspect the
loading UI during local development.

```
http://localhost:8000/?debugLoading=1&loadingMs=3000
```

- `debugLoading=1` — enables the delay.
- `loadingMs=N` — delay in milliseconds. Capped at **10 000 ms** (10 s).
  Negative or non-numeric values are clamped to 0.

Implemented by `getDebugLoadingDelay()` in `initAppLoadingService.js`.
This is safe to use locally because the delay is bounded.

### 2. `DEV_LOADING_HOLD` (source constant)

Keeps the loading masks on screen **indefinitely** for manual inspection of
the skeleton effect, spinner, layout, RTL behaviour, etc.

**How to enable:**

1. Open `js/core/initAppLoadingService.js`.
2. Find the line:

   ```js
   export const DEV_LOADING_HOLD = false;
   ```

3. Change `false` → `true`:

   ```js
   export const DEV_LOADING_HOLD = true;
   ```

4. Reload the app. The canvas loading mask and ribbon mask will now stay on
   screen forever (the fallback timer is skipped and `releaseCanvasLoading()` /
   `releaseRibbonLoading()` become no-ops).

5. When you are done inspecting, **change the constant back to `false` and
   reload**.

> **Warning:** This is a source-code constant, not an environment variable or
> URL parameter. It must never be committed as `true`. A CI guard
> (`DEV_LOADING_HOLD is disabled by default (CI guard)` in
> `tests/unit/app/init-app-loading-service.test.js`) asserts that `isDevLoadingHold()`
> returns `false`; if the constant is accidentally committed as `true`, this
> test fails and the pipeline blocks the merge.

## CI guard

`tests/unit/app/init-app-loading-service.test.js` contains a test named:

```
DEV_LOADING_HOLD is disabled by default (CI guard)
```

This test imports `isDevLoadingHold()` from `initAppLoadingService.js` and
asserts it returns `false`. Run it locally with:

```sh
node --test tests/unit/app/init-app-loading-service.test.js
```

## Skeleton effect behind the ribbon mask

`.ribbon-loading-mask` uses a translucent background so the default header
shape is visible as a skeleton while loading:

```css
background: color-mix(in srgb, var(--w10-ribbon-bg) 55%, transparent);
```

The spinner and label inside the mask keep `opacity: 1` so they remain fully
readable over the translucent layer.
