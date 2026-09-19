---
name: accessibility
description: Audit and improve Paint Online accessibility for keyboard, dialogs, menus, canvas workflows, and screen readers using WCAG 2.2.
license: MIT
metadata:
  author: web-quality-skills
  version: "2.0-project-adapted"
---

# Paint Online accessibility

Use this skill for rendered accessibility work in Paint. Target WCAG 2.2 A and
AA behavior that applies to a local-first canvas editor. Do not spend effort on
video/audio captions, authentication, checkout, or multi-page navigation: they
are not product surfaces here.

## Evidence-led workflow

1. Run a live Lighthouse Accessibility audit when available.
2. Inspect the rendered accessibility tree for names, roles, states, labels,
   tab relationships, dialogs, and status messages.
3. Exercise the same flow with keyboard only and at 200% zoom.
4. Localize failures to the affected HTML/CSS/module; do not infer a fix from
   a generic selector search alone.
5. Re-run the same audit and keyboard journey after the change.

Automated scores are evidence, not proof of conformance. Record the browser,
viewport, state, and manual checks.

## Paint-specific requirements

### Perceivable

- Every meaningful `<img>` has useful `alt`; decorative icons use `alt=""` or
  `aria-hidden="true"`.
- Icon-only buttons have an accessible name.
- Text and controls meet WCAG AA contrast; selected tabs and active tools must
  not rely on color alone.
- Canvas workflows expose text labels/status where pixels alone cannot explain
  the action; the canvas does not replace the ribbon's accessible controls.
- Focus indicators and transparent/checkerboard color states remain visible in
  light and dark themes.

### Operable

- Use native buttons, links, inputs, and selects before adding ARIA behavior.
- Menus, shape galleries, history tabs, settings tabs, dialogs, and context
  menus are keyboard reachable and escapable.
- Tabs expose `role="tablist"`, `role="tab"`, `aria-selected`,
  `aria-controls`, and `role="tabpanel"` where custom tab behavior is used.
- Focus is not hidden behind the ribbon, sidebar, or dialog controls.
- Canvas resize, selection move, split-pane dragging, and ribbon dragging have
  a click/keyboard alternative where the action remains in the product.
- Interactive targets are at least 24×24 CSS pixels; use larger targets where
  the compact ribbon allows it.
- Respect `prefers-reduced-motion`, especially for text reveal/highlight mode.

### Understandable

- Keep `<html lang="en">`, descriptive headings, labels, and instructions.
- Associate every form control with a label; expose invalid values and recovery
  instructions through text and an appropriate live region.
- Confirm destructive actions and make status messages available via
  `role="status"`/`aria-live` without moving focus unexpectedly.
- Preserve consistent labels for History, Session, Save, Export, Delete, and
  Close across the ribbon, sidebar, and settings dialog.

### Robust

- Prefer native semantics; use ARIA only when it matches the actual behavior.
- Avoid duplicate IDs and stale `aria-selected`/`aria-expanded` values.
- Keep menu open/close, dialog close, tab switching, and context-menu behavior
  testable without relying on color or pointer-only events.

## Required Paint checks

- Cold load: title, landmarks, language, icon names, and no console errors.
- Ribbon: Tab/Shift+Tab, Enter/Space, More menus, shape gallery, and Escape.
- Settings: tab navigation, selected panel, labels, close/focus restore.
- History: History/Session selection, restore/export/delete controls, live status.
- Resize: ratio lock, percentage control, validation, and non-drag alternative.
- Palette: primary/secondary/transparent controls and right-click alternative.
- Text: editor toolbar, history, context edit, reveal mode, and reduced motion.

## Verification options

```bash
npx lighthouse http://localhost:4173/ --only-categories=accessibility
```

Use the Playwright CLI skill for snapshots/screenshots and manual keyboard
flows. Use axe only as an additional signal; it does not replace keyboard,
focus, zoom, or screen-reader checks.

## References

- `references/WCAG.md` — Paint-relevant WCAG 2.2 criteria.
- `references/A11Y-PATTERNS.md` — dialogs, labels, tabs, menus, live regions,
  and dragging alternatives.
- [WCAG 2.2 Quick Reference](https://www.w3.org/WAI/WCAG22/quickref/)
- [WAI-ARIA Authoring Practices](https://www.w3.org/WAI/ARIA/apg/)
