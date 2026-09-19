# Step 11 — PWA, Accessibility, CSS, and Lighthouse

## Goal

Prepare the public app for a domain launch with measured quality.

## Tasks

- Track the work in this order:
  1. accessibility journeys: focus, keyboard menu overflow, history tile
     semantics, dialog focus restore, tabs, and drag alternatives;
  2. PWA shell: installable 192/512 PNG icons and resilient SW caching;
  3. CSS organization, only after browser coverage protects the component
     boundaries;
  4. Ribbon measurements in compact, expanded, top, left, bottom, and floating
     layouts;
  5. Lighthouse and browser QA on representative editor journeys;
  6. repeatable CI/nightly budgets.
- Defer automated service-worker asset-list synchronization until the higher-risk
  runtime and accessibility gates are stable.

The installed accessibility, web-quality-audit, and Playwright guidance should
be used as focused verification inputs for these gates; project-specific claims
still require evidence in this workspace.

The first focused pass is complete for the current slice: opacity inputs have
labels, action-menu triggers expose `aria-expanded`, Escape/outside clicks close
menus, palette actions are keyboard reachable, and text focus targets expose
labels and a visible keyboard focus state. Full audits, Lighthouse, offline
update checks, and the complete Ribbon layout matrix remain pending.

Round 2 adds an accessible Image → More → Crop/Rotate/Flip journey: nested
menus expose labels and expanded state, and the shared controller closes the
whole tree on outside click or Escape. The text editor’s disabled Recent text
toolbar is removed from the visual and accessibility surface. These are focused
representative checks, with ArrowDown/Enter/ArrowLeft keyboard movement, not
the final all-layout audit.

## Round 3 progress

11.1 now has measured top/left/bottom/floating Ribbon states at 1280px and a
320px narrow state with horizontal overflow preserved. Settings arrow-tab
navigation, Image More Enter-open, and Escape-close all pass in the live
browser. The palette context menu is pointer-positioned and outside-click
closed through the shared menu seam. Remaining gates are 200% zoom,
reduced-motion, Lighthouse, offline shell/update behavior, and a final visual
regression capture.

## Round 5 progress

The manifest now includes 192×192, 512×512, and maskable PNG icons rendered
from the existing app icon. The service worker precaches the manifest and new
text-layer/icon assets, and install caching uses `Promise.allSettled` so one
optional asset cannot cancel the whole shell. Reduced-motion CSS is explicit.
Live browser evidence confirms that the worker is activated, controls the
offline reload, all manifest icons fetch successfully, reduced-motion is
detected, and the 320px Ribbon remains a 74px internally scrollable strip.

Step 11 remains partial until Lighthouse, real browser-level 200% zoom,
update-prompt behavior, and the final device matrix are recorded.

## Done when

Scores and failures are recorded, targets are met or explicitly waived, and the
PWA works offline without silently losing its shell.
