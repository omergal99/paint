# Step 11 - PWA, Accessibility, CSS, and Lighthouse

## Goal

Prepare the public app for a domain launch with measured quality.

## Tasks

- Track the work in this order:
  1. accessibility journeys: focus, keyboard menu overflow, history tile
     semantics, dialog focus restore, tabs, and drag alternatives;
  2. PWA shell: installable 192/512 PNG icons, resilient SW caching, and a
     content-fingerprinted production shell;
  3. CSS organization, only after browser coverage protects the component
     boundaries;
  4. Ribbon measurements in compact, expanded, top, left, bottom, and floating
     layouts;
  5. Lighthouse and browser QA on representative editor journeys;
  6. repeatable CI/nightly budgets.
- The production build now creates the worker shell from the emitted `dist/`
  asset graph. The local audit and CI budget use that generated artifact rather
  than the development source tree.

The installed accessibility, web-quality-audit, and Playwright guidance should
be used as focused verification inputs for these gates; project-specific claims
still require evidence in this workspace.

The first focused pass established the current accessibility slice: opacity inputs have
labels, action-menu triggers expose `aria-expanded`, Escape/outside clicks close
menus, palette actions are keyboard reachable, and text focus targets expose
labels and a visible keyboard focus state. Later sections record the local
build/Lighthouse results; broad public-host and real-device coverage remains
pending.

Round 2 adds an accessible Image → More → Crop/Rotate/Flip journey: nested
menus expose labels and expanded state, and the shared controller closes the
whole tree on outside click or Escape. The text editor’s disabled Recent text
toolbar is removed from the visual and accessibility surface. These are focused
representative checks, with ArrowDown/Enter/ArrowLeft keyboard movement, not
the final all-layout audit.

## Round 3 progress

At that checkpoint, 11.1 measured top/left/bottom/floating Ribbon states at 1280px and a
320px narrow state with horizontal overflow preserved. Settings arrow-tab
navigation, Image More Enter-open, and Escape-close all pass in the live
browser. The palette context menu is pointer-positioned and outside-click
closed through the shared menu seam. The later local production-build section
supersedes its former Lighthouse/offline pending status; public installation,
deployed update, and device coverage remain open.

## Round 5 progress

The manifest now includes 192×192, 512×512, and maskable PNG icons rendered
from the existing app icon. The service worker precaches the manifest and new
text-layer/icon assets, and install caching uses `Promise.allSettled` so one
optional asset cannot cancel the whole shell. Reduced-motion CSS is explicit.
Live browser evidence confirms that the worker is activated, controls the
offline reload, all manifest icons fetch successfully, reduced-motion is
detected, and the 320px Ribbon remains a 74px internally scrollable strip.

The local Lighthouse and build gates below are now recorded. Public-host install
and update behavior plus the final real-device matrix remain open.

## Lifecycle hardening

The service worker now deletes only prior `paint-shell-*` caches at activation,
so unrelated same-origin cache entries are preserved. The install manager
immediately describes an already-waiting update as ready and preserves its
"Applying" status while it requests activation. Focused Node lifecycle tests
cover cache ownership, waiting-update status, and a failed `CACHE_ALL` reply
that must never claim offline readiness. Browser-level listeners for install,
update, visibility, worker state, and controller changes now have explicit
teardown too. This is local/source evidence only; production-host HTTPS
install/update and real-device validation remain open.

## Round 8 local production-build audit - 2026-09-20

`npm run build` creates a code-split, minified `dist/` directory and generates a
content-fingerprinted service-worker shell from the emitted assets. The deployed
workflow builds that directory before publishing it, and the Lighthouse workflow
serves it locally before enforcing the desktop budget.

Chrome 151 served the local production build under service-worker control. The
same audit covered a real pointer/autosave journey and recorded zero console
errors; the worker used a content-fingerprinted shell cache. This proves the
local build-and-serve path, not a public deployment, CDN, TLS, or installed-app
journey.

Local desktop Lighthouse measured **Performance 100, Accessibility 96, Best
Practices 100, and SEO 100**. The repeatable desktop budget requires every
category to be at least 90. The slow-mobile localhost diagnostic is
**Performance 76**, so the desktop result must not be used to close the mobile
90+ target. Exact results are in [production-build browser evidence](../../../../output/playwright/phase-2/local-audit-20260920/production-build-runtime.json)
and [production-build Lighthouse reports](../../../../output/quality/).

Production HTTPS install proof, a deployed update journey, real desktop/mobile
devices, and mobile performance work are all external follow-up gates.

## Done when

The local desktop build/Lighthouse gate is complete. Close the public launch
gate only when the deployed HTTPS host installs, updates, and recovers offline
on the intended real-device matrix, and when mobile performance reaches its
separate 90+ target.
