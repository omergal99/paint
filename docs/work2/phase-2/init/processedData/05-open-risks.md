# Open Risks and Blind Spots

1. **Text compositing is the largest risk.** Keeping text editable after paint
   overlaps it requires an ordered object/layer model or reliable occlusion
   data. A coordinate cache is not enough.
2. **Browser memory is not the same as storage quota.** IndexedDB quota guards
   do not protect undo stacks, decoded `ImageBitmap`s, scratch canvases, or
   object URLs. Measure all of them.
3. **Python in an online app is an architecture choice.** Pyodide increases
   download and memory cost; a remote endpoint creates privacy/latency concerns;
   a local service creates installation friction.
4. **Ribbon height and multiple layouts conflict.** Top, left, bottom, and
   floating modes must each be measured; a top-layout CSS constant is not enough.
5. **Current docs/tests drift.** The missing community report and stale settings
   assertion show that documentation and tests need to be part of the gate.
6. **Service-worker asset lists drift easily.** New modules can be shipped
   online but fail offline if the precache list is not synchronized.
7. **Canvas transparency semantics are easy to regress.** Checkerboard display,
   white fill, eraser behavior, background removal, and PNG export need separate
   fixtures rather than one visual smoke test.

