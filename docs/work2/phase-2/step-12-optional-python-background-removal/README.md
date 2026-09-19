# Step 12 — Optional Advanced Python Background Removal

## Goal

Offer advanced removal without making the default online editor heavy or
silently uploading private images.

## Tasks

- Define a cancellable background-removal provider interface.
- Keep browser color-key/alpha removal as the default.
- Load the optional provider only after explicit user choice with dynamic
  `import()` and a dedicated Worker; use tree shaking/separate chunks when a
  bundler exists.
- Compare Pyodide/WebAssembly, optional local Python service, and remote API on
  bundle size, browser memory, privacy, latency, and deployment effort.
- Add explicit progress, timeout, size limits, cancellation, and failure UX.
- Self-host/version optional runtime/model assets; retain a JavaScript fallback
  and postpone Python if the memory or performance budget fails.

## Done when

The owner chooses a deployment model and the provider can be disabled without
affecting normal drawing or PNG export.
