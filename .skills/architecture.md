# Architecture skill

Keep three concerns distinct:

1. Logic — pure transformations, command parsing, validation, and state transitions.
2. Data — localStorage/IndexedDB schemas, defaults, persistence, and migrations.
3. UI — DOM creation, styling, events, focus, and visual state.

Use `main.js` as the composition root. Feature modules expose small contracts;
they should not reach into unrelated DOM or storage. Add new persisted settings
to the registry and new UI behavior to a reusable component when a second use
is likely. Prefer events/callbacks over hidden cross-module coupling.

Prefer functional factories, closures, and pure transforms for new JavaScript
modules. Keep mutable state private inside a factory and return a small frozen
or clearly documented API. Do not introduce a class merely to group methods;
when migrating an existing class, preserve its public contract at the boundary,
move state behind a factory, and convert one dependency seam at a time so the
canvas/editor behavior remains testable. Use `const name = (...) => {}` for
named standalone functions, including exported functions; this keeps the
functional style consistent and makes declaration order explicit. Class methods
remain methods until their owning class is migrated at a tested seam.
