# Step 07 — Performance and Event Hygiene

## Goal

Reduce hot-path work and make listener lifetime explicit.

## Tasks

- One pointermove/rAF pipeline and cached viewport geometry.
- Pointer capture instead of temporary global listeners where safe.
- EventBus adoption and listener teardown APIs.
- Visibility-aware telemetry with `destroy()`.
- Delegated Ribbon actions where semantics remain clear.

## Done when

Before/after traces show less duplicate work without pointer, touch, stylus, or
keyboard regressions.

