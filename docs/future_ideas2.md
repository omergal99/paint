# paint: Next Steps

This document follows the first production-hardening pass and prioritizes work by user value and technical risk.

## 1. Real offline update lifecycle
- Add a generated build version to the Service Worker cache name.
- Show an "Update available" prompt when a new worker reaches `waiting`.
- Add an explicit reload action so a user never loses an active drawing.
- Run the Lighthouse PWA audit against the deployed GitHub Pages URL as well as localhost.

## 2. Non-destructive transform model
- Store selection transforms as operations until commit instead of repeatedly rasterizing during pointer movement.
- Add rotation handles with snapping at 0, 45, 90, 180, 270, and 360 degrees.
- Add keyboard modifiers for aspect-ratio locking and center-based scaling.
- Add a cancel action that restores the pre-transform snapshot.

## 3. Better document persistence
- Replace data URLs in global history with PNG or WebP `Blob` records.
- Add storage quota warnings before writes and an automatic least-recently-used cleanup policy.
- Add named documents and an import/export backup file for settings and history metadata.
- Add recovery of the last autosaved document after an interrupted session.

## 4. Selection and editing tools
- Add freeform and polygon selections with marching-ants rendering.
- Add a selection mask abstraction so fill, blur, background removal, and filters share boundaries.
- Add a brush cursor preview that reflects line width, opacity, and eraser mode.
- Add non-destructive blur and pixelation tools for sensitive content.

## 5. Accessibility and input quality
- Add keyboard navigation across ribbon groups and settings tabs.
- Add visible focus states and announce tool changes through an ARIA live region.
- Add pointer pressure support for compatible styluses and a configurable palm-rejection mode.
- Add reduced-motion styling and high-contrast theme checks to CI.

## 6. Performance measurement
- Record Web Vitals only after consent and sample production telemetry.
- Add canvas-size stress tests for large images and low-memory devices.
- Track dropped frames during active strokes separately from idle FPS.
- Add Playwright smoke tests for drawing, undo/redo, selection resize, transform, autosave, and offline reload.

## 7. Collaboration and integrations
- Add a local command palette for tools and actions.
- Keep AI integrations opt-in, provider-configurable, and explicit about whether image data leaves the browser.
- Add a safe adapter interface for image generation and filtering providers without coupling the editor to one vendor.
