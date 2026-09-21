# RTL and cross-surface browser audit

Use this checklist whenever a change affects direction, positioning, menus,
canvas geometry, responsive layout, or shared UI infrastructure.

1. Inventory every affected surface before editing: DOM placement, CSS physical
   properties, logical properties, pointer math, keyboard behavior, persistence,
   localization, responsive breakpoints, and teardown.
2. Search the whole app for related physical terms (`left`, `right`, `top`,
   `bottom`, `margin-*`, `padding-*`, `text-align`, `scrollLeft`) and classify
   each occurrence as direction-sensitive UI or intentionally physical canvas /
   image coordinates. Do not mirror bitmap coordinates accidentally.
3. Prefer logical CSS (`inset-inline-*`, `margin-inline-*`,
   `border-inline-*`, `text-align: start/end`) and keep placement math in one
   reusable helper. Mirror keyboard arrows and fallback placement as well as
   visual positions.
4. Validate at minimum LTR and RTL desktop plus RTL narrow/mobile dimensions;
   inspect computed rectangles for clipping, reachable resize handles, submenu
   direction, and scroll behavior. Record the browser, viewport, and evidence.
5. Add a focused contract test and a smoke/static guard for each shared seam.
   Run syntax/type checks, the full test suite, production build, and release
   verification before handoff.

The acceptance question is not “does the edited selector look correct?” It is
“did every consumer of the shared coordinate or direction contract remain
correct in every supported layout?”
