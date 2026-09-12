# Architecture skill

Keep three concerns distinct:

1. Logic — pure transformations, command parsing, validation, and state transitions.
2. Data — localStorage/IndexedDB schemas, defaults, persistence, and migrations.
3. UI — DOM creation, styling, events, focus, and visual state.

Use `main.js` as the composition root. Feature modules expose small contracts;
they should not reach into unrelated DOM or storage. Add new persisted settings
to the registry and new UI behavior to a reusable component when a second use
is likely. Prefer events/callbacks over hidden cross-module coupling.
